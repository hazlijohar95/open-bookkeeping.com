/**
 * Agent API Hooks
 * Hooks for AI agent management: approvals, quotas, workflows, and audit logs
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// ============= Types =============

export interface ApprovalSettings {
  id: string;
  userId: string;
  requireApproval: boolean;
  invoiceThreshold: string | null;
  billThreshold: string | null;
  journalEntryThreshold: string | null;
  autoApproveReadOnly: boolean;
  autoApproveRecurring: boolean;
  allowedActions: string[] | null;
  blockedActions: string[] | null;
  notifyOnApprovalRequired: boolean;
  notifyOnAutoApproved: boolean;
  approvalTimeoutHours: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateApprovalSettingsInput {
  requireApproval?: boolean;
  invoiceThreshold?: string | null;
  billThreshold?: string | null;
  journalEntryThreshold?: string | null;
  autoApproveReadOnly?: boolean;
  autoApproveRecurring?: boolean;
  allowedActions?: string[] | null;
  blockedActions?: string[] | null;
  notifyOnApprovalRequired?: boolean;
  notifyOnAutoApproved?: boolean;
  approvalTimeoutHours?: string;
}

export interface PendingApproval {
  id: string;
  userId: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  sessionId: string | null;
  reasoning: string | null;
  confidence: string | null;
  status: "pending" | "approved" | "rejected" | "expired" | "auto_approved";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  estimatedImpact: Record<string, unknown> | null;
  previewData: Record<string, unknown> | null;
  expiresAt: string;
  createdAt: string;
}

export interface AgentQuotas {
  id: string;
  userId: string;
  dailyInvoiceLimit: number;
  dailyBillLimit: number;
  dailyJournalEntryLimit: number;
  dailyQuotationLimit: number;
  dailyTokenLimit: number;
  maxSingleInvoiceAmount: string | null;
  maxSingleBillAmount: string | null;
  maxSingleJournalAmount: string | null;
  maxDailyTotalAmount: string | null;
  maxActionsPerMinute: number;
  maxConcurrentWorkflows: number;
  emergencyStopEnabled: boolean;
  emergencyStoppedAt: string | null;
  emergencyStoppedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateQuotasInput {
  dailyInvoiceLimit?: number;
  dailyBillLimit?: number;
  dailyJournalEntryLimit?: number;
  dailyQuotationLimit?: number;
  dailyTokenLimit?: number;
  maxSingleInvoiceAmount?: string | null;
  maxSingleBillAmount?: string | null;
  maxSingleJournalAmount?: string | null;
  maxDailyTotalAmount?: string | null;
  maxActionsPerMinute?: number;
  maxConcurrentWorkflows?: number;
}

export interface UsageSummary {
  today: {
    invoicesCreated: number;
    billsCreated: number;
    journalEntriesCreated: number;
    quotationsCreated: number;
    totalActions: number;
    totalMutations: number;
    totalReads: number;
    totalAmountProcessed: number;
    tokensUsed: number;
  };
  limits: {
    dailyInvoiceLimit: number;
    dailyBillLimit: number;
    dailyJournalEntryLimit: number;
    dailyQuotationLimit: number;
    dailyTokenLimit: number;
    maxSingleInvoiceAmount: number | null;
    maxSingleBillAmount: number | null;
    maxDailyTotalAmount: number | null;
  };
  remaining: {
    invoices: number;
    bills: number;
    journalEntries: number;
    quotations: number;
    tokens: number;
  };
  emergencyStopEnabled: boolean;
}

export interface AgentAuditLog {
  id: string;
  userId: string;
  sessionId: string | null;
  workflowId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  reasoning: string | null;
  confidence: string | null;
  approvedBy: string | null;
  approvalType: string | null;
  approvalId: string | null;
  isReversible: string;
  reversedAt: string | null;
  reversedBy: string | null;
  success: string;
  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;
  financialImpact: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditStats {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  pendingApprovals: number;
  totalAmountProcessed: number;
  actionsByType: Record<string, number>;
}

export interface Workflow {
  id: string;
  userId: string;
  sessionId: string | null;
  name: string;
  description: string | null;
  templateId: string | null;
  totalSteps: number;
  completedSteps: number;
  currentStep: number;
  status: "pending" | "running" | "paused" | "awaiting_approval" | "completed" | "failed" | "cancelled";
  plan: WorkflowStep[] | null;
  executionLog: ExecutionLogEntry[] | null;
  lastError: string | null;
  retryCount: number;
  maxRetries: number;
  workflowContext: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  pausedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps?: WorkflowStepRecord[];
}

export interface WorkflowStep {
  stepNumber: number;
  action: string;
  description: string;
  parameters: Record<string, unknown>;
  dependsOn?: number[];
  requiresApproval?: boolean;
}

export interface WorkflowStepRecord {
  id: string;
  workflowId: string;
  stepNumber: number;
  action: string;
  description: string | null;
  parameters: Record<string, unknown> | null;
  dependsOn: string[] | null;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result: unknown;
  error: string | null;
  requiresApproval: string | null;
  approvalId: string | null;
  auditLogId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ExecutionLogEntry {
  stepNumber: number;
  startedAt: string;
  completedAt?: string;
  status: string;
  result?: unknown;
  error?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  steps: WorkflowStep[];
  estimatedDuration: string | null;
  isBuiltIn: boolean;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  templateId?: string;
  sessionId?: string;
  steps?: WorkflowStep[];
}

export interface WorkflowStats {
  totalWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  activeWorkflows: number;
  averageCompletionTime: number | null;
}

// ============= Query Keys =============

export const agentKeys = {
  all: ["agent"] as const,
  approvalSettings: () => [...agentKeys.all, "approvalSettings"] as const,
  pendingApprovals: (limit?: number) => [...agentKeys.all, "pendingApprovals", { limit }] as const,
  approval: (id: string) => [...agentKeys.all, "approval", id] as const,
  approvalHistory: (filters?: { status?: string; limit?: number; offset?: number }) =>
    [...agentKeys.all, "approvalHistory", filters] as const,
  quotas: () => [...agentKeys.all, "quotas"] as const,
  usageSummary: () => [...agentKeys.all, "usageSummary"] as const,
  usageHistory: (days?: number) => [...agentKeys.all, "usageHistory", { days }] as const,
  auditLogs: (filters?: Record<string, unknown>) => [...agentKeys.all, "auditLogs", filters] as const,
  auditLog: (id: string) => [...agentKeys.all, "auditLog", id] as const,
  auditTrail: (resourceType: string, resourceId: string) =>
    [...agentKeys.all, "auditTrail", resourceType, resourceId] as const,
  auditStats: (filters?: { startDate?: string; endDate?: string }) =>
    [...agentKeys.all, "auditStats", filters] as const,
  workflowTemplates: () => [...agentKeys.all, "workflowTemplates"] as const,
  workflowTemplate: (id: string) => [...agentKeys.all, "workflowTemplate", id] as const,
  workflows: (filters?: { status?: string; limit?: number; offset?: number }) =>
    [...agentKeys.all, "workflows", filters] as const,
  workflow: (id: string) => [...agentKeys.all, "workflow", id] as const,
  workflowStats: () => [...agentKeys.all, "workflowStats"] as const,
};

// ============= API Functions =============

// Note: Since this uses tRPC backend, we need to adapt the calls
// The tRPC routes are at /trpc/{router}.{procedure}
// For now, these will return mock data until proper REST endpoints are created

const agentApi = {
  // Approval Settings
  getApprovalSettings: () =>
    api.get<{ result: { data: ApprovalSettings } }>("/trpc/agent.getApprovalSettings")
      .then((r) => r.result?.data),
  updateApprovalSettings: (input: UpdateApprovalSettingsInput) =>
    api.post<{ result: { data: ApprovalSettings } }>("/trpc/agent.updateApprovalSettings", input)
      .then((r) => r.result?.data),

  // Pending Approvals
  getPendingApprovals: (limit?: number) =>
    api.get<{ result: { data: PendingApproval[] } }>("/trpc/agent.getPendingApprovals", limit ? { limit } : undefined)
      .then((r) => r.result?.data || []),
  getApprovalById: (approvalId: string) =>
    api.get<{ result: { data: PendingApproval } }>("/trpc/agent.getApprovalById", { approvalId })
      .then((r) => r.result?.data),
  approveAction: (approvalId: string, notes?: string) =>
    api.post<{ result: { data: PendingApproval } }>("/trpc/agent.approveAction", { approvalId, notes })
      .then((r) => r.result?.data),
  rejectAction: (approvalId: string, notes?: string) =>
    api.post<{ result: { data: PendingApproval } }>("/trpc/agent.rejectAction", { approvalId, notes })
      .then((r) => r.result?.data),
  getApprovalHistory: (filters?: { status?: string; limit?: number; offset?: number }) =>
    api.get<{ result: { data: PendingApproval[] } }>("/trpc/agent.getApprovalHistory", filters)
      .then((r) => r.result?.data || []),

  // Quotas & Safety
  getQuotas: () =>
    api.get<{ result: { data: AgentQuotas } }>("/trpc/agent.getQuotas")
      .then((r) => r.result?.data),
  updateQuotas: (input: UpdateQuotasInput) =>
    api.post<{ result: { data: AgentQuotas } }>("/trpc/agent.updateQuotas", input)
      .then((r) => r.result?.data),
  getUsageSummary: () =>
    api.get<{ result: { data: UsageSummary } }>("/trpc/agent.getUsageSummary")
      .then((r) => r.result?.data),
  getUsageHistory: (days?: number) =>
    api.get<{ result: { data: unknown[] } }>("/trpc/agent.getUsageHistory", days ? { days } : undefined)
      .then((r) => r.result?.data || []),
  enableEmergencyStop: (reason?: string) =>
    api.post<{ result: { data: AgentQuotas } }>("/trpc/agent.enableEmergencyStop", { reason })
      .then((r) => r.result?.data),
  disableEmergencyStop: () =>
    api.post<{ result: { data: AgentQuotas } }>("/trpc/agent.disableEmergencyStop")
      .then((r) => r.result?.data),

  // Audit Logs
  getAuditLogs: (filters?: Record<string, unknown>) =>
    api.get<{ result: { data: AgentAuditLog[] } }>("/trpc/agent.getAuditLogs", filters as Record<string, string | number | boolean | undefined | null>)
      .then((r) => r.result?.data || []),
  getAuditLogById: (auditLogId: string) =>
    api.get<{ result: { data: AgentAuditLog } }>("/trpc/agent.getAuditLogById", { auditLogId })
      .then((r) => r.result?.data),
  getAuditTrail: (resourceType: string, resourceId: string) =>
    api.get<{ result: { data: AgentAuditLog[] } }>("/trpc/agent.getAuditTrail", { resourceType, resourceId })
      .then((r) => r.result?.data || []),
  getAuditStats: (filters?: { startDate?: string; endDate?: string }) =>
    api.get<{ result: { data: AuditStats } }>("/trpc/agent.getAuditStats", filters)
      .then((r) => r.result?.data),
  exportAuditLogs: (filters?: { startDate?: string; endDate?: string; format?: "json" | "csv" }) =>
    api.post<{ result: { data: { url: string } } }>("/trpc/agent.exportAuditLogs", filters)
      .then((r) => r.result?.data),

  // Workflows
  getWorkflowTemplates: () =>
    api.get<{ result: { data: WorkflowTemplate[] } }>("/trpc/agent.getWorkflowTemplates")
      .then((r) => r.result?.data || []),
  getWorkflowTemplate: (templateId: string) =>
    api.get<{ result: { data: WorkflowTemplate } }>("/trpc/agent.getWorkflowTemplate", { templateId })
      .then((r) => r.result?.data),
  createWorkflow: (input: CreateWorkflowInput) =>
    api.post<{ result: { data: Workflow } }>("/trpc/agent.createWorkflow", input)
      .then((r) => r.result?.data),
  getWorkflow: (workflowId: string) =>
    api.get<{ result: { data: Workflow } }>("/trpc/agent.getWorkflow", { workflowId })
      .then((r) => r.result?.data),
  getWorkflows: (filters?: { status?: string; limit?: number; offset?: number }) =>
    api.get<{ result: { data: Workflow[] } }>("/trpc/agent.getWorkflows", filters)
      .then((r) => r.result?.data || []),
  startWorkflow: (workflowId: string) =>
    api.post<{ result: { data: Workflow } }>("/trpc/agent.startWorkflow", { workflowId })
      .then((r) => r.result?.data),
  pauseWorkflow: (workflowId: string) =>
    api.post<{ result: { data: Workflow } }>("/trpc/agent.pauseWorkflow", { workflowId })
      .then((r) => r.result?.data),
  resumeWorkflow: (workflowId: string) =>
    api.post<{ result: { data: Workflow } }>("/trpc/agent.resumeWorkflow", { workflowId })
      .then((r) => r.result?.data),
  cancelWorkflow: (workflowId: string, reason?: string) =>
    api.post<{ result: { data: Workflow } }>("/trpc/agent.cancelWorkflow", { workflowId, reason })
      .then((r) => r.result?.data),
  retryWorkflow: (workflowId: string) =>
    api.post<{ result: { data: Workflow } }>("/trpc/agent.retryWorkflow", { workflowId })
      .then((r) => r.result?.data),
  getWorkflowStats: () =>
    api.get<{ result: { data: WorkflowStats } }>("/trpc/agent.getWorkflowStats")
      .then((r) => r.result?.data),
};

// ============= Hooks =============

// Approval Settings
export function useApprovalSettings() {
  return useQuery({
    queryKey: agentKeys.approvalSettings(),
    queryFn: agentApi.getApprovalSettings,
  });
}

export function useUpdateApprovalSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: agentApi.updateApprovalSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.approvalSettings() });
    },
  });
}

// Pending Approvals
export function usePendingApprovals(limit?: number) {
  return useQuery({
    queryKey: agentKeys.pendingApprovals(limit),
    queryFn: () => agentApi.getPendingApprovals(limit),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useApproval(approvalId: string) {
  return useQuery({
    queryKey: agentKeys.approval(approvalId),
    queryFn: () => agentApi.getApprovalById(approvalId),
    enabled: !!approvalId,
  });
}

export function useApproveAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, notes }: { approvalId: string; notes?: string }) =>
      agentApi.approveAction(approvalId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useRejectAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ approvalId, notes }: { approvalId: string; notes?: string }) =>
      agentApi.rejectAction(approvalId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
    },
  });
}

export function useApprovalHistory(filters?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: agentKeys.approvalHistory(filters),
    queryFn: () => agentApi.getApprovalHistory(filters),
  });
}

// Quotas & Safety
export function useAgentQuotas() {
  return useQuery({
    queryKey: agentKeys.quotas(),
    queryFn: agentApi.getQuotas,
  });
}

export function useUpdateQuotas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: agentApi.updateQuotas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.quotas() });
      queryClient.invalidateQueries({ queryKey: agentKeys.usageSummary() });
    },
  });
}

export function useUsageSummary() {
  return useQuery({
    queryKey: agentKeys.usageSummary(),
    queryFn: agentApi.getUsageSummary,
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useUsageHistory(days?: number) {
  return useQuery({
    queryKey: agentKeys.usageHistory(days),
    queryFn: () => agentApi.getUsageHistory(days),
  });
}

export function useEnableEmergencyStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => agentApi.enableEmergencyStop(reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.quotas() });
      queryClient.invalidateQueries({ queryKey: agentKeys.usageSummary() });
    },
  });
}

export function useDisableEmergencyStop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: agentApi.disableEmergencyStop,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.quotas() });
      queryClient.invalidateQueries({ queryKey: agentKeys.usageSummary() });
    },
  });
}

// Audit Logs
export function useAuditLogs(filters?: Record<string, unknown>) {
  return useQuery({
    queryKey: agentKeys.auditLogs(filters),
    queryFn: () => agentApi.getAuditLogs(filters),
  });
}

export function useAuditLog(auditLogId: string) {
  return useQuery({
    queryKey: agentKeys.auditLog(auditLogId),
    queryFn: () => agentApi.getAuditLogById(auditLogId),
    enabled: !!auditLogId,
  });
}

export function useAuditTrail(resourceType: string, resourceId: string) {
  return useQuery({
    queryKey: agentKeys.auditTrail(resourceType, resourceId),
    queryFn: () => agentApi.getAuditTrail(resourceType, resourceId),
    enabled: !!resourceType && !!resourceId,
  });
}

export function useAuditStats(filters?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: agentKeys.auditStats(filters),
    queryFn: () => agentApi.getAuditStats(filters),
  });
}

export function useExportAuditLogs() {
  return useMutation({
    mutationFn: agentApi.exportAuditLogs,
  });
}

// Workflows
export function useWorkflowTemplates() {
  return useQuery({
    queryKey: agentKeys.workflowTemplates(),
    queryFn: agentApi.getWorkflowTemplates,
  });
}

export function useWorkflowTemplate(templateId: string) {
  return useQuery({
    queryKey: agentKeys.workflowTemplate(templateId),
    queryFn: () => agentApi.getWorkflowTemplate(templateId),
    enabled: !!templateId,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: agentApi.createWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.workflows() });
      queryClient.invalidateQueries({ queryKey: agentKeys.workflowStats() });
    },
  });
}

export function useWorkflow(workflowId: string) {
  return useQuery({
    queryKey: agentKeys.workflow(workflowId),
    queryFn: () => agentApi.getWorkflow(workflowId),
    enabled: !!workflowId,
    refetchInterval: (query) => {
      const workflow = query.state.data as Workflow | undefined;
      // Poll more frequently for active workflows
      if (workflow?.status === "running" || workflow?.status === "awaiting_approval") {
        return 5000;
      }
      return false;
    },
  });
}

export function useWorkflows(filters?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: agentKeys.workflows(filters),
    queryFn: () => agentApi.getWorkflows(filters),
  });
}

export function useStartWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: agentApi.startWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.workflows() });
      queryClient.invalidateQueries({ queryKey: agentKeys.workflowStats() });
    },
  });
}

export function usePauseWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: agentApi.pauseWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.workflows() });
    },
  });
}

export function useResumeWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: agentApi.resumeWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.workflows() });
    },
  });
}

export function useCancelWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, reason }: { workflowId: string; reason?: string }) =>
      agentApi.cancelWorkflow(workflowId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.workflows() });
      queryClient.invalidateQueries({ queryKey: agentKeys.workflowStats() });
    },
  });
}

export function useRetryWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: agentApi.retryWorkflow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.workflows() });
      queryClient.invalidateQueries({ queryKey: agentKeys.workflowStats() });
    },
  });
}

export function useWorkflowStats() {
  return useQuery({
    queryKey: agentKeys.workflowStats(),
    queryFn: agentApi.getWorkflowStats,
  });
}
