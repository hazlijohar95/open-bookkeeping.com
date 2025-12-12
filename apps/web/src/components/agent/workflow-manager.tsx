import { useState, useMemo, useCallback, memo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  useWorkflows,
  useWorkflowTemplates,
  useWorkflowStats,
  useCreateWorkflow,
  useStartWorkflow,
  usePauseWorkflow,
  useResumeWorkflow,
  useCancelWorkflow,
  useRetryWorkflow,
  type Workflow,
  type WorkflowTemplate,
} from "@/api/agent";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PlayIcon,
  Pause,
  StopCircleIcon,
  RotateCcw,
  Plus,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  Loader2Icon,
  ChevronRightIcon,
  Zap,
} from "@/components/ui/icons";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof PlayIcon }> = {
  pending: { label: "Pending", variant: "outline", icon: ClockIcon },
  running: { label: "Running", variant: "default", icon: PlayIcon },
  paused: { label: "Paused", variant: "secondary", icon: Pause },
  awaiting_approval: { label: "Awaiting Approval", variant: "secondary", icon: AlertTriangleIcon },
  completed: { label: "Completed", variant: "default", icon: CheckCircle2Icon },
  failed: { label: "Failed", variant: "destructive", icon: XCircleIcon },
  cancelled: { label: "Cancelled", variant: "outline", icon: StopCircleIcon },
};

const DEFAULT_STATUS_CONFIG = STATUS_CONFIG.pending!;

// TypeScript interfaces for component props
interface WorkflowCardProps {
  workflow: Workflow;
}

interface TemplateCardProps {
  template: WorkflowTemplate;
  onSelect: () => void;
}

interface CreateWorkflowDialogProps {
  templates: WorkflowTemplate[];
}

