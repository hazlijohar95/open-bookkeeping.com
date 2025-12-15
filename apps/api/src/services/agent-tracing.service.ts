/**
 * Agent Tracing Service
 *
 * Lightweight distributed tracing for AI agent operations.
 * Follows OpenTelemetry conventions for easy export to any backend.
 *
 * Features:
 * - Trace spans for LLM calls, tool executions, and context retrieval
 * - Token usage tracking
 * - Latency measurement
 * - Error classification
 * - Can export to database or external services (Langfuse, etc.)
 */

import { db } from "@open-bookkeeping/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@open-bookkeeping/shared";
import { randomUUID } from "crypto";

const logger = createLogger("agent-tracing-service");

// ============================================
// TYPES
// ============================================

export type SpanKind = "llm" | "tool" | "retrieval" | "chain" | "agent" | "embedding";
export type SpanStatus = "ok" | "error" | "unset";

export interface SpanAttributes {
  // LLM-specific
  "llm.model"?: string;
  "llm.provider"?: string;
  "llm.prompt_tokens"?: number;
  "llm.completion_tokens"?: number;
  "llm.total_tokens"?: number;
  "llm.temperature"?: number;
  "llm.max_tokens"?: number;
  "llm.stop_reason"?: string;

  // Tool-specific
  "tool.name"?: string;
  "tool.version"?: string;
  "tool.input"?: Record<string, unknown>;
  "tool.output"?: unknown;
  "tool.approval_required"?: boolean;
  "tool.approval_status"?: "approved" | "rejected" | "pending" | "auto";

  // Retrieval-specific
  "retrieval.query"?: string;
  "retrieval.results_count"?: number;
  "retrieval.source"?: string;

  // Error-specific
  "error.type"?: string;
  "error.message"?: string;
  "error.code"?: string;
  "error.recoverable"?: boolean;

  // Cost-specific
  "cost.amount"?: number;
  "cost.currency"?: string;

  // Custom attributes
  [key: string]: unknown;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  status: SpanStatus;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  attributes: SpanAttributes;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes?: Record<string, unknown>;
}

export interface Trace {
  id: string;
  userId: string;
  sessionId?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: SpanStatus;
  spans: Span[];
  metadata?: {
    userMessage?: string;
    assistantResponse?: string;
    totalTokens?: number;
    totalCost?: number;
    toolsUsed?: string[];
    errorCount?: number;
  };
}

// ============================================
// IN-MEMORY TRACE STORAGE (for active traces)
// ============================================

const activeTraces = new Map<string, Trace>();
const activeSpans = new Map<string, Span>();

// ============================================
// CORE TRACING FUNCTIONS
// ============================================

/**
 * Start a new trace (represents a full conversation turn)
 */
export function startTrace(
  userId: string,
  name: string,
  options?: {
    sessionId?: string;
    userMessage?: string;
  }
): Trace {
  const trace: Trace = {
    id: randomUUID(),
    userId,
    sessionId: options?.sessionId,
    name,
    startTime: new Date(),
    status: "unset",
    spans: [],
    metadata: {
      userMessage: options?.userMessage,
      toolsUsed: [],
      errorCount: 0,
    },
  };

  activeTraces.set(trace.id, trace);
  logger.debug({ traceId: trace.id, name }, "Trace started");

  return trace;
}

/**
 * Start a new span within a trace
 */
export function startSpan(
  traceId: string,
  name: string,
  kind: SpanKind,
  options?: {
    parentSpanId?: string;
    attributes?: SpanAttributes;
  }
): Span {
  const span: Span = {
    traceId,
    spanId: randomUUID(),
    parentSpanId: options?.parentSpanId,
    name,
    kind,
    status: "unset",
    startTime: new Date(),
    attributes: options?.attributes ?? {},
    events: [],
  };

  activeSpans.set(span.spanId, span);

  const trace = activeTraces.get(traceId);
  if (trace) {
    trace.spans.push(span);
  }

  logger.debug({ traceId, spanId: span.spanId, name, kind }, "Span started");

  return span;
}

/**
 * Add an event to a span
 */
export function addSpanEvent(
  spanId: string,
  name: string,
  attributes?: Record<string, unknown>
): void {
  const span = activeSpans.get(spanId);
  if (span) {
    span.events.push({
      name,
      timestamp: new Date(),
      attributes,
    });
  }
}

/**
 * Set span attributes
 */
export function setSpanAttributes(
  spanId: string,
  attributes: Partial<SpanAttributes>
): void {
  const span = activeSpans.get(spanId);
  if (span) {
    span.attributes = { ...span.attributes, ...attributes };
  }
}

