import { db } from "@open-bookkeeping/db";
import {
  agentSessions,
  agentMessages,
  agentMemories,
  agentUserContext,
} from "@open-bookkeeping/db";
import { eq, and, desc, sql, isNull, or, ilike } from "drizzle-orm";
import { createLogger } from "@open-bookkeeping/shared";

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

      if (existing.length > 0) {
        const messages = await getSessionMessages(sessionId);
        return {
          id: existing[0].id,
          title: existing[0].title ?? undefined,
          status: existing[0].status as Session["status"],
          messages,
          summary: existing[0].summary ?? undefined,
          systemContext: existing[0].systemContext as Session["systemContext"],
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
    logger.error({ error, sessionId }, "Failed to get session messages");
    return [];
  }
}

/**
 * Save a message to the session
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
    logger.error({ error, sessionId }, "Failed to save message");
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
    logger.error({ error, userId }, "Failed to get recent sessions");
    return [];
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
 * Store a new memory
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
    // Check for existing memory with same key
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

    if (existing.length > 0) {
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
        .where(eq(agentMemories.id, existing[0].id))
        .returning();

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
 * Search memories by key or value
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

/**
 * Get all relevant memories for context building
 */
export async function getRelevantMemories(
  userId: string
): Promise<{ preferences: Memory[]; facts: Memory[]; patterns: Memory[]; instructions: Memory[] }> {
  try {
    const [preferences, facts, patterns, instructions] = await Promise.all([
      getMemoriesByCategory(userId, "preference"),
      getMemoriesByCategory(userId, "fact"),
      getMemoriesByCategory(userId, "pattern"),
      getMemoriesByCategory(userId, "instruction"),
    ]);

    return { preferences, facts, patterns, instructions };
  } catch (error) {
    logger.error({ error, userId }, "Failed to get relevant memories");
    return { preferences: [], facts: [], patterns: [], instructions: [] };
  }
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
 */
export async function buildAgentContext(userId: string): Promise<string> {
  try {
    const [userContext, memories] = await Promise.all([
      getUserContext(userId),
      getRelevantMemories(userId),
    ]);

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

    return contextParts.join("\n\n");
  } catch (error) {
    logger.error({ error, userId }, "Failed to build agent context");
    return "";
  }
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
  getRelevantMemories,
  incrementMemoryUsage,

  // User context
  getUserContext,
  upsertUserContext,
  buildAgentContext,
};
