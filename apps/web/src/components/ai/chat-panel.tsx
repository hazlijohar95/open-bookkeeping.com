"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  SendIcon,
  Loader2Icon,
  Sparkles,
  UserIcon,
  Wrench,
  CheckCircle2Icon,
} from "@/components/ui/icons";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api-url";

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
};

export function ChatPanel() {
  const { session } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `${getApiUrl()}/api/ai/chat`,
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ""}`,
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
      void sendMessage({ text: input });
      setInput("");
    }
  };

  // Render message parts
  const renderMessageParts = (message: (typeof messages)[0]) => {
    return message.parts.map((part, index) => {
      if (part.type === "text") {
        return (
          <p key={index} className="whitespace-pre-wrap">
            {part.text}
          </p>
        );
      }

      if (part.type.startsWith("tool-")) {
        // AI SDK v5: properties are directly on part, not nested in toolInvocation
        const toolName = "toolName" in part ? String(part.toolName) : "tool";
        const label = TOOL_LABELS[toolName] || toolName;
        const isComplete = "state" in part && part.state === "done";

        return (
          <div
            key={index}
            className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 my-1"
          >
            {isComplete ? (
              <CheckCircle2Icon className="h-3 w-3 text-success" />
            ) : (
              <Loader2Icon className="h-3 w-3 animate-spin" />
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
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <SheetTitle className="text-base">AI Assistant</SheetTitle>
              <SheetDescription className="text-xs">
                Ask me about invoices, finances, and more
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                <Sparkles className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-sm mb-1">How can I help you?</h3>
              <p className="text-muted-foreground text-xs max-w-[200px] mb-4">
                I can help you with invoices, customers, quotations, and financial insights
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "What's my revenue this month?",
                  "Show overdue invoices",
                  "List my customers",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border bg-card hover:bg-accent transition-colors"
                  >
                    {suggestion}
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
                      "rounded-lg px-4 py-2.5 max-w-[85%] text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {renderMessageParts(message)}
                  </div>
                  {message.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                      <UserIcon className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 justify-start">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted rounded-lg px-4 py-2.5">
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
            Error: {error.message}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex gap-2 p-4 border-t bg-background"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your business..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
