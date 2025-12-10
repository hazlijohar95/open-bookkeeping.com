"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

// Custom icons from design system
import {
  SquareWandSparkleIcon,
  CircleCheckIcon,
  VersionsIcon,
  UsersIcon,
  GaugeIcon,
  FileFeatherIcon,
  TriangleWarningIcon,
  SyncIcon,
} from "@/assets/icons";

// Minimal lucide icons for UI controls only
import { ArrowLeft, Send, Loader2 } from "@/components/ui/icons";

// Tool configuration with custom icons
const TOOL_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  getDashboardStats: { icon: GaugeIcon, label: "Analyzing" },
  listInvoices: { icon: VersionsIcon, label: "Invoices" },
  getInvoiceDetails: { icon: VersionsIcon, label: "Invoice" },
  getAgingReport: { icon: GaugeIcon, label: "Report" },
  listCustomers: { icon: UsersIcon, label: "Customers" },
  searchCustomers: { icon: UsersIcon, label: "Searching" },
  getCustomerInvoices: { icon: VersionsIcon, label: "Invoices" },
  listQuotations: { icon: FileFeatherIcon, label: "Quotations" },
};

// Quick prompts
const QUICK_PROMPTS = [
  { text: "What's my revenue this month?", icon: GaugeIcon },
  { text: "Show overdue invoices", icon: VersionsIcon },
  { text: "Give me a business summary", icon: GaugeIcon },
  { text: "List my customers", icon: UsersIcon },
];

interface DashboardChatInputProps {
  className?: string;
}

export function DashboardChatInput({ className }: DashboardChatInputProps) {
  const { session } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/ai/chat`,
      headers: {
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      const viewport = scrollRef.current.querySelector('[data-slot="scroll-area-viewport"]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isExpanded]);

  // Expand when messages exist
  useEffect(() => {
    if (messages.length > 0) {
      setIsExpanded(true);
    }
  }, [messages.length]);

  // Focus textarea when expanded
  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  const handleBack = () => setIsExpanded(false);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // Render message parts
  const renderMessageParts = (message: (typeof messages)[0]) => {
    return message.parts.map((part, index) => {
      if (part.type === "text") {
        return (
          <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed">
            {part.text}
          </p>
        );
      }

      if (part.type.startsWith("tool-")) {
        // AI SDK v5: properties are directly on part, not nested in toolInvocation
        const toolName = "toolName" in part ? String(part.toolName) : "tool";
        const config = TOOL_CONFIG[toolName] || { icon: SyncIcon, label: toolName };
        const Icon = config.icon;
        const isComplete = "state" in part && part.state === "done";

        return (
          <span
            key={index}
            className={cn(
              "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded mr-1 mb-1",
              isComplete
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isComplete ? (
              <CircleCheckIcon className="size-3" />
            ) : (
              <Loader2 className="size-3 animate-spin" />
            )}
            <Icon className="size-3" />
            <span>{config.label}</span>
          </span>
        );
      }

      return null;
    });
  };

  // Full-page chat mode
  if (isExpanded) {
    return (
      <div className={cn("fixed inset-0 z-50 bg-background flex flex-col", className)}>
        {/* Header */}
        <header className="flex items-center gap-3 px-4 h-14 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="size-8"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10">
              <SquareWandSparkleIcon className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-medium">Assistant</h2>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Thinking..." : "Ask about your business"}
              </p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1" ref={scrollRef}>
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role !== "user" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <SquareWandSparkleIcon className="size-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 max-w-[80%]",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {renderMessageParts(message)}
                </div>
                {message.role === "user" && (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                    <span className="text-xs font-medium text-muted-foreground">You</span>
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 justify-start">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <SquareWandSparkleIcon className="size-3.5 text-primary" />
                </div>
                <div className="flex items-center gap-1.5 bg-muted rounded-lg px-3 py-2">
                  <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <span className="size-1.5 rounded-full bg-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm flex items-center gap-2 justify-center">
            <TriangleWarningIcon className="size-4" />
            <span>{error.message}</span>
          </div>
        )}

        {/* Input */}
        <div className="border-t shrink-0">
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4">
            <div className="flex items-end gap-2 rounded-none bg-white dark:bg-slate-900 px-4 py-3 border border-border/40 focus-within:border-primary/40 transition-colors duration-200">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                disabled={isLoading}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 py-1 max-h-28"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="size-8 shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Collapsed input bar
  return (
    <div className={cn("w-full", className)}>
      {/* Quick Prompts */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-hide">
        {QUICK_PROMPTS.map(({ text, icon: Icon }) => (
          <button
            key={text}
            onClick={() => handleQuickPrompt(text)}
            disabled={isLoading}
            className="shrink-0 flex items-center gap-1.5 text-xs px-4 py-2 rounded-none bg-white dark:bg-slate-900 border border-border/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors duration-200 disabled:opacity-50"
          >
            <Icon className="size-3.5 text-muted-foreground" />
            <span>{text}</span>
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3 rounded-none bg-white dark:bg-slate-900 px-4 py-3 border border-border/40 focus-within:border-primary/40 transition-colors duration-200">
          <div className="flex size-8 shrink-0 items-center justify-center bg-primary/10">
            <SquareWandSparkleIcon className="size-4 text-primary" />
          </div>

          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              if (messages.length > 0) {
                setIsExpanded(true);
              }
            }}
            placeholder="Ask anything about your business..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          />

          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="size-8 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