// Extracted and memoized WorkflowCard component
const WorkflowCard = memo<WorkflowCardProps>(({ workflow }) => {
  const startWorkflow = useStartWorkflow();
  const pauseWorkflow = usePauseWorkflow();
  const resumeWorkflow = useResumeWorkflow();
  const cancelWorkflow = useCancelWorkflow();
  const retryWorkflow = useRetryWorkflow();

  const statusConfig = STATUS_CONFIG[workflow.status] ?? DEFAULT_STATUS_CONFIG;
  const StatusIcon = statusConfig.icon;
  const progress = workflow.totalSteps > 0 ? (workflow.completedSteps / workflow.totalSteps) * 100 : 0;

  const handleStart = useCallback(async () => {
    try {
      await startWorkflow.mutateAsync(workflow.id);
      toast.success("Workflow started");
    } catch {
      toast.error("Failed to start workflow");
    }
  }, [startWorkflow, workflow.id]);

  const handlePause = useCallback(async () => {
    try {
      await pauseWorkflow.mutateAsync(workflow.id);
      toast.success("Workflow paused");
    } catch {
      toast.error("Failed to pause workflow");
    }
  }, [pauseWorkflow, workflow.id]);

  const handleResume = useCallback(async () => {
    try {
      await resumeWorkflow.mutateAsync(workflow.id);
      toast.success("Workflow resumed");
    } catch {
      toast.error("Failed to resume workflow");
    }
  }, [resumeWorkflow, workflow.id]);

  const handleCancel = useCallback(async () => {
    try {
      await cancelWorkflow.mutateAsync({ workflowId: workflow.id });
      toast.success("Workflow cancelled");
    } catch {
      toast.error("Failed to cancel workflow");
    }
  }, [cancelWorkflow, workflow.id]);

  const handleRetry = useCallback(async () => {
    try {
      await retryWorkflow.mutateAsync(workflow.id);
      toast.success("Workflow retrying");
    } catch {
      toast.error("Failed to retry workflow");
    }
  }, [retryWorkflow, workflow.id]);

  const isLoading = startWorkflow.isPending || pauseWorkflow.isPending || resumeWorkflow.isPending || cancelWorkflow.isPending || retryWorkflow.isPending;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{workflow.name}</CardTitle>
            {workflow.description && (
              <CardDescription className="text-xs">{workflow.description}</CardDescription>
            )}
          </div>
          <Badge variant={statusConfig.variant} className="gap-1">
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {workflow.completedSteps} / {workflow.totalSteps} steps
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Created {formatDistanceToNow(new Date(workflow.createdAt), { addSuffix: true })}</span>
          {workflow.startedAt && (
            <span>Started {formatDistanceToNow(new Date(workflow.startedAt), { addSuffix: true })}</span>
          )}
        </div>

        {workflow.lastError && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {workflow.lastError}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          {workflow.status === "pending" && (
            <Button size="sm" onClick={handleStart} disabled={isLoading}>
              {startWorkflow.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
              <span className="ml-1">Start</span>
            </Button>
          )}
          {workflow.status === "running" && (
            <Button size="sm" variant="secondary" onClick={handlePause} disabled={isLoading}>
              {pauseWorkflow.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              <span className="ml-1">Pause</span>
            </Button>
          )}
          {workflow.status === "paused" && (
            <Button size="sm" onClick={handleResume} disabled={isLoading}>
              {resumeWorkflow.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <PlayIcon className="h-4 w-4" />}
              <span className="ml-1">Resume</span>
            </Button>
          )}
          {workflow.status === "failed" && (
            <Button size="sm" onClick={handleRetry} disabled={isLoading}>
              {retryWorkflow.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              <span className="ml-1">Retry</span>
            </Button>
          )}
          {["pending", "running", "paused", "awaiting_approval"].includes(workflow.status) && (
            <Button size="sm" variant="destructive" onClick={handleCancel} disabled={isLoading}>
              {cancelWorkflow.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <StopCircleIcon className="h-4 w-4" />}
              <span className="ml-1">Cancel</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

// Add display name for WorkflowCard
WorkflowCard.displayName = "WorkflowCard";

// Extracted and memoized TemplateCard component
const TemplateCard = memo<TemplateCardProps>(({ template, onSelect }) => {
  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{template.name}</CardTitle>
            {template.description && (
              <CardDescription className="text-xs">{template.description}</CardDescription>
            )}
          </div>
          {template.isBuiltIn && (
            <Badge variant="secondary">Built-in</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {template.steps.length} steps
          </span>
          {template.estimatedDuration && (
            <span className="text-muted-foreground flex items-center gap-1">
              <ClockIcon className="h-3 w-3" />
              {template.estimatedDuration}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center text-sm text-primary">
          Use template
          <ChevronRightIcon className="h-4 w-4 ml-1" />
        </div>
      </CardContent>
    </Card>
  );
});

// Add display name for TemplateCard
TemplateCard.displayName = "TemplateCard";

const CreateWorkflowDialog = memo<CreateWorkflowDialogProps>(({ templates }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "configure">("select");
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createWorkflow = useCreateWorkflow();

  const handleSelectTemplate = useCallback((template: WorkflowTemplate) => {
    setSelectedTemplate(template);
    setName(template.name);
    setDescription(template.description ?? "");
    setStep("configure");
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedTemplate) return;

    try {
      await createWorkflow.mutateAsync({
        name,
        description: description ?? undefined,
        templateId: selectedTemplate.id,
      });
      toast.success("Workflow created");
      setOpen(false);
      setStep("select");
      setSelectedTemplate(null);
      setName("");
      setDescription("");
    } catch {
      toast.error("Failed to create workflow");
    }
  }, [selectedTemplate, name, description, createWorkflow]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setStep("select");
    setSelectedTemplate(null);
    setName("");
    setDescription("");
  }, []);

  const handleBackToSelect = useCallback(() => {
    setStep("select");
  }, []);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  }, []);

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "select" ? "Choose a Template" : "Configure Workflow"}
          </DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Select a workflow template to get started"
              : "Customize your workflow settings"}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => handleSelectTemplate(template)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workflowName">Workflow Name</Label>
              <Input
                id="workflowName"
                value={name}
                onChange={handleNameChange}
                placeholder="Enter workflow name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflowDescription">Description</Label>
              <Textarea
                id="workflowDescription"
                value={description}
                onChange={handleDescriptionChange}
                placeholder="Optional description"
                rows={3}
              />
            </div>

            {selectedTemplate && (
              <div className="space-y-2">
                <Label>Steps</Label>
                <div className="space-y-2 max-h-48 overflow-auto">
                  {selectedTemplate.steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 text-sm p-2 bg-muted rounded"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        {step.stepNumber}
                      </span>
                      <span className="flex-1">{step.description}</span>
                      {step.requiresApproval && (
                        <Badge variant="outline" className="text-xs">
                          Needs approval
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "configure" && (
            <Button variant="outline" onClick={handleBackToSelect}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {step === "configure" && (
            <Button onClick={handleCreate} disabled={!name || createWorkflow.isPending}>
              {createWorkflow.isPending && <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />}
              Create Workflow
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// Add display name for CreateWorkflowDialog
CreateWorkflowDialog.displayName = "CreateWorkflowDialog";

export function WorkflowManager() {
  const { data: workflows, isLoading: loadingWorkflows } = useWorkflows();
  const { data: templates, isLoading: loadingTemplates } = useWorkflowTemplates();
  const { data: stats, isLoading: loadingStats } = useWorkflowStats();

  const isLoading = loadingWorkflows || loadingTemplates || loadingStats;

  // Memoize workflows list conversion
  const workflowsList = useMemo(
    () => (Array.isArray(workflows) ? workflows : []),
    [workflows]
  );

  // Memoize filtered workflows to avoid recomputing on every render
  const activeWorkflows = useMemo(
    () => workflowsList.filter((w) =>
      ["pending", "running", "paused", "awaiting_approval"].includes(w.status)
    ),
    [workflowsList]
  );

  const completedWorkflows = useMemo(
    () => workflowsList.filter((w) => w.status === "completed"),
    [workflowsList]
  );

  const failedWorkflows = useMemo(
    () => workflowsList.filter((w) => ["failed", "cancelled"].includes(w.status)),
    [workflowsList]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{stats.activeWorkflows}</p>
                </div>
                <Zap className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completedWorkflows}</p>
                </div>
                <CheckCircle2Icon className="h-8 w-8 text-success" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                  <p className="text-2xl font-bold">{stats.failedWorkflows}</p>
                </div>
                <XCircleIcon className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.totalWorkflows}</p>
                </div>
                <ClockIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Workflows */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Workflows</CardTitle>
              <CardDescription>Manage automated multi-step tasks</CardDescription>
            </div>
            {Array.isArray(templates) && templates.length > 0 && (
              <CreateWorkflowDialog templates={templates} />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active" className="gap-2">
                Active
                {activeWorkflows.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5">
                    {activeWorkflows.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="failed">Failed</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {activeWorkflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Zap className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No active workflows</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a new workflow to automate tasks
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {activeWorkflows.map((workflow) => (
                      <WorkflowCard key={workflow.id} workflow={workflow} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              {completedWorkflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2Icon className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No completed workflows</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {completedWorkflows.map((workflow) => (
                      <WorkflowCard key={workflow.id} workflow={workflow} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="failed" className="mt-4">
              {failedWorkflows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <XCircleIcon className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No failed workflows</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {failedWorkflows.map((workflow) => (
                      <WorkflowCard key={workflow.id} workflow={workflow} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="templates" className="mt-4">
              {(() => {
                const templatesList = Array.isArray(templates) ? templates : [];

                if (templatesList.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <ClockIcon className="h-12 w-12 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No templates available</p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-4 md:grid-cols-2">
                    {templatesList.map((template) => (
                    <Card key={template.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base">{template.name}</CardTitle>
                            {template.description && (
                              <CardDescription className="text-xs">
                                {template.description}
                              </CardDescription>
                            )}
                          </div>
                          {template.isBuiltIn && <Badge variant="secondary">Built-in</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>{template.steps.length} steps</span>
                            {template.estimatedDuration && (
                              <span className="flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                {template.estimatedDuration}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {template.steps.slice(0, 3).map((step, idx) => (
                              <div key={idx} className="text-xs text-muted-foreground truncate">
                                {step.stepNumber}. {step.description}
                              </div>
                            ))}
                            {template.steps.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{template.steps.length - 3} more steps
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
              })()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
