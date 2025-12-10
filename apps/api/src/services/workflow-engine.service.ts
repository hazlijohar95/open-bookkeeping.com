import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@open-bookkeeping/db";
import {
  agentWorkflows,
  agentWorkflowSteps,
  agentWorkflowTemplates,
} from "@open-bookkeeping/db";
import { createLogger } from "@open-bookkeeping/shared";
import { approvalService, type AgentActionType } from "./approval.service";
import { agentAuditService } from "./agent-audit.service";
import { agentSafetyService } from "./agent-safety.service";

const logger = createLogger("workflow-engine-service");

// Types
export interface WorkflowStep {
  stepNumber: number;
  action: AgentActionType;
  description: string;
  parameters: Record<string, unknown>;
  dependsOn?: number[];
  requiresApproval?: boolean;
}

export interface WorkflowPlan {
  name: string;
  description: string;
  steps: WorkflowStep[];
  estimatedDuration?: string;
}

export interface CreateWorkflowInput {
  userId: string;
  sessionId?: string;
  name: string;
  description?: string;
  templateId?: string;
  steps: WorkflowStep[];
}

export interface StepResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface ExecuteStepInput {
  workflowId: string;
  stepId: string;
  userId: string;
  executor: (action: AgentActionType, params: Record<string, unknown>) => Promise<unknown>;
}

// Pre-built workflow templates
const WORKFLOW_TEMPLATES: Record<string, WorkflowPlan> = {
  "month-end-close": {
    name: "Month-End Close",
    description: "Complete month-end closing procedures",
    estimatedDuration: "15-30 minutes",
    steps: [
      {
        stepNumber: 1,
        action: "read_data",
        description: "Review pending invoices",
        parameters: { resource: "invoices", filter: "pending" },
      },
      {
        stepNumber: 2,
        action: "read_data",
        description: "Review unpaid bills",
        parameters: { resource: "bills", filter: "unpaid" },
      },
      {
        stepNumber: 3,
        action: "analyze_data",
        description: "Generate trial balance",
        parameters: { report: "trial_balance" },
      },
      {
        stepNumber: 4,
        action: "analyze_data",
        description: "Generate profit & loss",
        parameters: { report: "profit_loss" },
        dependsOn: [3],
      },
      {
        stepNumber: 5,
        action: "analyze_data",
        description: "Generate balance sheet",
        parameters: { report: "balance_sheet" },
        dependsOn: [3],
      },
    ],
  },
  "invoice-batch-send": {
    name: "Batch Invoice Send",
    description: "Send all pending invoices to customers",
    estimatedDuration: "5-10 minutes",
    steps: [
      {
        stepNumber: 1,
        action: "read_data",
        description: "List pending invoices",
        parameters: { resource: "invoices", filter: "pending" },
      },
      {
        stepNumber: 2,
        action: "send_invoice",
        description: "Send invoices to customers",
        parameters: { batch: true },
        dependsOn: [1],
        requiresApproval: true,
      },
    ],
  },
  "bank-reconciliation": {
    name: "Bank Reconciliation",
    description: "Reconcile bank transactions with ledger entries",
    estimatedDuration: "10-20 minutes",
    steps: [
      {
        stepNumber: 1,
        action: "read_data",
        description: "Load unmatched bank transactions",
        parameters: { resource: "bank_transactions", filter: "unmatched" },
      },
      {
        stepNumber: 2,
        action: "analyze_data",
        description: "Find matching ledger entries",
        parameters: { action: "find_matches" },
        dependsOn: [1],
      },
      {
        stepNumber: 3,
        action: "match_transaction",
        description: "Apply suggested matches",
        parameters: { batch: true },
        dependsOn: [2],
        requiresApproval: true,
      },
    ],
  },
  "ar-followup": {
    name: "Accounts Receivable Follow-up",
    description: "Follow up on overdue invoices",
    estimatedDuration: "10-15 minutes",
    steps: [
      {
        stepNumber: 1,
        action: "read_data",
        description: "Get overdue invoices",
        parameters: { resource: "invoices", filter: "overdue" },
      },
      {
        stepNumber: 2,
        action: "analyze_data",
        description: "Prioritize by amount and days overdue",
        parameters: { action: "prioritize_overdue" },
        dependsOn: [1],
      },
      {
        stepNumber: 3,
        action: "send_invoice",
        description: "Send reminder emails",
        parameters: { type: "reminder" },
        dependsOn: [2],
        requiresApproval: true,
      },
    ],
  },
};

