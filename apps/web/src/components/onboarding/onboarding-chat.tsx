"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useCallback } from "react";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bot,
  SendIcon,
  Loader2Icon,
  Sparkles,
  UserIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import { motion, AnimatePresence } from "motion/react";

// Quick reply options for common responses
const QUICK_REPLIES: Record<string, string[]> = {
  businessSize: ["Solo / Freelancer", "2-10 employees", "11-50 employees", "50+ employees"],
  accountingMethod: ["Cash basis", "Accrual basis", "Not sure"],
  yesNo: ["Yes", "No"],
  fiscalYear: ["December (Calendar Year)", "March (Government FY)", "June", "Other"],
  referral: ["Google Search", "Social Media", "Friend/Colleague", "Other"],
};

// Detect which quick replies to show based on conversation
function detectQuickReplies(lastMessage: string): string[] | null {
  const lower = lastMessage.toLowerCase();

  if (lower.includes("how many") && (lower.includes("employee") || lower.includes("team") || lower.includes("people"))) {
    return QUICK_REPLIES.businessSize ?? null;
  }
  if (lower.includes("accounting method") || lower.includes("cash or accrual") || lower.includes("cash basis")) {
    return QUICK_REPLIES.accountingMethod ?? null;
  }
  if (lower.includes("malaysia") && (lower.includes("based") || lower.includes("located"))) {
    return QUICK_REPLIES.yesNo ?? null;
  }
  if (lower.includes("sst") && lower.includes("registered")) {
    return QUICK_REPLIES.yesNo ?? null;
  }
  if (lower.includes("fiscal year") || lower.includes("financial year")) {
    return QUICK_REPLIES.fiscalYear ?? null;
  }
  if (lower.includes("hear about us") || lower.includes("find us") || lower.includes("discover")) {
    return QUICK_REPLIES.referral ?? null;
  }
  return null;
}

// Type for messages from useChat (AI SDK v5)
type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  createdAt?: Date;
};

// Extract text content from a message
function extractTextContent(message: ChatMessage): string {
  if (message.parts && message.parts.length > 0) {
    const textParts = message.parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text as string);
    return textParts.join("\n");
  }
  return "";
}

interface OnboardingChatProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingChat({ onComplete, onSkip }: OnboardingChatProps) {
  const { session } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[] | null>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${getApiUrl()}/api/ai/onboarding`,
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
    }),
    onFinish: ({ message }) => {
      const content = extractTextContent(message as ChatMessage);
      // Check if onboarding is complete (look for redirect signal in message)
      if (content.includes("Redirecting") || content.includes("all set")) {
        setTimeout(() => {
          onComplete();
        }, 2000);
      }

      // Detect quick replies for the last assistant message
      const replies = detectQuickReplies(content);
      setQuickReplies(replies);
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Auto-focus input
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  // Handle quick reply click
  const handleQuickReply = useCallback((reply: string) => {
    setQuickReplies(null);
    void sendMessage({ text: reply });
  }, [sendMessage]);

  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    setQuickReplies(null);
    void sendMessage({ text: input.trim() });
    setInput("");
  }, [input, isLoading, sendMessage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-2xl"
      >
        <Card className="overflow-hidden shadow-2xl border-border/50 backdrop-blur">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/50 bg-card/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Welcome to Open Bookkeeping</h2>
                <p className="text-xs text-muted-foreground">Let's get you set up</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip for now
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="h-[400px] overflow-y-auto p-4 space-y-4 scroll-smooth"
          >
            {/* Initial welcome if no messages */}
            {messages.length === 0 && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                  <p className="text-sm text-foreground">
                    Welcome to Open Bookkeeping! I'm here to help set up your account.
                    Let's start with a quick introduction - what's your company or business name?
                  </p>
                </div>
              </motion.div>
            )}

            {/* Message list */}
            <AnimatePresence mode="popLayout">
              {messages.map((message) => {
                const content = extractTextContent(message as ChatMessage);
                if (!content) return null;

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex items-start gap-3",
                      message.role === "user" && "flex-row-reverse"
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback
                        className={cn(
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        {message.role === "user" ? (
                          <UserIcon className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 max-w-[85%]",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted/50 text-foreground rounded-tl-sm"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{content}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Typing indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                      className="h-2 w-2 rounded-full bg-muted-foreground/50"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                      className="h-2 w-2 rounded-full bg-muted-foreground/50"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                      className="h-2 w-2 rounded-full bg-muted-foreground/50"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Quick replies */}
          <AnimatePresence>
            {quickReplies && quickReplies.length > 0 && !isLoading && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-2 overflow-hidden"
              >
                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((reply, idx) => (
                    <motion.button
                      key={`${reply}-${idx}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleQuickReply(reply)}
                      className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      {reply}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <form
            id="onboarding-form"
            onSubmit={onSubmit}
            className="p-4 border-t border-border/50 bg-card/50"
          >
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your response..."
                disabled={isLoading}
                className="flex-1 bg-background/50 border-border/50 focus-visible:ring-primary/50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="shrink-0"
              >
                {isLoading ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <SendIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Type "skip" to skip any question
            </p>
          </form>
        </Card>

        {/* Trial banner below card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 text-center"
        >
          <p className="text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 inline-block mr-1 text-primary" />
            You have <span className="font-medium text-foreground">7 days</span> of full access to explore all features
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default OnboardingChat;
