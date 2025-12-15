import { db } from "@open-bookkeeping/db";
import {
  agentSessions,
  agentMessages,
  agentMemories,
  agentUserContext,
} from "@open-bookkeeping/db";
import { eq, and, desc, sql, isNull, or, ilike } from "drizzle-orm";
import { createLogger } from "@open-bookkeeping/shared";
import {
  generateEmbedding,
  createMemorySearchText,
  formatEmbeddingForPg,
} from "./embedding.service";

const logger = createLogger("agent-memory-service");

// ============================================
// SESSION MEMORY SERVICE
// ============================================

export interface SessionMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    toolCallId: string;
    result: unknown;
    error?: string;
  }>;
}

export interface Session {
  id: string;
  title?: string;
  status: "active" | "completed" | "archived";
  messages: SessionMessage[];
  summary?: string;
  systemContext?: {
    companyName?: string;
    currency?: string;
    fiscalYearEnd?: string;
    preferences?: Record<string, unknown>;
  };
}

/**
 * Get or create an active session for a user
 */
export async function getOrCreateSession(
  userId: string,
  sessionId?: string
): Promise<Session> {
  try {
    // If sessionId provided, try to find it
    if (sessionId) {
      const existing = await db
        .select()
        .from(agentSessions)
        .where(and(eq(agentSessions.id, sessionId), eq(agentSessions.userId, userId)))
        .limit(1);

      const existingSession = existing[0];
      if (existingSession) {
        const messages = await getSessionMessages(sessionId);
        return {
          id: existingSession.id,
          title: existingSession.title ?? undefined,
          status: existingSession.status as Session["status"],
          messages,
          summary: existingSession.summary ?? undefined,
          systemContext: existingSession.systemContext as Session["systemContext"],
        };
      }
    }

    // Get user context for system context
    const userContext = await getUserContext(userId);

    // Create new session
    const [newSession] = await db
      .insert(agentSessions)
      .values({
        userId,
        status: "active",
        systemContext: userContext
          ? {
              companyName: userContext.companyName ?? undefined,
              currency: userContext.defaultCurrency ?? "MYR",
              fiscalYearEnd: userContext.fiscalYearEnd ?? undefined,
              preferences: {
                verbosityLevel: userContext.verbosityLevel,
                autoSuggestActions: userContext.autoSuggestActions,
                confirmBeforeActions: userContext.confirmBeforeActions,
              },
            }
          : undefined,
      })
      .returning();

    if (!newSession) {
      throw new Error("Failed to create new session");
    }

    return {
      id: newSession.id,
      status: "active",
      messages: [],
      systemContext: newSession.systemContext as Session["systemContext"],
    };
  } catch (error) {
    logger.error({ error, userId, sessionId }, "Failed to get/create session");
    throw error;
  }
}

/**
 * Get messages for a session
 * @throws Error if database query fails (callers should handle this)
 */
