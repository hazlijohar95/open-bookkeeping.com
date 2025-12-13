/**
 * Migration Assistant Chat Component
 * Embedded AI chat for migration/setup wizard help
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { getApiUrl } from "@/lib/api-url";
import {
  XIcon,
  SendIcon,
  Loader2Icon,
  SparklesIcon,
  ChevronDownIcon,
} from "@/components/ui/icons";

interface MigrationAssistantProps {
  sessionId?: string;
  currentStep?: string;
  className?: string;
}

// Quick prompts for migration help
const QUICK_PROMPTS = [
  { label: "What is a trial balance?", prompt: "Explain what a trial balance is and why it must balance." },
  { label: "Help with account mapping", prompt: "I need help mapping my imported accounts to the chart of accounts." },
  { label: "Debit vs Credit?", prompt: "Explain the difference between debits and credits in accounting." },
  { label: "Check my migration", prompt: "Check my migration status and tell me if there are any issues." },
];

// Type for messages from useChat
type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  createdAt?: Date;
};

// Helper to extract text content from message parts
function getMessageText(message: ChatMessage): string {
  if (!message.parts) return "";
  return message.parts
    .filter((part): part is { type: string; text: string } => part.type === "text" && typeof part.text === "string")
    .map(part => part.text)
    .join("");
}

export function MigrationAssistant({
  sessionId,
  currentStep,
  className,
}: MigrationAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { session } = useAuth();

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${getApiUrl()}/api/ai/chat`,
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ""}`,
        "Content-Type": "application/json",
      },
      body: {
        context: {
          type: "migration",
          sessionId,
          currentStep,
        },
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Cast messages to our type
  const typedMessages = messages as ChatMessage[];

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isLoading) return;

      void sendMessage({ text: inputValue.trim() });
      setInputValue("");
    },
    [inputValue, isLoading, sendMessage]
  );

  const handleQuickPrompt = useCallback(
    (prompt: string) => {
      void sendMessage({ text: prompt });
    },
    [sendMessage]
  );

  return (
    <>
      {/* Floating toggle button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn("fixed bottom-6 right-6 z-50", className)}
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="lg"
              className="rounded-full size-14 shadow-lg"
            >
              <SparklesIcon className="size-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed bottom-6 right-6 z-50 w-[400px] max-h-[600px]",
              className
            )}
          >
            <Card className="flex flex-col h-[500px] shadow-2xl border-2">
              {/* Header */}
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-3 border-b">
                <CardTitle className="flex items-center gap-2 text-base">
                  <SparklesIcon className="size-5 text-primary" />
                  Migration Assistant
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="size-8 p-0"
                  >
                    <ChevronDownIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="size-8 p-0"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4" ref={scrollRef}>
                  <div className="space-y-4">
                    {/* Welcome message if no messages yet */}
                    {typedMessages.length === 0 && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted">
                          <div className="whitespace-pre-wrap">
                            Hi! I'm your migration assistant. I can help you with:
                            {"\n\n"}
                            - Understanding accounting concepts{"\n"}
                            - Mapping accounts{"\n"}
                            - Fixing validation errors{"\n"}
                            - Answering questions about the setup process
                            {"\n\n"}
                            How can I help you today?
                          </div>
                        </div>
                      </div>
                    )}

                    {typedMessages.map((message) => {
                      const text = getMessageText(message);
                      if (!text) return null;

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex",
                            message.role === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <div className="whitespace-pre-wrap">{text}</div>
                          </div>
                        </div>
                      );
                    })}

                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <Loader2Icon className="size-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Quick prompts */}
              {typedMessages.length <= 2 && (
                <div className="px-4 pb-2">
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((qp) => (
                      <button
                        key={qp.label}
                        onClick={() => handleQuickPrompt(qp.prompt)}
                        className="text-xs px-2 py-1 rounded-full border bg-background hover:bg-muted transition-colors"
                      >
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-4 pt-2 border-t">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask a question..."
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!inputValue.trim() || isLoading}
                    className="size-9 p-0"
                  >
                    {isLoading ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <SendIcon className="size-4" />
                    )}
                  </Button>
                </form>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