/**
 * End a span
 */
export function endSpan(
  spanId: string,
  options?: {
    status?: SpanStatus;
    error?: Error;
    attributes?: Partial<SpanAttributes>;
  }
): Span | undefined {
  const span = activeSpans.get(spanId);
  if (!span) {
    logger.warn({ spanId }, "Attempted to end non-existent span");
    return undefined;
  }

  span.endTime = new Date();
  span.durationMs = span.endTime.getTime() - span.startTime.getTime();

  if (options?.status) {
    span.status = options.status;
  } else if (options?.error) {
    span.status = "error";
  } else {
    span.status = "ok";
  }

  if (options?.error) {
    span.attributes["error.type"] = options.error.name;
    span.attributes["error.message"] = options.error.message;
  }

  if (options?.attributes) {
    span.attributes = { ...span.attributes, ...options.attributes };
  }

  // Update trace metadata for tool spans
  if (span.kind === "tool" && span.attributes["tool.name"]) {
    const trace = activeTraces.get(span.traceId);
    if (trace && trace.metadata?.toolsUsed) {
      const toolName = span.attributes["tool.name"] as string;
      if (!trace.metadata.toolsUsed.includes(toolName)) {
        trace.metadata.toolsUsed.push(toolName);
      }
    }
    if (trace && span.status === "error" && trace.metadata) {
      trace.metadata.errorCount = (trace.metadata.errorCount ?? 0) + 1;
    }
  }

  activeSpans.delete(spanId);
  logger.debug(
    { spanId, status: span.status, durationMs: span.durationMs },
    "Span ended"
  );

  return span;
}

/**
 * End a trace and persist to database
 */
export async function endTrace(
  traceId: string,
  options?: {
    status?: SpanStatus;
    assistantResponse?: string;
    totalTokens?: number;
    totalCost?: number;
  }
): Promise<Trace | undefined> {
  const trace = activeTraces.get(traceId);
  if (!trace) {
    logger.warn({ traceId }, "Attempted to end non-existent trace");
    return undefined;
  }

  trace.endTime = new Date();
  trace.durationMs = trace.endTime.getTime() - trace.startTime.getTime();

  // Determine overall status from spans
  if (options?.status) {
    trace.status = options.status;
  } else {
    const hasError = trace.spans.some((s) => s.status === "error");
    trace.status = hasError ? "error" : "ok";
  }

  // Update metadata
  if (trace.metadata) {
    if (options?.assistantResponse) {
      trace.metadata.assistantResponse = options.assistantResponse;
    }
    if (options?.totalTokens) {
      trace.metadata.totalTokens = options.totalTokens;
    }
    if (options?.totalCost) {
      trace.metadata.totalCost = options.totalCost;
    }
  }

  // Persist to database
  try {
    await persistTrace(trace);
    logger.debug(
      { traceId, status: trace.status, durationMs: trace.durationMs, spanCount: trace.spans.length },
      "Trace ended and persisted"
    );
  } catch (error) {
    logger.error({ error, traceId }, "Failed to persist trace");
  }

  activeTraces.delete(traceId);

  return trace;
}

// ============================================
// PERSISTENCE
// ============================================

/**
 * Persist a trace to the database
 */
async function persistTrace(trace: Trace): Promise<void> {
  try {
    // Store in agent_traces table (will create if not exists)
    await db.execute(sql`
      INSERT INTO agent_traces (
        id, user_id, session_id, name, start_time, end_time,
        duration_ms, status, spans, metadata, created_at
      ) VALUES (
        ${trace.id}::uuid,
        ${trace.userId}::uuid,
        ${trace.sessionId ?? null}::uuid,
        ${trace.name},
        ${trace.startTime.toISOString()}::timestamp,
        ${trace.endTime?.toISOString() ?? null}::timestamp,
        ${trace.durationMs ?? null},
        ${trace.status},
        ${JSON.stringify(trace.spans)}::jsonb,
        ${JSON.stringify(trace.metadata)}::jsonb,
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        end_time = EXCLUDED.end_time,
        duration_ms = EXCLUDED.duration_ms,
        status = EXCLUDED.status,
        spans = EXCLUDED.spans,
        metadata = EXCLUDED.metadata
    `);
  } catch (error) {
    // If table doesn't exist, log but don't fail (tracing is optional)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("does not exist")) {
      logger.warn("agent_traces table not found - run migrations to enable tracing persistence");
    } else {
      throw error;
    }
  }
}

// ============================================
// QUERY FUNCTIONS
// ============================================

