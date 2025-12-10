"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  Loader2,
  Sparkles,
  User,
  Wrench,
  CheckCircle2,
  MessageSquare,
  Shield,
  Zap,
  Activity,
  Settings,
  AlertTriangle,
  Trash2,
} from "@/components/ui/icons";
import { ApprovalQueue } from "@/components/agent/approval-queue";
import { AgentSettings } from "@/components/agent/agent-settings";
import { WorkflowManager } from "@/components/agent/workflow-manager";
import { AuditLogs } from "@/components/agent/audit-logs";
import { usePendingApprovals, useUsageSummary } from "@/api/agent";

// Tool name to friendly label mapping
const TOOL_LABELS: Record<string, string> = {
  getDashboardStats: "Fetching dashboard statistics",
  listInvoices: "Loading invoices",
  getInvoiceDetails: "Getting invoice details",
  getAgingReport: "Generating aging report",
  listCustomers: "Loading customers",
  searchCustomers: "Searching customers",
  getCustomerInvoices: "Getting customer invoices",
  listQuotations: "Loading quotations",
  listBills: "Loading bills",
  getBillDetails: "Getting bill details",
  listVendors: "Loading vendors",
  getAccountBalance: "Getting account balance",
  getTrialBalance: "Generating trial balance",
  getProfitLoss: "Generating profit & loss",
  getBalanceSheet: "Generating balance sheet",
  createInvoice: "Creating invoice",
  createBill: "Creating bill",
  createJournalEntry: "Creating journal entry",
  postJournalEntry: "Posting to ledger",
  reverseJournalEntry: "Reversing journal entry",
  listAccounts: "Loading chart of accounts",
};

const QUICK_PROMPTS = [
  {
    label: "Monthly Summary",
    prompt: "Give me a summary of this month's revenue, expenses, and profit",
  },
  {
    label: "Overdue Invoices",
    prompt: "Show me all overdue invoices and their total value",
  },
  {
    label: "Top Customers",
    prompt: "Who are my top 5 customers by revenue this month?",
  },
  {
    label: "Cash Flow",
    prompt: "Analyze my cash flow - what's coming in and going out?",
  },
  {
    label: "Create Invoice",
    prompt: "Help me create an invoice for a new sale",
  },
  {
    label: "Record Expense",
    prompt: "Help me record a business expense",
  },
];

function ChatInterface() {
  const { session } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/ai/chat`,
      headers: {
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && status === "ready") {
      sendMessage({ text: input });
      setInput("");
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    if (status === "ready") {
      sendMessage({ text: prompt });
    }
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  // Render message parts
  const renderMessageParts = (message: (typeof messages)[0]) => {
    return message.parts.map((part, index) => {
      if (part.type === "text") {
        return (
          <div key={index} className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap m-0">{part.text}</p>
          </div>
        );
      }

      if (part.type.startsWith("tool-")) {
        const toolName = "toolName" in part ? String(part.toolName) : "tool";
        const label = TOOL_LABELS[toolName] || toolName;
        const isComplete = "state" in part && part.state === "done";

        return (
          <div
            key={index}
            className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 my-1"
          >
            {isComplete ? (
              <CheckCircle2 className="h-3 w-3 text-success" />
            ) : (
              <Loader2 className="h-3 w-3 animate-spin" />
            )}
            <Wrench className="h-3 w-3" />
            <span>{label}</span>
          </div>
        );
      }

      return null;
    });
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-240px)] min-h-[500px]">
      <CardHeader className="border-b py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Assistant</CardTitle>
              <CardDescription className="text-xs">
                Ask me to analyze data, create documents, or automate tasks
              </CardDescription>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="text-muted-foreground"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">How can I help you today?</h3>
            <p className="text-muted-foreground text-sm max-w-md mb-6">
              I can help you analyze your business data, create invoices and bills,
              manage journal entries, and automate accounting tasks.
            </p>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-w-2xl">
              {QUICK_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleQuickPrompt(item.prompt)}
                  className="text-left text-sm px-4 py-3 rounded-lg border bg-card hover:bg-accent transition-colors group"
                >
                  <span className="font-medium text-foreground group-hover:text-primary">
                    {item.label}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role !== "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 max-w-[85%] text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {renderMessageParts(message)}
                </div>
                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted rounded-lg px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm border-t">
          Error: {error.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t bg-background">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your business, create documents, or automate tasks..."
          disabled={isLoading}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </Card>
  );
}

function StatusBar() {
  const { data: pendingApprovals } = usePendingApprovals(10);
  const { data: usage } = useUsageSummary();

  const pendingCount = pendingApprovals?.filter((a) => a.status === "pending").length || 0;

  return (
    <div className="flex items-center gap-4 text-sm">
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 text-warning">
          <AlertTriangle className="h-4 w-4" />
          <span>{pendingCount} pending approval{pendingCount > 1 ? "s" : ""}</span>
        </div>
      )}
      {usage?.emergencyStopEnabled && (
        <Badge variant="destructive" className="gap-1">
          <Shield className="h-3 w-3" />
          Emergency Stop Active
        </Badge>
      )}
      {usage && !usage.emergencyStopEnabled && (
        <div className="flex items-center gap-4 text-muted-foreground">
          <span>{usage.today.totalActions} actions today</span>
          <span>{usage.remaining.tokens.toLocaleString()} tokens remaining</span>
        </div>
      )}
    </div>
  );
}

export function Agent() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agent</h1>
          <p className="text-muted-foreground">
            Your intelligent assistant for accounting and business automation
          </p>
        </div>
        <StatusBar />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="chat" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Approvals</span>
          </TabsTrigger>
          <TabsTrigger value="workflows" className="gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Workflows</span>
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Audit</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ChatInterface />
            </div>
            <div className="space-y-6">
              <ApprovalQueue />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="approvals">
          <div className="grid gap-6 lg:grid-cols-2">
            <ApprovalQueue />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Approval History</CardTitle>
                <CardDescription>Recent approval decisions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">
                  View full history in the Audit tab
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workflows">
          <WorkflowManager />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogs />
        </TabsContent>

        <TabsContent value="settings">
          <AgentSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