export const workflowEngineService = {
  /**
   * Get available workflow templates
   */
  getTemplates: async () => {
    // Return built-in templates plus any custom ones from database
    const customTemplates = await db.query.agentWorkflowTemplates.findMany({
      where: eq(agentWorkflowTemplates.isEnabled, "yes"),
    });

    const templates = Object.entries(WORKFLOW_TEMPLATES).map(([id, template]) => ({
      id,
      ...template,
      isBuiltIn: true,
    }));

    const custom = customTemplates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      // Map parameterSchema to parameters for custom templates from DB
      steps: (t.steps || []).map((step) => ({
        stepNumber: step.stepNumber,
        action: step.action as AgentActionType,
        description: step.description,
        parameters: step.parameterSchema || {},
        dependsOn: step.dependsOn,
        requiresApproval: step.requiresApproval,
      })) as WorkflowStep[],
      estimatedDuration: t.estimatedDuration,
      isBuiltIn: false,
    }));

    return [...templates, ...custom];
  },

  /**
   * Get a specific template by ID
   */
  getTemplate: async (templateId: string) => {
    if (WORKFLOW_TEMPLATES[templateId]) {
      return {
        id: templateId,
        ...WORKFLOW_TEMPLATES[templateId],
        isBuiltIn: true,
      };
    }

    const custom = await db.query.agentWorkflowTemplates.findFirst({
      where: eq(agentWorkflowTemplates.id, templateId),
    });

    if (custom) {
      return {
        id: custom.id,
        name: custom.name,
        description: custom.description,
        category: custom.category,
        // Map parameterSchema to parameters for custom templates from DB
        steps: (custom.steps || []).map((step) => ({
          stepNumber: step.stepNumber,
          action: step.action as AgentActionType,
          description: step.description,
          parameters: step.parameterSchema || {},
          dependsOn: step.dependsOn,
          requiresApproval: step.requiresApproval,
        })) as WorkflowStep[],
        estimatedDuration: custom.estimatedDuration,
        isBuiltIn: false,
      };
    }

    return null;
  },

  /**
   * Create a new workflow
   */
  createWorkflow: async (input: CreateWorkflowInput) => {
    // Check concurrent workflow limit
    const quotas = await agentSafetyService.getQuotas(input.userId);
    const activeWorkflows = await db.query.agentWorkflows.findMany({
      where: and(
        eq(agentWorkflows.userId, input.userId),
        sql`${agentWorkflows.status} IN ('pending', 'running', 'paused', 'awaiting_approval')`
      ),
    });

    if (activeWorkflows.length >= quotas.maxConcurrentWorkflows) {
      throw new Error(
        `Maximum concurrent workflows limit reached (${quotas.maxConcurrentWorkflows})`
      );
    }

    // Create workflow
    const [workflow] = await db
      .insert(agentWorkflows)
      .values({
        userId: input.userId,
        sessionId: input.sessionId || null,
        name: input.name,
        description: input.description || null,
        templateId: input.templateId || null,
        totalSteps: input.steps.length,
        completedSteps: 0,
        currentStep: 0,
        status: "pending",
        plan: input.steps,
        executionLog: [],
      })
      .returning();

    // Create workflow steps
    for (const step of input.steps) {
      await db.insert(agentWorkflowSteps).values({
        workflowId: workflow!.id,
        stepNumber: step.stepNumber,
        action: step.action,
        description: step.description || null,
        parameters: step.parameters,
        dependsOn: step.dependsOn ? step.dependsOn.map(String) : null,
        requiresApproval: step.requiresApproval ? "yes" : "no",
        status: "pending",
      });
    }

    logger.info(
      { workflowId: workflow!.id, name: input.name, stepCount: input.steps.length },
      "Workflow created"
    );

    return workflow!;
  },

  /**
   * Create workflow from template
   */
  createFromTemplate: async (
    userId: string,
    templateId: string,
    sessionId?: string,
    overrides?: Partial<WorkflowPlan>
  ) => {
    const template = await workflowEngineService.getTemplate(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return workflowEngineService.createWorkflow({
      userId,
      sessionId,
      name: overrides?.name || template.name,
      description: overrides?.description || template.description || undefined,
      templateId,
      steps: overrides?.steps || template.steps,
    });
  },

  /**
   * Get workflow by ID
   */
  getWorkflow: async (workflowId: string, userId: string) => {
    return db.query.agentWorkflows.findFirst({
      where: and(
        eq(agentWorkflows.id, workflowId),
        eq(agentWorkflows.userId, userId)
      ),
      with: {
        steps: {
          orderBy: [sql`${agentWorkflowSteps.stepNumber} ASC`],
        },
      },
    });
  },

  /**
   * Get user's workflows
   */
  getWorkflows: async (
    userId: string,
    options?: { status?: string; limit?: number; offset?: number }
  ) => {
    const { status, limit = 50, offset = 0 } = options || {};

    const conditions = [eq(agentWorkflows.userId, userId)];

    if (status) {
      conditions.push(eq(agentWorkflows.status, status as any));
    }

    return db.query.agentWorkflows.findMany({
      where: and(...conditions),
      orderBy: [desc(agentWorkflows.createdAt)],
      limit,
      offset,
    });
  },

  /**
   * Start a workflow
   */
  startWorkflow: async (workflowId: string, userId: string) => {
    const workflow = await workflowEngineService.getWorkflow(workflowId, userId);

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "pending") {
      throw new Error(`Cannot start workflow in ${workflow.status} status`);
    }

    const [updated] = await db
      .update(agentWorkflows)
      .set({
        status: "running",
        currentStep: 1,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentWorkflows.id, workflowId))
      .returning();

    logger.info({ workflowId }, "Workflow started");

    return updated!;
  },

  /**
   * Execute the next step in a workflow
   */
  executeNextStep: async (
    workflowId: string,
    userId: string,
    executor: (action: AgentActionType, params: Record<string, unknown>) => Promise<unknown>
  ): Promise<StepResult> => {
    const workflow = await workflowEngineService.getWorkflow(workflowId, userId);

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "running") {
      throw new Error(`Cannot execute step in ${workflow.status} status`);
    }

    // Find the next pending step
    const nextStep = workflow.steps?.find(
      (s) => s.status === "pending" && s.stepNumber === workflow.currentStep
    );

    if (!nextStep) {
      // All steps completed
      await db
        .update(agentWorkflows)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentWorkflows.id, workflowId));

      return { success: true, result: "Workflow completed" };
    }

    // Check dependencies
    if (nextStep.dependsOn) {
      const depIds = nextStep.dependsOn as string[];
      const depSteps = workflow.steps?.filter((s) =>
        depIds.includes(String(s.stepNumber))
      );

      const allDepsCompleted = depSteps?.every((s) => s.status === "completed");

      if (!allDepsCompleted) {
        return {
          success: false,
          error: "Dependencies not completed",
        };
      }
    }

    // Check if step requires approval
    if (nextStep.requiresApproval === "yes") {
      const approvalCheck = await approvalService.checkRequiresApproval(userId, {
        type: nextStep.action,
        payload: nextStep.parameters as Record<string, unknown>,
      });

      if (approvalCheck.requiresApproval) {
        // Create approval request and pause workflow
        const approval = await approvalService.createApprovalRequest({
          userId,
          actionType: nextStep.action,
          actionPayload: nextStep.parameters as Record<string, unknown>,
          reasoning: `Step ${nextStep.stepNumber} of workflow "${workflow.name}"`,
        });

        await db
          .update(agentWorkflowSteps)
          .set({
            approvalId: approval.id,
          })
          .where(eq(agentWorkflowSteps.id, nextStep.id));

        await db
          .update(agentWorkflows)
          .set({
            status: "awaiting_approval",
            updatedAt: new Date(),
          })
          .where(eq(agentWorkflows.id, workflowId));

        return {
          success: false,
          error: "Step requires approval",
          result: { approvalId: approval.id },
        };
      }
    }

    // Check quota
    const quotaCheck = await agentSafetyService.checkQuota(userId, nextStep.action);
    if (!quotaCheck.allowed) {
      return {
        success: false,
        error: quotaCheck.reason || "Quota exceeded",
      };
    }

    // Mark step as running
    await db
      .update(agentWorkflowSteps)
      .set({
        status: "running",
        startedAt: new Date(),
      })
      .where(eq(agentWorkflowSteps.id, nextStep.id));

    try {
      // Execute the step
      const result = await executor(
        nextStep.action,
        nextStep.parameters as Record<string, unknown>
      );

      // Record usage
      await agentSafetyService.recordUsage(userId, {
        action: nextStep.action,
      });

      // Log audit
      const auditLog = await agentAuditService.logAction({
        userId,
        workflowId,
        action: nextStep.action,
        resourceType: "workflow_step",
        resourceId: nextStep.id,
        newState: { result },
        approvalType: "auto",
        success: true,
      });

      // Mark step as completed
      await db
        .update(agentWorkflowSteps)
        .set({
          status: "completed",
          result: result as any,
          completedAt: new Date(),
          auditLogId: auditLog.id,
        })
        .where(eq(agentWorkflowSteps.id, nextStep.id));

      // Update workflow progress
      const [updated] = await db
        .update(agentWorkflows)
        .set({
          completedSteps: sql`${agentWorkflows.completedSteps} + 1`,
          currentStep: sql`${agentWorkflows.currentStep} + 1`,
          executionLog: sql`${agentWorkflows.executionLog} || ${JSON.stringify([
            {
              stepNumber: nextStep.stepNumber,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              status: "completed",
              result,
            },
          ])}::jsonb`,
          updatedAt: new Date(),
        })
        .where(eq(agentWorkflows.id, workflowId))
        .returning();

      // Check if workflow is complete
      if (updated!.completedSteps >= updated!.totalSteps) {
        await db
          .update(agentWorkflows)
          .set({
            status: "completed",
            completedAt: new Date(),
          })
          .where(eq(agentWorkflows.id, workflowId));
      }

      logger.info(
        { workflowId, stepNumber: nextStep.stepNumber },
        "Workflow step completed"
      );

      return { success: true, result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log audit with failure
      await agentAuditService.logAction({
        userId,
        workflowId,
        action: nextStep.action,
        resourceType: "workflow_step",
        resourceId: nextStep.id,
        success: false,
        errorMessage,
      });

      // Mark step as failed
      await db
        .update(agentWorkflowSteps)
        .set({
          status: "failed",
          error: errorMessage,
          completedAt: new Date(),
        })
        .where(eq(agentWorkflowSteps.id, nextStep.id));

      // Update workflow with error
      const workflow = await workflowEngineService.getWorkflow(workflowId, userId);
      const retryCount = (workflow?.retryCount || 0) + 1;

      if (retryCount >= (workflow?.maxRetries || 3)) {
        await db
          .update(agentWorkflows)
          .set({
            status: "failed",
            lastError: errorMessage,
            retryCount,
            updatedAt: new Date(),
          })
          .where(eq(agentWorkflows.id, workflowId));
      } else {
        await db
          .update(agentWorkflows)
          .set({
            lastError: errorMessage,
            retryCount,
            updatedAt: new Date(),
          })
          .where(eq(agentWorkflows.id, workflowId));
      }

      logger.error(
        { workflowId, stepNumber: nextStep.stepNumber, error: errorMessage },
        "Workflow step failed"
      );

      return { success: false, error: errorMessage };
    }
  },

  /**
   * Pause a workflow
   */
  pauseWorkflow: async (workflowId: string, userId: string) => {
    const workflow = await workflowEngineService.getWorkflow(workflowId, userId);

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "running") {
      throw new Error(`Cannot pause workflow in ${workflow.status} status`);
    }

    const [updated] = await db
      .update(agentWorkflows)
      .set({
        status: "paused",
        pausedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentWorkflows.id, workflowId))
      .returning();

    logger.info({ workflowId }, "Workflow paused");

    return updated!;
  },

  /**
   * Resume a paused workflow
   */
  resumeWorkflow: async (workflowId: string, userId: string) => {
    const workflow = await workflowEngineService.getWorkflow(workflowId, userId);

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "paused" && workflow.status !== "awaiting_approval") {
      throw new Error(`Cannot resume workflow in ${workflow.status} status`);
    }

    const [updated] = await db
      .update(agentWorkflows)
      .set({
        status: "running",
        pausedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(agentWorkflows.id, workflowId))
      .returning();

    logger.info({ workflowId }, "Workflow resumed");

    return updated!;
  },

  /**
   * Cancel a workflow
   */
  cancelWorkflow: async (workflowId: string, userId: string, reason?: string) => {
    const workflow = await workflowEngineService.getWorkflow(workflowId, userId);

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.status === "completed" || workflow.status === "cancelled") {
      throw new Error(`Cannot cancel workflow in ${workflow.status} status`);
    }

    const [updated] = await db
      .update(agentWorkflows)
      .set({
        status: "cancelled",
        lastError: reason || "Cancelled by user",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentWorkflows.id, workflowId))
      .returning();

    logger.info({ workflowId, reason }, "Workflow cancelled");

    return updated!;
  },

  /**
   * Retry a failed workflow
   */
  retryWorkflow: async (workflowId: string, userId: string) => {
    const workflow = await workflowEngineService.getWorkflow(workflowId, userId);

    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "failed") {
      throw new Error("Can only retry failed workflows");
    }

    // Reset failed step to pending
    const failedStep = workflow.steps?.find((s) => s.status === "failed");
    if (failedStep) {
      await db
        .update(agentWorkflowSteps)
        .set({
          status: "pending",
          error: null,
          startedAt: null,
          completedAt: null,
        })
        .where(eq(agentWorkflowSteps.id, failedStep.id));
    }

    const [updated] = await db
      .update(agentWorkflows)
      .set({
        status: "running",
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(agentWorkflows.id, workflowId))
      .returning();

    logger.info({ workflowId }, "Workflow retry initiated");

    return updated!;
  },

  /**
   * Get workflow statistics for a user
   */
  getStats: async (userId: string) => {
    const workflows = await db.query.agentWorkflows.findMany({
      where: eq(agentWorkflows.userId, userId),
      columns: {
        status: true,
        totalSteps: true,
        completedSteps: true,
      },
    });

    return {
      total: workflows.length,
      byStatus: {
        pending: workflows.filter((w) => w.status === "pending").length,
        running: workflows.filter((w) => w.status === "running").length,
        paused: workflows.filter((w) => w.status === "paused").length,
        awaitingApproval: workflows.filter((w) => w.status === "awaiting_approval").length,
        completed: workflows.filter((w) => w.status === "completed").length,
        failed: workflows.filter((w) => w.status === "failed").length,
        cancelled: workflows.filter((w) => w.status === "cancelled").length,
      },
      totalSteps: workflows.reduce((sum, w) => sum + w.totalSteps, 0),
      completedSteps: workflows.reduce((sum, w) => sum + w.completedSteps, 0),
    };
  },
};
