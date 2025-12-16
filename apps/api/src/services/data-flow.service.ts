/**
 * Data Flow Service
 * Provides unified access to all audit logs (agent, user, admin) for the Data Flow Explorer
 * Supports real-time monitoring, educational content, and debugging capabilities
 */

import { eq, and, desc, gte, lte, sql, or, inArray } from "drizzle-orm";
import { db, agentAuditLogs, userAuditLogs, agentActionTypeEnum, userActionTypeEnum } from "@open-bookkeeping/db";

// Derive action types from enum definitions
type AgentActionType = (typeof agentActionTypeEnum.enumValues)[number];
type UserActionType = (typeof userActionTypeEnum.enumValues)[number];

// ============================================
// TYPES
// ============================================

export type EventSource = "agent" | "user" | "admin";

export interface UnifiedEvent {
  id: string;
  source: EventSource;
  timestamp: Date;
  action: string;
  resourceType: string;
  resourceId?: string;
  description: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  success: boolean;
  metadata: {
    reasoning?: string;
    confidence?: number;
    riskLevel?: "low" | "medium" | "high" | "critical";
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    category?: string;
  };
  financialImpact?: {
    amount: number;
    currency: string;
    direction: "increase" | "decrease" | "neutral";
    accountsAffected?: string[];
  };
}

export interface EventFilters {
  sources?: EventSource[];
  resourceTypes?: string[];
  actionTypes?: string[];
  startDate?: string;
  endDate?: string;
  lastMinutes?: number;
  limit?: number;
  cursor?: string;
}

export interface FlowNode {
  id: string;
  name: string;
  type: "source" | "resource" | "destination";
  category: string;
  color: string;
  count: number;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
  actions: string[];
}

export interface FlowStatistics {
  nodes: FlowNode[];
  links: FlowLink[];
  summary: {
    totalEvents: number;
    bySource: Record<string, number>;
    byResourceType: Record<string, number>;
    byAction: Record<string, number>;
    timeRange: {
      start: Date;
      end: Date;
    };
  };
}

// ============================================
// HELPERS
// ============================================

function formatAgentAction(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getResourceCategory(resourceType: string): string {
  const categories: Record<string, string> = {
    invoice: "sales",
    quotation: "sales",
    credit_note: "sales",
    debit_note: "sales",
    customer: "contacts",
    bill: "purchases",
    vendor: "contacts",
    journal_entry: "accounting",
    account: "accounting",
    ledger: "accounting",
    fixed_asset: "accounting",
    bank_transaction: "accounting",
    payment: "accounting",
    // User audit categories
    auth: "security",
    settings: "settings",
    api_key: "security",
    webhook: "integrations",
    export: "reporting",
  };
  return categories[resourceType] ?? "other";
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    sales: "#10b981",
    purchases: "#f59e0b",
    contacts: "#3b82f6",
    accounting: "#8b5cf6",
    security: "#ef4444",
    settings: "#6b7280",
    integrations: "#06b6d4",
    reporting: "#ec4899",
    other: "#9ca3af",
  };
  return colors[category] ?? "#9ca3af";
}

// ============================================
// SERVICE
// ============================================

