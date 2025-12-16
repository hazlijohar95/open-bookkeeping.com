/**
 * Data Flow Explorer - TypeScript Types
 * Shared types for the data flow visualization feature
 */

// ============================================
// EVENT TYPES
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
    reasoning?: string; // AI agent reasoning
    confidence?: number; // AI confidence score (0-1)
    riskLevel?: "low" | "medium" | "high" | "critical";
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
  financialImpact?: {
    amount: number;
    currency: string;
    direction: "increase" | "decrease" | "neutral";
    accountsAffected?: string[];
  };
}

// ============================================
// FLOW VISUALIZATION TYPES
// ============================================

export type FlowNodeType = "source" | "resource" | "destination";
export type FlowCategory = "sources" | "sales" | "purchases" | "accounting" | "contacts" | "destinations";

export interface FlowNode {
  id: string;
  name: string;
  type: FlowNodeType;
  category: FlowCategory;
  color: string;
  icon?: string;
  count?: number;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number; // Count of events
  actions: string[]; // Action types that caused this flow
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
// ENTITY EXPLORER TYPES
// ============================================

export interface EntityRelationship {
  target: string;
  type: "belongs_to" | "has_many" | "has_one" | "creates" | "references";
  label: string;
  description?: string;
}

export interface EntityEducation {
  whatItDoes: string;
  dataFlow: string;
  relatedReports: string[];
  examples?: string[];
}

export interface EntityDefinition {
  id: string;
  displayName: string;
  tableName: string;
  category: FlowCategory;
  description: string;
  relations: EntityRelationship[];
  education: EntityEducation;
  icon?: string;
}

// ============================================
// ACTION EDUCATION TYPES
// ============================================

export interface ActionEducation {
  name: string;
  description: string;
  dataImpact: string[];
  financialEffect?: string;
  relatedTables: string[];
  accountingEntry?: {
    debits: string[];
    credits: string[];
  };
}

// ============================================
// FILTER TYPES
// ============================================

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

export interface TimeRange {
  label: string;
  value: "5m" | "15m" | "1h" | "6h" | "24h";
  minutes: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface DataFlowEventsResponse {
  events: UnifiedEvent[];
  hasMore: boolean;
  nextCursor?: string;
  lastUpdate: Date;
}

export interface DataFlowStatsResponse {
  flowStats: FlowStatistics;
  lastUpdate: Date;
}