export interface TraceQuery {
  userId: string;
  sessionId?: string;
  status?: SpanStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Query traces from the database
 */
export async function queryTraces(query: TraceQuery): Promise<Trace[]> {
  try {
    const conditions: string[] = [`user_id = '${query.userId}'`];

    if (query.sessionId) {
      conditions.push(`session_id = '${query.sessionId}'`);
    }
    if (query.status) {
      conditions.push(`status = '${query.status}'`);
    }
    if (query.startDate) {
      conditions.push(`start_time >= '${query.startDate.toISOString()}'`);
    }
    if (query.endDate) {
      conditions.push(`end_time <= '${query.endDate.toISOString()}'`);
    }

    const whereClause = conditions.join(" AND ");
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const result = await db.execute(sql.raw(`
      SELECT * FROM agent_traces
      WHERE ${whereClause}
      ORDER BY start_time DESC
      LIMIT ${limit} OFFSET ${offset}
    `));

    return (result as unknown as Array<{
      id: string;
      user_id: string;
      session_id: string | null;
      name: string;
      start_time: string;
      end_time: string | null;
      duration_ms: number | null;
      status: SpanStatus;
      spans: Span[];
      metadata: Trace["metadata"];
    }>).map((row) => ({
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id ?? undefined,
      name: row.name,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      durationMs: row.duration_ms ?? undefined,
      status: row.status,
      spans: row.spans,
      metadata: row.metadata,
    }));
  } catch (error) {
    logger.error({ error, query }, "Failed to query traces");
    return [];
  }
}

/**
 * Get trace by ID
 */
export async function getTraceById(
  traceId: string,
  userId: string
): Promise<Trace | null> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM agent_traces
      WHERE id = ${traceId}::uuid AND user_id = ${userId}::uuid
      LIMIT 1
    `);

    const rows = result as unknown as Array<{
      id: string;
      user_id: string;
      session_id: string | null;
      name: string;
      start_time: string;
      end_time: string | null;
      duration_ms: number | null;
      status: SpanStatus;
      spans: Span[];
      metadata: Trace["metadata"];
    }>;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0]!;
    return {
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id ?? undefined,
      name: row.name,
      startTime: new Date(row.start_time),
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      durationMs: row.duration_ms ?? undefined,
      status: row.status,
      spans: row.spans,
      metadata: row.metadata,
    };
  } catch (error) {
    logger.error({ error, traceId }, "Failed to get trace by ID");
    return null;
  }
}

// ============================================
// ANALYTICS
// ============================================

export interface TracingStats {
  totalTraces: number;
  successRate: number;
  avgDurationMs: number;
  avgTokensPerTrace: number;
  totalCost: number;
  topTools: Array<{ name: string; count: number; avgDurationMs: number }>;
  errorBreakdown: Array<{ type: string; count: number }>;
}

/**
 * Get tracing statistics for a user
 */
export async function getTracingStats(
  userId: string,
  options?: { startDate?: Date; endDate?: Date }
): Promise<TracingStats> {
  try {
    const conditions: string[] = [`user_id = '${userId}'`];

    if (options?.startDate) {
      conditions.push(`start_time >= '${options.startDate.toISOString()}'`);
    }
    if (options?.endDate) {
      conditions.push(`end_time <= '${options.endDate.toISOString()}'`);
    }

    const whereClause = conditions.join(" AND ");

    // Get aggregate stats
    const statsResult = await db.execute(sql.raw(`
      SELECT
        COUNT(*) as total_traces,
        COUNT(*) FILTER (WHERE status = 'ok') as success_count,
        AVG(duration_ms) as avg_duration,
        SUM((metadata->>'totalTokens')::int) as total_tokens,
        SUM((metadata->>'totalCost')::numeric) as total_cost
      FROM agent_traces
      WHERE ${whereClause}
    `));

    const stats = (statsResult as unknown as Array<{
      total_traces: string;
      success_count: string;
      avg_duration: string;
      total_tokens: string;
      total_cost: string;
    }>)[0];

    const totalTraces = parseInt(stats?.total_traces ?? "0", 10);
    const successCount = parseInt(stats?.success_count ?? "0", 10);
    const avgDurationMs = parseFloat(stats?.avg_duration ?? "0");
    const totalTokens = parseInt(stats?.total_tokens ?? "0", 10);
    const totalCost = parseFloat(stats?.total_cost ?? "0");

    // Get tool usage stats (simplified - would need proper JSON parsing in production)
    const topTools: TracingStats["topTools"] = [];
    const errorBreakdown: TracingStats["errorBreakdown"] = [];

    return {
      totalTraces,
      successRate: totalTraces > 0 ? (successCount / totalTraces) * 100 : 0,
      avgDurationMs,
      avgTokensPerTrace: totalTraces > 0 ? totalTokens / totalTraces : 0,
      totalCost,
      topTools,
      errorBreakdown,
    };
  } catch (error) {
    logger.error({ error, userId }, "Failed to get tracing stats");
    return {
      totalTraces: 0,
      successRate: 0,
      avgDurationMs: 0,
      avgTokensPerTrace: 0,
      totalCost: 0,
      topTools: [],
      errorBreakdown: [],
    };
  }
}

// ============================================
// HELPER FUNCTIONS FOR COMMON OPERATIONS
// ============================================

/**
 * Trace an LLM call
 */
export function traceLLMCall(
  traceId: string,
  model: string,
  parentSpanId?: string
): {
  span: Span;
  complete: (result: {
    promptTokens: number;
    completionTokens: number;
    stopReason?: string;
    error?: Error;
  }) => void;
} {
  const span = startSpan(traceId, `llm.${model}`, "llm", {
    parentSpanId,
    attributes: {
      "llm.model": model,
      "llm.provider": model.startsWith("gpt") ? "openai" : "anthropic",
    },
  });

  return {
    span,
    complete: (result) => {
      const cost = calculateLLMCost(model, result.promptTokens, result.completionTokens);
      endSpan(span.spanId, {
        status: result.error ? "error" : "ok",
        error: result.error,
        attributes: {
          "llm.prompt_tokens": result.promptTokens,
          "llm.completion_tokens": result.completionTokens,
          "llm.total_tokens": result.promptTokens + result.completionTokens,
          "llm.stop_reason": result.stopReason,
          "cost.amount": cost,
          "cost.currency": "USD",
        },
      });
    },
  };
}

/**
 * Trace a tool execution
 */
export function traceToolCall(
  traceId: string,
  toolName: string,
  input: Record<string, unknown>,
  parentSpanId?: string,
  version?: string
): {
  span: Span;
  complete: (result: {
    output?: unknown;
    error?: Error;
    approvalStatus?: "approved" | "rejected" | "pending" | "auto";
  }) => void;
} {
  const span = startSpan(traceId, `tool.${toolName}`, "tool", {
    parentSpanId,
    attributes: {
      "tool.name": toolName,
      "tool.version": version ?? "1.0.0",
      "tool.input": input,
    },
  });

  return {
    span,
    complete: (result) => {
      endSpan(span.spanId, {
        status: result.error ? "error" : "ok",
        error: result.error,
        attributes: {
          "tool.output": result.output,
          "tool.approval_status": result.approvalStatus ?? "auto",
        },
      });
    },
  };
}

/**
 * Trace a retrieval operation (memory, context)
 */
export function traceRetrieval(
  traceId: string,
  source: string,
  query: string,
  parentSpanId?: string
): {
  span: Span;
  complete: (result: { resultsCount: number; error?: Error }) => void;
} {
  const span = startSpan(traceId, `retrieval.${source}`, "retrieval", {
    parentSpanId,
    attributes: {
      "retrieval.query": query,
      "retrieval.source": source,
    },
  });

  return {
    span,
    complete: (result) => {
      endSpan(span.spanId, {
        status: result.error ? "error" : "ok",
        error: result.error,
        attributes: {
          "retrieval.results_count": result.resultsCount,
        },
      });
    },
  };
}

// ============================================
// COST CALCULATION
// ============================================

// Pricing per 1M tokens (as of late 2024) - update as needed
const LLM_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "claude-3-opus": { input: 15, output: 75 },
  "claude-3-sonnet": { input: 3, output: 15 },
  "claude-3-haiku": { input: 0.25, output: 1.25 },
  "claude-3-5-sonnet": { input: 3, output: 15 },
};

function calculateLLMCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Find matching pricing
  const modelKey = Object.keys(LLM_PRICING).find((key) =>
    model.toLowerCase().includes(key.toLowerCase())
  );

  if (!modelKey) {
    // Default to gpt-4o-mini pricing if unknown
    const defaultPricing = LLM_PRICING["gpt-4o-mini"]!;
    return (
      (promptTokens / 1_000_000) * defaultPricing.input +
      (completionTokens / 1_000_000) * defaultPricing.output
    );
  }

  const pricing = LLM_PRICING[modelKey]!;
  return (
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output
  );
}

// ============================================
// EXPORTS
// ============================================

export const agentTracingService = {
  // Core tracing
  startTrace,
  startSpan,
  addSpanEvent,
  setSpanAttributes,
  endSpan,
  endTrace,

  // Query
  queryTraces,
  getTraceById,
  getTracingStats,

  // Helpers
  traceLLMCall,
  traceToolCall,
  traceRetrieval,
};
