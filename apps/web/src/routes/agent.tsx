"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  CheckCircle2Icon,
  MessageSquare,
  Shield,
  Activity,
  Settings,
  AlertTriangleIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApprovalQueue } from "@/components/agent/approval-queue";
import { AgentSettings } from "@/components/agent/agent-settings";
import { AuditLogs } from "@/components/agent/audit-logs";
import { ChatInterface } from "@/components/agent/chat-interface";
import { usePendingApprovals, useUsageSummary } from "@/api/agent";
function QuickStats() {
  const { data: usage } = useUsageSummary();
  const { data: pendingApprovals } = usePendingApprovals(10);
  const [showApprovals, setShowApprovals] = useState(false);

  const approvalsList = Array.isArray(pendingApprovals) ? pendingApprovals : [];
  const pendingCount = approvalsList.filter((a) => a.status === "pending").length;

  return (
    <>
      {/* Compact inline stats bar */}
      <div className="flex items-center gap-6 py-2 px-1 text-sm">
        {/* Actions Today */}
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Actions Today</span>
          <span className="jetbrains-mono font-semibold tabular-nums">
            {usage?.today?.totalActions ?? 0}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Pending Approvals - Clickable */}
        <button
          onClick={() => setShowApprovals(true)}
          className={cn(
            "flex items-center gap-2 hover:text-primary transition-colors",
            pendingCount > 0 && "text-amber-600"
          )}
        >
          {pendingCount > 0 ? (
            <AlertTriangleIcon className="size-3.5 text-amber-500" />
          ) : (
            <CheckCircle2Icon className="size-3.5 text-emerald-500" />
          )}
          <span className="text-xs text-muted-foreground">Pending Approvals</span>
          <span className="jetbrains-mono font-semibold tabular-nums">{pendingCount}</span>
          <ChevronRightIcon className="size-3 text-muted-foreground" />
        </button>

        <div className="h-4 w-px bg-border" />

        {/* Tokens Used */}
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Tokens Used</span>
          <span className="jetbrains-mono font-semibold tabular-nums">
            {(usage?.today?.tokensUsed ?? 0).toLocaleString()}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Status */}
        <div className="flex items-center gap-2">
          <Shield className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Status</span>
          {usage?.emergencyStopEnabled ? (
            <Badge variant="destructive" className="rounded-none text-[10px] px-1.5 py-0 h-5">
              Stopped
            </Badge>
          ) : (
            <Badge className="rounded-none bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] px-1.5 py-0 h-5">
              Active
            </Badge>
          )}
        </div>
      </div>

      {/* Pending Approvals Dialog */}
      <Dialog open={showApprovals} onOpenChange={setShowApprovals}>
        <DialogContent className="max-w-2xl rounded-none p-0 gap-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-base jetbrains-mono">
              <AlertTriangleIcon className="size-4 text-amber-500" />
              Pending Approvals
              {pendingCount > 0 && (
                <Badge variant="secondary" className="rounded-none text-xs ml-2">
                  {pendingCount}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="p-0">
            <ApprovalQueue />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function Agent() {
  return (
    <div className="flex flex-col h-[calc(100vh-60px)] p-4 overflow-hidden">
      {/* Header row: Title + Stats inline */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center border bg-gradient-to-br from-primary/5 to-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">AI Co-Worker</h1>
            <p className="text-xs text-muted-foreground">Intelligent assistant for accounting and business automation</p>
          </div>
        </div>
        <QuickStats />
      </div>

      {/* Tabs - flex-1 to fill remaining space */}
      <Tabs defaultValue="chat" className="flex flex-col flex-1 min-h-0">
        <TabsList className="h-8 rounded-none bg-muted/50 p-0.5 shrink-0 w-fit">
          <TabsTrigger value="chat" className="rounded-none text-xs gap-1.5 data-[state=active]:bg-background h-7">
            <MessageSquare className="h-3 w-3" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="approvals" className="rounded-none text-xs gap-1.5 data-[state=active]:bg-background h-7">
            <Shield className="h-3 w-3" />
            Approvals
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-none text-xs gap-1.5 data-[state=active]:bg-background h-7">
            <Activity className="h-3 w-3" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-none text-xs gap-1.5 data-[state=active]:bg-background h-7">
            <Settings className="h-3 w-3" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 mt-3 min-h-0">
          <ChatInterface />
        </TabsContent>

        <TabsContent value="approvals" className="flex-1 mt-3 min-h-0 overflow-auto">
          <ApprovalQueue />
        </TabsContent>

        <TabsContent value="audit" className="flex-1 mt-3 min-h-0 overflow-auto">
          <AuditLogs />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 mt-3 min-h-0 overflow-auto">
          <AgentSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