export async function getSessionMessages(
  sessionId: string
): Promise<SessionMessage[]> {
  try {
    const messages = await db
      .select()
      .from(agentMessages)
      .where(eq(agentMessages.sessionId, sessionId))
      .orderBy(agentMessages.createdAt);

    return messages.map((m) => ({
      role: m.role as SessionMessage["role"],
      content: m.content ?? "",
      toolCalls: m.toolCalls as SessionMessage["toolCalls"],
      toolResults: m.toolResults as SessionMessage["toolResults"],
    }));
  } catch (error) {
    logger.error({ error, sessionId }, "Failed to get session messages - throwing to caller");
    // Re-throw to let caller decide how to handle (don't silently return empty)
    throw new Error(`Failed to retrieve session messages: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Save a message to the session
 * @throws Error if save fails (data loss prevention)
 */
export async function saveMessage(
  sessionId: string,
  message: SessionMessage,
  tokens?: { promptTokens?: number; completionTokens?: number }
): Promise<void> {
  try {
    await db.insert(agentMessages).values({
      sessionId,
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls,
      toolResults: message.toolResults,
      promptTokens: tokens?.promptTokens,
      completionTokens: tokens?.completionTokens,
    });

    // Update session token counts
    if (tokens?.promptTokens || tokens?.completionTokens) {
      await db
        .update(agentSessions)
        .set({
          totalPromptTokens: sql`${agentSessions.totalPromptTokens} + ${tokens.promptTokens ?? 0}`,
          totalCompletionTokens: sql`${agentSessions.totalCompletionTokens} + ${tokens.completionTokens ?? 0}`,
          updatedAt: new Date(),
        })
        .where(eq(agentSessions.id, sessionId));
    }
  } catch (error) {
    logger.error({ error, sessionId, messageRole: message.role }, "Failed to save message - throwing to prevent data loss");
    throw new Error(`Failed to save message: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Update session title based on first message
 */
export async function updateSessionTitle(
  sessionId: string,
  title: string
): Promise<void> {
  try {
    await db
      .update(agentSessions)
      .set({
        title: title.slice(0, 255),
        updatedAt: new Date(),
      })
      .where(eq(agentSessions.id, sessionId));
  } catch (error) {
    logger.error({ error, sessionId }, "Failed to update session title");
  }
}

/**
 * Complete/archive a session
 */
export async function completeSession(
  sessionId: string,
  summary?: string
): Promise<void> {
  try {
    await db
      .update(agentSessions)
      .set({
        status: "completed",
        summary,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSessions.id, sessionId));
  } catch (error) {
    logger.error({ error, sessionId }, "Failed to complete session");
  }
}

/**
 * Get recent sessions for a user
 * @throws Error if database query fails
 */
export async function getRecentSessions(
  userId: string,
  limit: number = 10
): Promise<Array<{ id: string; title: string | null; createdAt: Date }>> {
  try {
    const sessions = await db
      .select({
        id: agentSessions.id,
        title: agentSessions.title,
        createdAt: agentSessions.createdAt,
      })
      .from(agentSessions)
      .where(eq(agentSessions.userId, userId))
      .orderBy(desc(agentSessions.createdAt))
      .limit(limit);

    return sessions;
  } catch (error) {
    logger.error({ error, userId }, "Failed to get recent sessions - throwing to caller");
    throw new Error(`Failed to get recent sessions: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

// ============================================
// LONG-TERM MEMORY SERVICE
// ============================================

export interface Memory {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  sourceType: string;
}

/**
 * Store a new memory with semantic embedding
 */
export async function storeMemory(
  userId: string,
  memory: {
    category: "preference" | "fact" | "pattern" | "instruction" | "context" | "insight";
    key: string;
    value: string;
    sourceType: "user_explicit" | "inferred" | "system" | "conversation";
    sourceSessionId?: string;
    confidence?: number;
    tags?: string[];
    expiresAt?: Date;
  }
): Promise<Memory | null> {
  try {
    // Generate embedding for semantic search
    const searchText = createMemorySearchText(memory.key, memory.value);
    const embedding = await generateEmbedding(searchText);

    // Check for similar existing memories using semantic search (deduplication)
    if (embedding) {
      const similar = await findSimilarMemories(userId, embedding, 0.95);
      if (similar.length > 0) {
        // Update the most similar memory instead of creating duplicate
        const mostSimilar = similar[0];
        if (mostSimilar) {
          logger.info(
            { userId, existingKey: mostSimilar.key, newKey: memory.key, similarity: mostSimilar.similarity },
            "Found similar memory, updating instead of creating duplicate"
          );

          const embeddingPg = formatEmbeddingForPg(embedding);
          const [updated] = await db
            .update(agentMemories)
            .set({
              key: memory.key,
              value: memory.value,
              confidence: memory.confidence?.toString() ?? "1.00",
              tags: memory.tags,
              sourceType: memory.sourceType,
              sourceSessionId: memory.sourceSessionId,
              updatedAt: new Date(),
            })
            .where(eq(agentMemories.id, mostSimilar.id))
            .returning();

          // Update embedding separately due to type issues
          await db.execute(
            sql`UPDATE agent_memories SET embedding_vector = ${embeddingPg}::vector WHERE id = ${mostSimilar.id}`
          );

          if (updated) {
            return {
              id: updated.id,
              category: updated.category,
              key: updated.key,
              value: updated.value,
              confidence: parseFloat(updated.confidence?.toString() ?? "1"),
              sourceType: updated.sourceType,
            };
          }
        }
      }
    }

    // Check for existing memory with exact same key (fallback)
    const existing = await db
      .select()
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.key, memory.key),
          eq(agentMemories.isActive, true)
        )
      )
      .limit(1);

    const existingMemory = existing[0];
    if (existingMemory) {
      // Update existing memory
      const [updated] = await db
        .update(agentMemories)
        .set({
          value: memory.value,
          confidence: memory.confidence?.toString() ?? "1.00",
          tags: memory.tags,
          sourceType: memory.sourceType,
          sourceSessionId: memory.sourceSessionId,
          updatedAt: new Date(),
        })
        .where(eq(agentMemories.id, existingMemory.id))
        .returning();

      // Update embedding if available
      if (embedding) {
        const embeddingPg = formatEmbeddingForPg(embedding);
        await db.execute(
          sql`UPDATE agent_memories SET embedding_vector = ${embeddingPg}::vector WHERE id = ${existingMemory.id}`
        );
      }

      if (!updated) {
        throw new Error("Failed to update memory");
      }

      return {
        id: updated.id,
        category: updated.category,
        key: updated.key,
        value: updated.value,
        confidence: parseFloat(updated.confidence?.toString() ?? "1"),
        sourceType: updated.sourceType,
      };
    }

    // Create new memory
    const [newMemory] = await db
      .insert(agentMemories)
      .values({
        userId,
        category: memory.category,
        key: memory.key,
        value: memory.value,
        sourceType: memory.sourceType,
        sourceSessionId: memory.sourceSessionId,
        confidence: memory.confidence?.toString() ?? "1.00",
        tags: memory.tags,
        expiresAt: memory.expiresAt,
      })
      .returning();

    if (!newMemory) {
      throw new Error("Failed to create memory");
    }

    // Add embedding to the new memory
    if (embedding) {
      const embeddingPg = formatEmbeddingForPg(embedding);
      await db.execute(
        sql`UPDATE agent_memories SET embedding_vector = ${embeddingPg}::vector WHERE id = ${newMemory.id}`
      );
    }

    return {
      id: newMemory.id,
      category: newMemory.category,
      key: newMemory.key,
      value: newMemory.value,
      confidence: parseFloat(newMemory.confidence?.toString() ?? "1"),
      sourceType: newMemory.sourceType,
    };
  } catch (error) {
    logger.error({ error, userId, memory }, "Failed to store memory");
    return null;
  }
}

/**
 * Retrieve memories by category
 */
export async function getMemoriesByCategory(
  userId: string,
  category: string
): Promise<Memory[]> {
  try {
    const memories = await db
      .select()
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.category, category),
          eq(agentMemories.isActive, true),
          or(
            isNull(agentMemories.expiresAt),
            sql`${agentMemories.expiresAt} > NOW()`
          )
        )
      )
      .orderBy(desc(agentMemories.updatedAt));

    return memories.map((m) => ({
      id: m.id,
      category: m.category,
      key: m.key,
      value: m.value,
      confidence: parseFloat(m.confidence?.toString() ?? "1"),
      sourceType: m.sourceType,
    }));
  } catch (error) {
    logger.error({ error, userId, category }, "Failed to get memories");
    return [];
  }
}

/**
 * Search memories by key or value (keyword-based)
 */
export async function searchMemories(
  userId: string,
  query: string,
  limit: number = 10
): Promise<Memory[]> {
  try {
    const memories = await db
      .select()
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.userId, userId),
          eq(agentMemories.isActive, true),
          or(
            ilike(agentMemories.key, `%${query}%`),
            ilike(agentMemories.value, `%${query}%`)
          )
        )
      )
      .orderBy(desc(agentMemories.useCount), desc(agentMemories.updatedAt))
      .limit(limit);

    return memories.map((m) => ({
      id: m.id,
      category: m.category,
      key: m.key,
      value: m.value,
      confidence: parseFloat(m.confidence?.toString() ?? "1"),
      sourceType: m.sourceType,
    }));
  } catch (error) {
    logger.error({ error, userId, query }, "Failed to search memories");
    return [];
  }
}

export interface SemanticMemory extends Memory {
  similarity: number;
}

/**
 * Search memories using semantic similarity (vector search)
 * Falls back to keyword search if embedding generation fails
 */
export async function searchMemoriesSemantic(
  userId: string,
  query: string,
  options?: {
    threshold?: number;
    limit?: number;
  }
): Promise<SemanticMemory[]> {
  const threshold = options?.threshold ?? 0.7;
  const limit = options?.limit ?? 10;

  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    if (!embedding) {
      // Fallback to keyword search
      logger.warn({ userId, query }, "Failed to generate embedding, falling back to keyword search");
      const keywordResults = await searchMemories(userId, query, limit);
      return keywordResults.map((m) => ({ ...m, similarity: 0.5 }));
    }

    // Use the database function for semantic search
    const embeddingPg = formatEmbeddingForPg(embedding);
    const results = await db.execute(
      sql`SELECT * FROM search_memories_semantic(
        ${userId}::uuid,
        ${embeddingPg}::vector,
        ${threshold}::float,
        ${limit}::int
      )`
    ) as unknown as Array<{
      id: string;
      category: string;
      key: string;
      value: string;
      confidence: string;
      source_type: string;
      similarity: number;
    }>;

    return results.map((row) => ({
      id: row.id,
      category: row.category,
      key: row.key,
      value: row.value,
      confidence: parseFloat(row.confidence ?? "1"),
      sourceType: row.source_type,
      similarity: row.similarity,
    }));
  } catch (error) {
    logger.error({ error, userId, query }, "Failed to search memories semantically");
    // Fallback to keyword search
    const keywordResults = await searchMemories(userId, query, limit);
    return keywordResults.map((m) => ({ ...m, similarity: 0.5 }));
  }
}

/**
 * Find memories similar to a given embedding (for deduplication)
 */
export async function findSimilarMemories(
  userId: string,
  embedding: number[],
  threshold: number = 0.95
): Promise<Array<{ id: string; key: string; similarity: number }>> {
  try {
    const embeddingPg = formatEmbeddingForPg(embedding);
    const results = await db.execute(
      sql`SELECT * FROM find_similar_memories(
        ${userId}::uuid,
        ${embeddingPg}::vector,
        ${threshold}::float
      )`
    ) as unknown as Array<{
      id: string;
      key: string;
      similarity: number;
    }>;

    return results.map((row) => ({
      id: row.id,
      key: row.key,
      similarity: row.similarity,
    }));
  } catch (error) {
    logger.error({ error, userId }, "Failed to find similar memories");
    return [];
  }
}

/**
 * Get all relevant memories for context building
 * Uses Promise.allSettled for graceful degradation - partial failures won't break the entire context
 */
export async function getRelevantMemories(
  userId: string
): Promise<{ preferences: Memory[]; facts: Memory[]; patterns: Memory[]; instructions: Memory[] }> {
  const results = await Promise.allSettled([
    getMemoriesByCategory(userId, "preference"),
    getMemoriesByCategory(userId, "fact"),
    getMemoriesByCategory(userId, "pattern"),
    getMemoriesByCategory(userId, "instruction"),
  ]);

  // Log any failures for debugging
  const failedCategories: string[] = [];
  if (results[0].status === "rejected") failedCategories.push("preference");
  if (results[1].status === "rejected") failedCategories.push("fact");
  if (results[2].status === "rejected") failedCategories.push("pattern");
  if (results[3].status === "rejected") failedCategories.push("instruction");

  if (failedCategories.length > 0) {
    logger.warn(
      { userId, failedCategories },
      "Some memory categories failed to load - using partial context"
    );
  }

  return {
    preferences: results[0].status === "fulfilled" ? results[0].value : [],
    facts: results[1].status === "fulfilled" ? results[1].value : [],
    patterns: results[2].status === "fulfilled" ? results[2].value : [],
    instructions: results[3].status === "fulfilled" ? results[3].value : [],
  };
}

/**
 * Update memory usage (tracks how often a memory is used)
 */
export async function incrementMemoryUsage(memoryId: string): Promise<void> {
  try {
    await db
      .update(agentMemories)
      .set({
        useCount: sql`${agentMemories.useCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(agentMemories.id, memoryId));
  } catch (error) {
    logger.error({ error, memoryId }, "Failed to increment memory usage");
  }
}

// ============================================
// USER CONTEXT SERVICE
// ============================================

export interface UserContext {
  companyName?: string | null;
  companyAddress?: string | null;
  defaultCurrency?: string | null;
  fiscalYearEnd?: string | null;
  industry?: string | null;
  preferredLanguage?: string | null;
  dateFormat?: string | null;
  invoicePrefix?: string | null;
  quotationPrefix?: string | null;
  verbosityLevel?: string | null;
  autoSuggestActions?: boolean | null;
  confirmBeforeActions?: boolean | null;
  commonTasks?: string[] | null;
  frequentCustomers?: string[] | null;
  frequentVendors?: string[] | null;
}

/**
 * Get user context
 */
export async function getUserContext(userId: string): Promise<UserContext | null> {
  try {
    const [context] = await db
      .select()
      .from(agentUserContext)
      .where(eq(agentUserContext.userId, userId))
      .limit(1);

    if (!context) {
      return null;
    }

    return {
      companyName: context.companyName,
      companyAddress: context.companyAddress,
      defaultCurrency: context.defaultCurrency,
      fiscalYearEnd: context.fiscalYearEnd,
      industry: context.industry,
      preferredLanguage: context.preferredLanguage,
      dateFormat: context.dateFormat,
      invoicePrefix: context.invoicePrefix,
      quotationPrefix: context.quotationPrefix,
      verbosityLevel: context.verbosityLevel,
      autoSuggestActions: context.autoSuggestActions,
      confirmBeforeActions: context.confirmBeforeActions,
      commonTasks: context.commonTasks as string[] | null,
      frequentCustomers: context.frequentCustomers as string[] | null,
      frequentVendors: context.frequentVendors as string[] | null,
    };
  } catch (error) {
    logger.error({ error, userId }, "Failed to get user context");
    return null;
  }
}

/**
 * Update or create user context
 */
export async function upsertUserContext(
  userId: string,
  updates: Partial<UserContext>
): Promise<UserContext | null> {
  try {
    // Check if context exists
    const existing = await getUserContext(userId);

    if (existing) {
      // Update existing
      await db
        .update(agentUserContext)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(agentUserContext.userId, userId));
    } else {
      // Create new
      await db.insert(agentUserContext).values({
        userId,
        ...updates,
      });
    }

    return getUserContext(userId);
  } catch (error) {
    logger.error({ error, userId, updates }, "Failed to upsert user context");
    return null;
  }
}

/**
 * Build full context string for the AI agent
 * Uses Promise.allSettled for graceful degradation
 */
export async function buildAgentContext(userId: string): Promise<string> {
  const results = await Promise.allSettled([
    getUserContext(userId),
    getRelevantMemories(userId),
  ]);

  // Extract results with fallbacks
  const userContext = results[0].status === "fulfilled" ? results[0].value : null;
  const memories = results[1].status === "fulfilled"
    ? results[1].value
    : { preferences: [], facts: [], patterns: [], instructions: [] };

  // Log any failures
  if (results[0].status === "rejected") {
    logger.warn({ userId, error: results[0].reason }, "User context failed to load for agent context");
  }
  if (results[1].status === "rejected") {
    logger.warn({ userId, error: results[1].reason }, "Memories failed to load for agent context");
  }

  const contextParts: string[] = [];

  // User context
  if (userContext) {
    const businessContext: string[] = [];
    if (userContext.companyName) businessContext.push(`Company: ${userContext.companyName}`);
    if (userContext.defaultCurrency) businessContext.push(`Default Currency: ${userContext.defaultCurrency}`);
    if (userContext.fiscalYearEnd) businessContext.push(`Fiscal Year End: ${userContext.fiscalYearEnd}`);
    if (userContext.industry) businessContext.push(`Industry: ${userContext.industry}`);
    if (userContext.invoicePrefix) businessContext.push(`Invoice Prefix: ${userContext.invoicePrefix}`);
    if (userContext.quotationPrefix) businessContext.push(`Quotation Prefix: ${userContext.quotationPrefix}`);

    if (businessContext.length > 0) {
      contextParts.push(`BUSINESS CONTEXT:\n${businessContext.join("\n")}`);
    }

    // Preferences
    const prefs: string[] = [];
    if (userContext.verbosityLevel && userContext.verbosityLevel !== "normal") {
      prefs.push(`Response style: ${userContext.verbosityLevel}`);
    }
    if (userContext.dateFormat && userContext.dateFormat !== "YYYY-MM-DD") {
      prefs.push(`Date format: ${userContext.dateFormat}`);
    }

    if (prefs.length > 0) {
      contextParts.push(`PREFERENCES:\n${prefs.join("\n")}`);
    }
  }

  // Long-term memories
  if (memories.preferences.length > 0) {
    const prefMemories = memories.preferences.map((m) => `- ${m.key}: ${m.value}`);
    contextParts.push(`LEARNED PREFERENCES:\n${prefMemories.join("\n")}`);
  }

  if (memories.facts.length > 0) {
    const factMemories = memories.facts.map((m) => `- ${m.key}: ${m.value}`);
    contextParts.push(`KNOWN FACTS:\n${factMemories.join("\n")}`);
  }

  if (memories.instructions.length > 0) {
    const instructionMemories = memories.instructions.map((m) => `- ${m.value}`);
    contextParts.push(`USER INSTRUCTIONS:\n${instructionMemories.join("\n")}`);
  }

  if (memories.patterns.length > 0) {
    const patternMemories = memories.patterns.map((m) => `- ${m.key}: ${m.value}`);
    contextParts.push(`OBSERVED PATTERNS:\n${patternMemories.join("\n")}`);
  }

  // Track memory usage for all memories included in context (fire-and-forget)
  const allMemories = [
    ...memories.preferences,
    ...memories.facts,
    ...memories.instructions,
    ...memories.patterns,
  ];
  if (allMemories.length > 0) {
    // Don't await - tracking is best-effort and shouldn't slow down context building
    Promise.allSettled(
      allMemories.map((m) => incrementMemoryUsage(m.id))
    ).catch((err) => {
      logger.warn({ error: err }, "Failed to track memory usage");
    });
  }

  return contextParts.join("\n\n");
}

export const agentMemoryService = {
  // Session memory
  getOrCreateSession,
  getSessionMessages,
  saveMessage,
  updateSessionTitle,
  completeSession,
  getRecentSessions,

  // Long-term memory
  storeMemory,
  getMemoriesByCategory,
  searchMemories,
  searchMemoriesSemantic,
  findSimilarMemories,
  getRelevantMemories,
  incrementMemoryUsage,

  // User context
  getUserContext,
  upsertUserContext,
  buildAgentContext,
};
