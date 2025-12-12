"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Bot,
  SendIcon,
  Loader2Icon,
  Sparkles,
  UserIcon,
  RotateCcw,
  ChevronDownIcon,
} from "@/components/ui/icons";
import { mobileMotion, mobileTypography } from "@/lib/design-tokens";

// ============================================================================
// TYPES
// ============================================================================

export interface MobileChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
  toolCalls?: Array<{
    name: string;
    status: "pending" | "complete" | "error";
  }>;
}

export interface MobileChatInterfaceProps {
  messages: MobileChatMessage[];
  onSendMessage: (message: string) => void;
  onClearChat?: () => void;
  isLoading?: boolean;
  error?: Error | null;
  placeholder?: string;
  quickPrompts?: Array<{ label: string; prompt: string }>;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_QUICK_PROMPTS = [
  { label: "Monthly Summary", prompt: "Give me a summary of this month's revenue, expenses, and profit" },
  { label: "Overdue Invoices", prompt: "Show me all overdue invoices and their total value" },
  { label: "Top Customers", prompt: "Who are my top 5 customers by revenue this month?" },
  { label: "Create Invoice", prompt: "Help me create an invoice for a new sale" },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function MobileChatInterface({
  messages,
  onSendMessage,
  onClearChat,
  isLoading = false,
  error,
  placeholder = "Ask me anything...",
  quickPrompts = DEFAULT_QUICK_PROMPTS,
  className,
}: MobileChatInterfaceProps) {
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Show/hide scroll-to-bottom button
  const handleScroll = React.useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  }, []);

  const scrollToBottom = React.useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  // Handle form submission
  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      onSendMessage(trimmed);
      setInput("");
    },
    [input, isLoading, onSendMessage]
  );

  // Handle keyboard submission
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit]
  );

  // Quick prompt handler
  const handleQuickPrompt = React.useCallback(
    (prompt: string) => {
      if (!isLoading) {
        onSendMessage(prompt);
      }
    },
    [isLoading, onSendMessage]
  );

  const filteredMessages = messages.filter((m) => m.role !== "system");
  const hasMessages = filteredMessages.length > 0;

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="flex-none border-b px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
            <div>
              <h2 className={cn(mobileTypography.cardTitle)}>AI Assistant</h2>
              <p className={cn(mobileTypography.cardMeta)}>
                {isLoading ? "Thinking..." : "Ready to help"}
              </p>
            </div>
          </div>
          {hasMessages && onClearChat && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearChat}
              className="h-9 gap-1.5"
            >
              <RotateCcw className="size-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-bar-hidden"
      >
        {!hasMessages ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex size-16 items-center justify-center rounded-full bg-primary/10 mb-4"
            >
              <Sparkles className="size-7 text-primary" />
            </motion.div>
            <h3 className={cn(mobileTypography.sectionTitle, "mb-2")}>
              How can I help?
            </h3>
            <p className={cn(mobileTypography.cardSubtitle, "mb-6 max-w-xs")}>
              I can analyze your data, create documents, and automate accounting tasks.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {quickPrompts.map((item) => (
                <motion.button
                  key={item.label}
                  whileTap={mobileMotion.cardTap}
                  onClick={() => handleQuickPrompt(item.prompt)}
                  className="text-left text-sm px-4 py-3 border rounded-lg bg-card hover:bg-accent active:bg-accent transition-colors"
                >
                  {item.label}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          // Message list
          <div className="px-4 py-3 space-y-3">
            <AnimatePresence initial={false}>
              {filteredMessages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role !== "user" && (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Bot className="size-4 text-muted-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 max-w-[80%]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    )}
                  >
                    {/* Tool calls indicator */}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {message.toolCalls.map((tool, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded",
                              tool.status === "pending" && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
                              tool.status === "complete" && "bg-green-500/20 text-green-700 dark:text-green-400",
                              tool.status === "error" && "bg-red-500/20 text-red-700 dark:text-red-400"
                            )}
                          >
                            {tool.status === "pending" && (
                              <Loader2Icon className="size-2 animate-spin" />
                            )}
                            {tool.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <p
                      className={cn(
                        "text-sm leading-relaxed whitespace-pre-wrap",
                        message.isStreaming && "animate-pulse"
                      )}
                    >
                      {message.content}
                      {message.isStreaming && (
                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />
                      )}
                    </p>
                    {message.timestamp && (
                      <p className="text-[10px] opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary">
                      <UserIcon className="size-4 text-primary-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && filteredMessages[filteredMessages.length - 1]?.role === "user" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 justify-start"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Bot className="size-4 text-muted-foreground" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="size-2 rounded-full bg-muted-foreground/40 animate-mobile-bounce" />
                    <span
                      className="size-2 rounded-full bg-muted-foreground/40 animate-mobile-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <span
                      className="size-2 rounded-full bg-muted-foreground/40 animate-mobile-bounce"
                      style={{ animationDelay: "0.4s" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-24 right-4 size-10 rounded-full bg-card border shadow-lg flex items-center justify-center"
          >
            <ChevronDownIcon className="size-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Error */}
      {error && (
        <div className="flex-none px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error.message}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex-none border-t bg-card px-4 py-3 safe-bottom"
      >
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            className="min-h-[44px] max-h-[120px] resize-none rounded-xl text-base"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="size-11 rounded-full shrink-0"
          >
            {isLoading ? (
              <Loader2Icon className="size-5 animate-spin" />
            ) : (
              <SendIcon className="size-5" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default MobileChatInterface;