export const dataFlowService = {
  /**
   * Get unified events from all audit sources
   * Returns events sorted by timestamp (newest first)
   */
  async getEvents(userId: string, filters: EventFilters = {}): Promise<{
    events: UnifiedEvent[];
    hasMore: boolean;
    nextCursor?: string;
  }> {
    const {
      sources = ["agent", "user"],
      resourceTypes,
      actionTypes,
      startDate,
      endDate,
      lastMinutes,
      limit = 50,
      cursor,
    } = filters;

    // Calculate date range
    let effectiveStartDate: Date | undefined;
    let effectiveEndDate: Date | undefined;

    if (lastMinutes) {
      effectiveStartDate = new Date(Date.now() - lastMinutes * 60 * 1000);
      effectiveEndDate = new Date();
    } else {
      if (startDate) effectiveStartDate = new Date(startDate);
      if (endDate) effectiveEndDate = new Date(endDate);
    }

    // Parse cursor for pagination
    let cursorTimestamp: Date | undefined;
    if (cursor) {
      cursorTimestamp = new Date(cursor);
    }

    const events: UnifiedEvent[] = [];

    // Fetch from agent audit logs
    if (sources.includes("agent")) {
      const agentEvents = await this.getAgentEvents(userId, {
        resourceTypes,
        actionTypes,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        cursorTimestamp,
        limit: limit + 1,
      });
      events.push(...agentEvents);
    }

    // Fetch from user audit logs
    if (sources.includes("user")) {
      const userEvents = await this.getUserEvents(userId, {
        resourceTypes,
        actionTypes,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
        cursorTimestamp,
        limit: limit + 1,
      });
      events.push(...userEvents);
    }

    // Sort all events by timestamp (newest first)
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Check if there are more results and slice to limit
    const hasMore = events.length > limit;
    const slicedEvents = events.slice(0, limit);

    // Calculate next cursor
    const nextCursor = hasMore && slicedEvents.length > 0
      ? slicedEvents[slicedEvents.length - 1]!.timestamp.toISOString()
      : undefined;

    return {
      events: slicedEvents,
      hasMore,
      nextCursor,
    };
  },

  /**
   * Get events from agent audit logs
   */
  async getAgentEvents(
    userId: string,
    options: {
      resourceTypes?: string[];
      actionTypes?: string[];
      startDate?: Date;
      endDate?: Date;
      cursorTimestamp?: Date;
      limit: number;
    }
  ): Promise<UnifiedEvent[]> {
    const conditions = [eq(agentAuditLogs.userId, userId)];

    if (options.startDate) {
      conditions.push(gte(agentAuditLogs.createdAt, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(agentAuditLogs.createdAt, options.endDate));
    }
    if (options.cursorTimestamp) {
      conditions.push(lte(agentAuditLogs.createdAt, options.cursorTimestamp));
    }
    if (options.resourceTypes && options.resourceTypes.length > 0) {
      conditions.push(
        or(...options.resourceTypes.map((rt) => eq(agentAuditLogs.resourceType, rt)))!
      );
    }
    if (options.actionTypes && options.actionTypes.length > 0) {
      // Cast to enum type for type safety
      conditions.push(
        inArray(agentAuditLogs.action, options.actionTypes as AgentActionType[])
      );
    }

    const logs = await db.query.agentAuditLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(agentAuditLogs.createdAt)],
      limit: options.limit,
    });

    return logs.map((log) => ({
      id: log.id,
      source: "agent" as const,
      timestamp: log.createdAt,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId ?? undefined,
      description: `${formatAgentAction(log.action)} ${log.resourceType}${log.resourceId ? ` (${log.resourceId.slice(0, 8)}...)` : ""}`,
      previousState: (log.previousState as Record<string, unknown>) ?? undefined,
      newState: (log.newState as Record<string, unknown>) ?? undefined,
      success: log.success === "yes",
      metadata: {
        reasoning: log.reasoning ?? undefined,
        confidence: log.confidence ? parseFloat(log.confidence) : undefined,
        ipAddress: log.ipAddress ?? undefined,
        userAgent: log.userAgent ?? undefined,
        sessionId: log.sessionId ?? undefined,
      },
      financialImpact: log.financialImpact
        ? {
            amount: (log.financialImpact as { amount?: number }).amount ?? 0,
            currency: (log.financialImpact as { currency?: string }).currency ?? "MYR",
            direction: (log.financialImpact as { direction?: "increase" | "decrease" | "neutral" }).direction ?? "neutral",
            accountsAffected: (log.financialImpact as { accountsAffected?: string[] }).accountsAffected,
          }
        : undefined,
    }));
  },

  /**
   * Get events from user audit logs
   */
  async getUserEvents(
    userId: string,
    options: {
      resourceTypes?: string[];
      actionTypes?: string[];
      startDate?: Date;
      endDate?: Date;
      cursorTimestamp?: Date;
      limit: number;
    }
  ): Promise<UnifiedEvent[]> {
    const conditions = [eq(userAuditLogs.userId, userId)];

    if (options.startDate) {
      conditions.push(gte(userAuditLogs.createdAt, options.startDate));
    }
    if (options.endDate) {
      conditions.push(lte(userAuditLogs.createdAt, options.endDate));
    }
    if (options.cursorTimestamp) {
      conditions.push(lte(userAuditLogs.createdAt, options.cursorTimestamp));
    }
    if (options.actionTypes && options.actionTypes.length > 0) {
      // Cast to enum type for type safety
      conditions.push(
        inArray(userAuditLogs.action, options.actionTypes as UserActionType[])
      );
    }

    const logs = await db.query.userAuditLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(userAuditLogs.createdAt)],
      limit: options.limit,
    });

    return logs.map((log) => ({
      id: log.id,
      source: "user" as const,
      timestamp: log.createdAt,
      action: log.action,
      resourceType: log.category,
      resourceId: log.resourceId ?? undefined,
      description: log.description ?? formatAgentAction(log.action),
      previousState: (log.previousState as Record<string, unknown>) ?? undefined,
      newState: (log.newState as Record<string, unknown>) ?? undefined,
      success: log.success === "yes",
      metadata: {
        riskLevel: log.riskLevel as "low" | "medium" | "high" | "critical" | undefined,
        ipAddress: log.ipAddress ?? undefined,
        userAgent: log.userAgent ?? undefined,
        sessionId: log.sessionId ?? undefined,
        category: log.category,
      },
    }));
  },

  /**
   * Get flow statistics for Sankey diagram visualization
   */
  async getFlowStats(userId: string, filters: EventFilters = {}): Promise<FlowStatistics> {
    const { events } = await this.getEvents(userId, {
      ...filters,
      limit: 1000, // Get more events for statistics
    });

    // Build statistics
    const bySource: Record<string, number> = {};
    const byResourceType: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const flowCounts: Record<string, { count: number; actions: Set<string> }> = {};

    for (const event of events) {
      // Count by source
      bySource[event.source] = (bySource[event.source] ?? 0) + 1;

      // Count by resource type
      byResourceType[event.resourceType] = (byResourceType[event.resourceType] ?? 0) + 1;

      // Count by action
      byAction[event.action] = (byAction[event.action] ?? 0) + 1;

      // Build flow links (source -> resource type)
      const linkKey = `${event.source}:${event.resourceType}`;
      if (!flowCounts[linkKey]) {
        flowCounts[linkKey] = { count: 0, actions: new Set() };
      }
      flowCounts[linkKey]!.count++;
      flowCounts[linkKey]!.actions.add(event.action);
    }

    // Build nodes
    const nodes: FlowNode[] = [];

    // Source nodes
    for (const [source, count] of Object.entries(bySource)) {
      const colors: Record<string, string> = {
        agent: "#a855f7",
        user: "#3b82f6",
        admin: "#ef4444",
      };
      nodes.push({
        id: `source:${source}`,
        name: source === "agent" ? "AI Agent" : source === "user" ? "User" : "Admin",
        type: "source",
        category: "sources",
        color: colors[source] ?? "#9ca3af",
        count,
      });
    }

    // Resource type nodes
    for (const [resourceType, count] of Object.entries(byResourceType)) {
      const category = getResourceCategory(resourceType);
      nodes.push({
        id: `resource:${resourceType}`,
        name: formatAgentAction(resourceType),
        type: "resource",
        category,
        color: getCategoryColor(category),
        count,
      });
    }

    // Build links
    const links: FlowLink[] = [];
    for (const [linkKey, data] of Object.entries(flowCounts)) {
      const [source, resourceType] = linkKey.split(":");
      if (source && resourceType) {
        links.push({
          source: `source:${source}`,
          target: `resource:${resourceType}`,
          value: data.count,
          actions: Array.from(data.actions),
        });
      }
    }

    // Calculate time range
    const timestamps = events.map((e) => e.timestamp.getTime());
    const timeRange = {
      start: new Date(Math.min(...timestamps, Date.now())),
      end: new Date(Math.max(...timestamps, Date.now())),
    };

    return {
      nodes,
      links,
      summary: {
        totalEvents: events.length,
        bySource,
        byResourceType,
        byAction,
        timeRange,
      },
    };
  },

  /**
   * Get event by ID
   */
  async getEventById(
    userId: string,
    eventId: string,
    source: EventSource
  ): Promise<UnifiedEvent | null> {
    if (source === "agent") {
      const log = await db.query.agentAuditLogs.findFirst({
        where: and(
          eq(agentAuditLogs.id, eventId),
          eq(agentAuditLogs.userId, userId)
        ),
      });

      if (!log) return null;

      return {
        id: log.id,
        source: "agent",
        timestamp: log.createdAt,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId ?? undefined,
        description: `${formatAgentAction(log.action)} ${log.resourceType}`,
        previousState: (log.previousState as Record<string, unknown>) ?? undefined,
        newState: (log.newState as Record<string, unknown>) ?? undefined,
        success: log.success === "yes",
        metadata: {
          reasoning: log.reasoning ?? undefined,
          confidence: log.confidence ? parseFloat(log.confidence) : undefined,
          ipAddress: log.ipAddress ?? undefined,
          userAgent: log.userAgent ?? undefined,
          sessionId: log.sessionId ?? undefined,
        },
        financialImpact: log.financialImpact
          ? {
              amount: (log.financialImpact as { amount?: number }).amount ?? 0,
              currency: (log.financialImpact as { currency?: string }).currency ?? "MYR",
              direction: (log.financialImpact as { direction?: "increase" | "decrease" | "neutral" }).direction ?? "neutral",
              accountsAffected: (log.financialImpact as { accountsAffected?: string[] }).accountsAffected,
            }
          : undefined,
      };
    }

    if (source === "user") {
      const log = await db.query.userAuditLogs.findFirst({
        where: and(
          eq(userAuditLogs.id, eventId),
          eq(userAuditLogs.userId, userId)
        ),
      });

      if (!log) return null;

      return {
        id: log.id,
        source: "user",
        timestamp: log.createdAt,
        action: log.action,
        resourceType: log.category,
        resourceId: log.resourceId ?? undefined,
        description: log.description ?? formatAgentAction(log.action),
        previousState: (log.previousState as Record<string, unknown>) ?? undefined,
        newState: (log.newState as Record<string, unknown>) ?? undefined,
        success: log.success === "yes",
        metadata: {
          riskLevel: log.riskLevel as "low" | "medium" | "high" | "critical" | undefined,
          ipAddress: log.ipAddress ?? undefined,
          userAgent: log.userAgent ?? undefined,
          sessionId: log.sessionId ?? undefined,
          category: log.category,
        },
      };
    }

    return null;
  },

  /**
   * Get available filter options (for dropdown menus)
   */
  async getFilterOptions(userId: string): Promise<{
    resourceTypes: string[];
    actionTypes: string[];
  }> {
    // Get distinct resource types from agent logs
    const agentResourceTypes = await db
      .selectDistinct({ resourceType: agentAuditLogs.resourceType })
      .from(agentAuditLogs)
      .where(eq(agentAuditLogs.userId, userId));

    // Get distinct categories from user logs
    const userCategories = await db
      .selectDistinct({ category: userAuditLogs.category })
      .from(userAuditLogs)
      .where(eq(userAuditLogs.userId, userId));

    // Get distinct actions from agent logs
    const agentActions = await db
      .selectDistinct({ action: agentAuditLogs.action })
      .from(agentAuditLogs)
      .where(eq(agentAuditLogs.userId, userId));

    // Get distinct actions from user logs
    const userActions = await db
      .selectDistinct({ action: userAuditLogs.action })
      .from(userAuditLogs)
      .where(eq(userAuditLogs.userId, userId));

    const resourceTypes = [
      ...new Set([
        ...agentResourceTypes.map((r) => r.resourceType),
        ...userCategories.map((c) => c.category),
      ]),
    ].sort();

    const actionTypes = [
      ...new Set([
        ...agentActions.map((a) => a.action),
        ...userActions.map((a) => a.action),
      ]),
    ].sort();

    return { resourceTypes, actionTypes };
  },

  /**
   * Get real-time summary for header stats
   */
  async getRealtimeSummary(userId: string): Promise<{
    last5Min: number;
    last1Hour: number;
    last24Hours: number;
    lastEventAt?: Date;
  }> {
    const now = new Date();
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      agentLast5Min,
      agentLast1Hour,
      agentLast24Hours,
      userLast5Min,
      userLast1Hour,
      userLast24Hours,
      lastAgentEvent,
      lastUserEvent,
    ] = await Promise.all([
      // Agent counts
      db
        .select({ count: sql<number>`count(*)` })
        .from(agentAuditLogs)
        .where(and(eq(agentAuditLogs.userId, userId), gte(agentAuditLogs.createdAt, fiveMinAgo))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(agentAuditLogs)
        .where(and(eq(agentAuditLogs.userId, userId), gte(agentAuditLogs.createdAt, oneHourAgo))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(agentAuditLogs)
        .where(and(eq(agentAuditLogs.userId, userId), gte(agentAuditLogs.createdAt, twentyFourHoursAgo))),
      // User counts
      db
        .select({ count: sql<number>`count(*)` })
        .from(userAuditLogs)
        .where(and(eq(userAuditLogs.userId, userId), gte(userAuditLogs.createdAt, fiveMinAgo))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(userAuditLogs)
        .where(and(eq(userAuditLogs.userId, userId), gte(userAuditLogs.createdAt, oneHourAgo))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(userAuditLogs)
        .where(and(eq(userAuditLogs.userId, userId), gte(userAuditLogs.createdAt, twentyFourHoursAgo))),
      // Last events
      db.query.agentAuditLogs.findFirst({
        where: eq(agentAuditLogs.userId, userId),
        orderBy: [desc(agentAuditLogs.createdAt)],
        columns: { createdAt: true },
      }),
      db.query.userAuditLogs.findFirst({
        where: eq(userAuditLogs.userId, userId),
        orderBy: [desc(userAuditLogs.createdAt)],
        columns: { createdAt: true },
      }),
    ]);

    // Find most recent event
    const lastEventAt = [lastAgentEvent?.createdAt, lastUserEvent?.createdAt]
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0];

    return {
      last5Min: Number(agentLast5Min[0]?.count ?? 0) + Number(userLast5Min[0]?.count ?? 0),
      last1Hour: Number(agentLast1Hour[0]?.count ?? 0) + Number(userLast1Hour[0]?.count ?? 0),
      last24Hours: Number(agentLast24Hours[0]?.count ?? 0) + Number(userLast24Hours[0]?.count ?? 0),
      lastEventAt,
    };
  },
};

export type DataFlowService = typeof dataFlowService;
