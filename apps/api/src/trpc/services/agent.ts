import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { approvalService } from "../../services/approval.service";
import { agentAuditService } from "../../services/agent-audit.service";
import { agentSafetyService } from "../../services/agent-safety.service";
import { workflowEngineService } from "../../services/workflow-engine.service";

// Validation schemas
const updateApprovalSettingsSchema = z.object({
  requireApproval: z.boolean().optional(),
  invoiceThreshold: z.string().nullable().optional(),
  billThreshold: z.string().nullable().optional(),
  journalEntryThreshold: z.string().nullable().optional(),
  autoApproveReadOnly: z.boolean().optional(),
  autoApproveRecurring: z.boolean().optional(),
  allowedActions: z.array(z.string()).nullable().optional(),
  blockedActions: z.array(z.string()).nullable().optional(),
  notifyOnApprovalRequired: z.boolean().optional(),
  notifyOnAutoApproved: z.boolean().optional(),
  approvalTimeoutHours: z.string().optional(),
});

const updateQuotasSchema = z.object({
  dailyInvoiceLimit: z.number().min(0).optional(),
  dailyBillLimit: z.number().min(0).optional(),
  dailyJournalEntryLimit: z.number().min(0).optional(),
  dailyQuotationLimit: z.number().min(0).optional(),
  dailyTokenLimit: z.number().min(0).optional(),
  maxSingleInvoiceAmount: z.string().nullable().optional(),
  maxSingleBillAmount: z.string().nullable().optional(),
  maxSingleJournalAmount: z.string().nullable().optional(),
  maxDailyTotalAmount: z.string().nullable().optional(),
  maxActionsPerMinute: z.number().min(1).optional(),
  maxConcurrentWorkflows: z.number().min(1).optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  templateId: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  steps: z.array(z.object({
    stepNumber: z.number(),
    action: z.string(),
    description: z.string(),
    parameters: z.record(z.unknown()),
    dependsOn: z.array(z.number()).optional(),
    requiresApproval: z.boolean().optional(),
  })).optional(),
});

export const agentRouter = router({
  // ==========================================
  // APPROVAL SETTINGS
  // ==========================================

  getApprovalSettings: protectedProcedure.query(async ({ ctx }) => {
    return approvalService.getSettings(ctx.user.id);
  }),

  updateApprovalSettings: protectedProcedure
    .input(updateApprovalSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      return approvalService.updateSettings(ctx.user.id, input);
    }),

  // ==========================================
  // PENDING APPROVALS
  // ==========================================

  getPendingApprovals: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return approvalService.getPendingApprovals(ctx.user.id, input?.limit);
    }),

  getApprovalById: protectedProcedure
    .input(z.object({ approvalId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return approvalService.getApprovalById(input.approvalId, ctx.user.id);
    }),

  approveAction: protectedProcedure
    .input(z.object({
      approvalId: z.string().uuid(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return approvalService.approveAction(
        input.approvalId,
        ctx.user.id,
        input.notes
      );
    }),

  rejectAction: protectedProcedure
    .input(z.object({
      approvalId: z.string().uuid(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return approvalService.rejectAction(
        input.approvalId,
        ctx.user.id,
        input.notes
      );
    }),

  getApprovalHistory: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return approvalService.getApprovalHistory(ctx.user.id, input);
    }),

  // ==========================================
  // QUOTAS & SAFETY
  // ==========================================

  getQuotas: protectedProcedure.query(async ({ ctx }) => {
    return agentSafetyService.getQuotas(ctx.user.id);
  }),

  updateQuotas: protectedProcedure
    .input(updateQuotasSchema)
    .mutation(async ({ ctx, input }) => {
      return agentSafetyService.updateQuotas(ctx.user.id, input);
    }),

  getUsageSummary: protectedProcedure.query(async ({ ctx }) => {
    return agentSafetyService.getUsageSummary(ctx.user.id);
  }),

  getUsageHistory: protectedProcedure
    .input(z.object({ days: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return agentSafetyService.getUsageHistory(ctx.user.id, input);
    }),

  enableEmergencyStop: protectedProcedure
    .input(z.object({ reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return agentSafetyService.enableEmergencyStop(
        ctx.user.id,
        ctx.user.id,
        input.reason
      );
    }),

  disableEmergencyStop: protectedProcedure.mutation(async ({ ctx }) => {
    return agentSafetyService.disableEmergencyStop(ctx.user.id);
  }),

  // ==========================================
  // AUDIT LOGS
  // ==========================================

  getAuditLogs: protectedProcedure
    .input(z.object({
      sessionId: z.string().uuid().optional(),
      workflowId: z.string().uuid().optional(),
      action: z.string().optional(),
      resourceType: z.string().optional(),
      resourceId: z.string().uuid().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      success: z.boolean().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return agentAuditService.getAuditLogs(ctx.user.id, input as any);
    }),

  getAuditLogById: protectedProcedure
    .input(z.object({ auditLogId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return agentAuditService.getById(input.auditLogId, ctx.user.id);
    }),

  getAuditTrail: protectedProcedure
    .input(z.object({
      resourceType: z.string(),
      resourceId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      return agentAuditService.getAuditTrail(
        ctx.user.id,
        input.resourceType,
        input.resourceId
      );
    }),

  getAuditStats: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return agentAuditService.getStats(ctx.user.id, input);
    }),

  exportAuditLogs: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      format: z.enum(["json", "csv"]).optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      return agentAuditService.exportLogs(ctx.user.id, input);
    }),

  // ==========================================
  // WORKFLOWS
  // ==========================================

  getWorkflowTemplates: protectedProcedure.query(async () => {
    return workflowEngineService.getTemplates();
  }),

  getWorkflowTemplate: protectedProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ input }) => {
      return workflowEngineService.getTemplate(input.templateId);
    }),

  createWorkflow: protectedProcedure
    .input(createWorkflowSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.templateId && !input.steps) {
        return workflowEngineService.createFromTemplate(
          ctx.user.id,
          input.templateId,
          input.sessionId,
          { name: input.name, description: input.description }
        );
      }

      if (!input.steps || input.steps.length === 0) {
        throw new Error("Steps are required when not using a template");
      }

      return workflowEngineService.createWorkflow({
        userId: ctx.user.id,
        sessionId: input.sessionId,
        name: input.name,
        description: input.description,
        templateId: input.templateId,
        steps: input.steps as any,
      });
    }),

  getWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return workflowEngineService.getWorkflow(input.workflowId, ctx.user.id);
    }),

  getWorkflows: protectedProcedure
    .input(z.object({
      status: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return workflowEngineService.getWorkflows(ctx.user.id, input);
    }),

  startWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return workflowEngineService.startWorkflow(input.workflowId, ctx.user.id);
    }),

  pauseWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return workflowEngineService.pauseWorkflow(input.workflowId, ctx.user.id);
    }),

  resumeWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return workflowEngineService.resumeWorkflow(input.workflowId, ctx.user.id);
    }),

  cancelWorkflow: protectedProcedure
    .input(z.object({
      workflowId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return workflowEngineService.cancelWorkflow(
        input.workflowId,
        ctx.user.id,
        input.reason
      );
    }),

  retryWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return workflowEngineService.retryWorkflow(input.workflowId, ctx.user.id);
    }),

  getWorkflowStats: protectedProcedure.query(async ({ ctx }) => {
    return workflowEngineService.getStats(ctx.user.id);
  }),
});
