"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useCallback, useMemo, memo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api-url";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Bot,
  SendIcon,
  Loader2Icon,
  Sparkles,
  UserIcon,
  RotateCcw,
  Plus,
} from "@/components/ui/icons";
import { DocumentUpload, ChatDropZone, type PendingFile } from "@/components/agent/document-upload";
import { DocumentPreview, CompactDocumentPreview } from "@/components/agent/document-preview";
import { MarkdownRenderer } from "@/components/agent/markdown-renderer";
import { QuickReply } from "@/components/agent/quick-reply";
import { ToolResultCard } from "@/components/agent/tool-result-card";
import { CommandPalette } from "@/components/agent/command-palette";
import { VirtualizedMessages } from "@/components/agent/virtualized-messages";
import { useUploadDocument } from "@/api/vault";
import { toast } from "sonner";
import {
  useAgentChatStore,
  useAgentMessages,
  useAgentThreads,
  aiMessageToIDBParts,
} from "@/hooks/use-agent-chat-store";
import { useChatBackgroundSync } from "@/hooks/use-chat-background-sync";
import type { IDBAgentMessage } from "@/types/indexdb";

const QUICK_PROMPTS = [
  { label: "Monthly Summary", prompt: "Give me a summary of this month's revenue, expenses, and profit" },
  { label: "Overdue Invoices", prompt: "Show me all overdue invoices and their total value" },
  { label: "Top Customers", prompt: "Who are my top 5 customers by revenue this month?" },
  { label: "Create Invoice", prompt: "Help me create an invoice for a new sale" },
];

// AI SDK v5 part types
type ToolPart = {
  type: string;
  toolName: string;
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
};

// Type for messages from useChat
type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts?: Array<{ type: string; [key: string]: unknown }>;
  createdAt?: Date;
};

export interface ChatInterfaceProps {
  // No props currently, but defined for future extensibility
}

export const ChatInterface = memo(function ChatInterface(_props: ChatInterfaceProps) {
  const { session } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);

  // Get userId for user isolation (CRITICAL: prevents cross-account data leaks)
  const userId = session?.user?.id ?? null;

  // Restore agent session from user-scoped localStorage
  useEffect(() => {
    if (userId) {
      const storedSessionId = localStorage.getItem(`agent_session_id_${userId}`);
      if (storedSessionId) {
        setAgentSessionId(storedSessionId);
      }
    }
  }, [userId]);

  // Document upload state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const uploadMutation = useUploadDocument();

  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Cmd+K shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // T3-style IndexedDB chat store (user-scoped)
  const chatStore = useAgentChatStore(userId);
  const { messages: idbMessages, isLoading: idbLoading } = useAgentMessages(chatStore.currentThreadId);
  const { threads } = useAgentThreads(userId);
  const streamingMessageIdRef = useRef<string | null>(null);
  const lastSyncedMessageCountRef = useRef(0);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: `${getApiUrl()}/api/ai/chat`,
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ""}`,
        ...(agentSessionId ? { "X-Session-Id": agentSessionId } : {}),
      },
      // Capture sessionId from response headers
      fetch: async (url, options) => {
        const response = await fetch(url, options);
        const newSessionId = response.headers.get("X-Session-Id");
        if (newSessionId && newSessionId !== agentSessionId && userId) {
          setAgentSessionId(newSessionId);
          // CRITICAL: Use user-scoped key to prevent cross-account leaks
          localStorage.setItem(`agent_session_id_${userId}`, newSessionId);
          // Link thread to server session
          if (chatStore.currentThreadId) {
            void chatStore.linkToServerSession(chatStore.currentThreadId, newSessionId);
          }
        }
        return response;
      },
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Track which message IDs have been synced to avoid duplicates
  const syncedMessageIdsRef = useRef<Set<string>>(new Set());

  // Track if we're clearing to prevent IDB reload race condition
  const isClearingRef = useRef(false);

  // Track if we're syncing to prevent concurrent sync operations (race condition guard)
  const isSyncingRef = useRef(false);

  // Track completed stream IDs to prevent double completion (race condition guard)
  const completedStreamIdsRef = useRef<Set<string>>(new Set());

  // T3-style background sync to PostgreSQL
  const { triggerSync } = useChatBackgroundSync({
    enabled: true,
    onSyncComplete: () => {
      // Sync completed successfully
    },
    onSyncError: () => {
      // Sync error handled silently - will retry automatically
    },
  });

  // Initialize thread on mount and cleanup invalid messages
  useEffect(() => {
    const init = async () => {
      const threadId = await chatStore.getOrCreateThread();
      // Clean up any corrupted/empty messages from previous sessions
      if (threadId) {
        await chatStore.cleanupInvalidMessages(threadId);
      }
    };
    void init();
  }, []);

  // Load messages from IndexedDB on mount (T3-style: local-first)
  useEffect(() => {
    // Don't reload from IDB if we're in the middle of clearing
    if (isClearingRef.current) {
      return;
    }

    if (!idbLoading && idbMessages.length > 0 && messages.length === 0) {
      // Filter out messages with empty parts (incomplete/corrupt messages)
      const validMessages = idbMessages.filter((msg: IDBAgentMessage) => {
        // User messages should have at least one text part with content
        if (msg.role === "user") {
          return msg.parts.some((p) => p.type === "text" && p.text && p.text.trim().length > 0);
        }
        // Assistant messages should have at least one part with content
        return msg.parts.length > 0 && msg.parts.some((p) => {
          if (p.type === "text") return p.text && p.text.trim().length > 0;
          return p.type.startsWith("tool-") || p.toolName; // Tool parts are valid
        });
      });

      if (validMessages.length === 0) {
        return; // No valid messages to load
      }

      // Convert IDB messages to AI SDK format
      // We use type assertion because IDB stores a simplified version of the message
      // that is compatible at runtime with the AI SDK's UIMessage format
      const aiMessages = validMessages.map((msg: IDBAgentMessage) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        // Parts are stored in IDB with the same structure as AI SDK parts
        parts: msg.parts,
        createdAt: new Date(msg.createdAt),
      }));
       
      setMessages(aiMessages as any);
      lastSyncedMessageCountRef.current = validMessages.length;
      // Mark loaded messages as already synced to prevent re-syncing
      validMessages.forEach((msg) => syncedMessageIdsRef.current.add(msg.id));
    }
  }, [idbLoading, idbMessages, messages.length, setMessages]);

  // Sync new messages to IndexedDB (T3-style: stream to local)
  useEffect(() => {
    const syncToIndexedDB = async () => {
      // Guard against concurrent sync operations (race condition fix)
      if (isSyncingRef.current) return;
      if (!chatStore.currentThreadId || messages.length === 0) return;

      isSyncingRef.current = true;
      try {
        for (const msg of messages) {
          const msgAny = msg as any;
          const msgId = msgAny.id as string;

          if (msgAny.role === "user") {
            // User messages - save once
            if (!syncedMessageIdsRef.current.has(msgId)) {
              const textPart = msgAny.parts?.find((p: { type: string }) => p.type === "text");
              if (textPart?.text) {
                await chatStore.addUserMessage(chatStore.currentThreadId, textPart.text);
                syncedMessageIdsRef.current.add(msgId);
              }
            }
          } else if (msgAny.role === "assistant") {
            // Assistant messages - handle streaming
            // Start a streaming message if this is a new assistant message
            if (!syncedMessageIdsRef.current.has(msgId) && !streamingMessageIdRef.current) {
              streamingMessageIdRef.current = await chatStore.startAssistantMessage(
                chatStore.currentThreadId
              );
            }

            // Update streaming message with current parts (T3-style: write as tokens arrive)
            if (streamingMessageIdRef.current && msgAny.parts) {
              await chatStore.updateStreamingMessage(
                streamingMessageIdRef.current,
                aiMessageToIDBParts(msgAny.parts)
              );
            }
          }
        }

        lastSyncedMessageCountRef.current = messages.length;
      } finally {
        isSyncingRef.current = false;
      }
    };

    void syncToIndexedDB();
  }, [messages, chatStore]);

  // Complete streaming message when status changes from streaming
  useEffect(() => {
    if (status === "ready" && streamingMessageIdRef.current) {
      const streamId = streamingMessageIdRef.current;

      // Guard against double completion (race condition fix)
      if (completedStreamIdsRef.current.has(streamId)) {
        streamingMessageIdRef.current = null;
        return;
      }

      const lastMessage = messages[messages.length - 1];
      const lastMsgAny = lastMessage as any;

      if (lastMsgAny?.role === "assistant" && lastMsgAny.parts) {
        // Mark as completed before async operation to prevent re-entry
        completedStreamIdsRef.current.add(streamId);

        void chatStore.completeStreamingMessage(
          streamId,
          aiMessageToIDBParts(lastMsgAny.parts)
        );
        // Mark message as synced after completion
        if (lastMsgAny.id) {
          syncedMessageIdsRef.current.add(lastMsgAny.id);
        }
        // Trigger background sync to PostgreSQL (T3-style: sync after message completes)
        triggerSync();
      }
      streamingMessageIdRef.current = null;
    }
  }, [status, messages, chatStore, triggerSync]);

  // Clear session when starting fresh
  const handleClearChat = useCallback(async () => {
    // Set clearing flag FIRST to prevent race condition with IDB reload effect
    isClearingRef.current = true;

    // Clear pending files
    pendingFiles.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setPendingFiles([]);

    // Clear session (user-scoped key)
    setAgentSessionId(null);
    if (userId) {
      localStorage.removeItem(`agent_session_id_${userId}`);
    }

    // Clear IndexedDB thread messages FIRST (before clearing React state)
    if (chatStore.currentThreadId) {
      await chatStore.clearThreadMessages(chatStore.currentThreadId);
      lastSyncedMessageCountRef.current = 0;
      streamingMessageIdRef.current = null;
      syncedMessageIdsRef.current.clear();
      // Also clear completed stream IDs
      completedStreamIdsRef.current.clear();
    }

    // Now clear React messages state (after IDB is cleared)
    setMessages([]);

    // Reset clearing flag after next paint cycle (deterministic timing instead of arbitrary 100ms)
    // This ensures React has finished updating before we allow IDB reload effects to run
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isClearingRef.current = false;
      });
    });
  }, [setMessages, pendingFiles, chatStore, userId]);

  // Thread handlers
  const handleSelectThread = useCallback(async (threadId: string) => {
    // Clear current messages
    setMessages([]);
    syncedMessageIdsRef.current.clear();
    lastSyncedMessageCountRef.current = 0;
    streamingMessageIdRef.current = null;

    // Clear session to start fresh with new thread (user-scoped key)
    setAgentSessionId(null);
    if (userId) {
      localStorage.removeItem(`agent_session_id_${userId}`);
    }

    // Switch to the selected thread (localStorage handled by chatStore hook)
    chatStore.setCurrentThreadId(threadId);
  }, [setMessages, chatStore, userId]);

  const handleCreateThread = useCallback(async () => {
    // Clear current messages
    setMessages([]);
    syncedMessageIdsRef.current.clear();
    lastSyncedMessageCountRef.current = 0;
    streamingMessageIdRef.current = null;

    // Clear session (user-scoped key)
    setAgentSessionId(null);
    if (userId) {
      localStorage.removeItem(`agent_session_id_${userId}`);
    }

    // Create new thread
    return chatStore.createThread();
  }, [setMessages, chatStore, userId]);

  const handleDeleteThread = useCallback(async (threadId: string) => {
    await chatStore.deleteThread(threadId);

    // If we deleted the current thread, create a new one
    if (threadId === chatStore.currentThreadId) {
      const newThreadId = await chatStore.createThread();
      void handleSelectThread(newThreadId);
    }
  }, [chatStore, handleSelectThread]);

  // Document upload handlers
  const handleFilesAdded = useCallback((newFiles: PendingFile[]) => {
    setPendingFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleFileRemove = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  const handleClearFiles = useCallback(() => {
    pendingFiles.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setPendingFiles([]);
  }, [pendingFiles]);

  // Upload files to vault and return document IDs
  const uploadFilesToVault = useCallback(async (files: PendingFile[]): Promise<string[]> => {
    const documentIds: string[] = [];

    for (const pendingFile of files) {
      try {
        const base64 = await fileToBase64(pendingFile.file);
        const result = await uploadMutation.mutateAsync({
          fileName: pendingFile.file.name,
          mimeType: pendingFile.file.type,
          base64,
        });
        documentIds.push(result.id);
      } catch (error) {
        console.error("Failed to upload file:", pendingFile.file.name, error);
        toast.error(`Failed to upload ${pendingFile.file.name}`);
      }
    }

    return documentIds;
  }, [uploadMutation]);

  // Convert File to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        if (base64) resolve(base64);
        else reject(new Error("Failed to convert file to base64"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if we have content to send (text or files)
    const hasText = input.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;

    if (!hasText && !hasFiles) return;
    if (status !== "ready" && !isUploading) return;

    let messageText = input.trim();
    let documentIds: string[] = [];

    // If we have files, upload them first
    if (hasFiles) {
      setIsUploading(true);
      try {
        documentIds = await uploadFilesToVault(pendingFiles);

        // Build message with document context
        const fileNames = pendingFiles.map((f) => f.file.name).join(", ");
        const docContext = `[Uploaded ${pendingFiles.length} document${pendingFiles.length > 1 ? "s" : ""}: ${fileNames}]\n[Document IDs: ${documentIds.join(", ")}]`;

        if (hasText) {
          messageText = `${messageText}\n\n${docContext}`;
        } else {
          messageText = `I've uploaded ${pendingFiles.length} document${pendingFiles.length > 1 ? "s" : ""} (${fileNames}). Please process them.\n\n${docContext}`;
        }

        // Clear pending files after successful upload
        pendingFiles.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
        setPendingFiles([]);
        toast.success(`Uploaded ${documentIds.length} document${documentIds.length > 1 ? "s" : ""}`);
      } catch (error) {
        console.error("Failed to upload files:", error);
        toast.error("Failed to upload some files");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    // Send the message
    if (messageText) {
      void sendMessage({ text: messageText });
      setInput("");
    }
  }, [input, pendingFiles, status, isUploading, uploadFilesToVault, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e);
    }
  }, [handleSubmit]);

  // Helper to extract text from various message formats
  const extractTextContent = useCallback((message: ChatMessage): string | null => {
    // Try parts first (AI SDK v5 primary format)
    if (message.parts && message.parts.length > 0) {
      const textParts = message.parts
        .filter((p) => p.type === "text")
        .map((p) => (p as { type: string; text: string }).text)
        .filter(Boolean);
      if (textParts.length > 0) {
        return textParts.join("\n");
      }
    }

    // Fallback to content field (AI SDK v4 / other formats)
    const msgAny = message as unknown as Record<string, unknown>;
    if (typeof msgAny.content === "string" && msgAny.content) {
      return msgAny.content;
    }

    // Try text field directly
    if (typeof msgAny.text === "string" && msgAny.text) {
      return msgAny.text;
    }

    return null;
  }, []);

  // Memoize the renderMessageParts function
  const renderMessageParts = useMemo(() => {
    return (message: ChatMessage) => {
      const elements: React.ReactNode[] = [];

      // If no parts array, try alternative fields
      if (!message.parts || message.parts.length === 0) {
        const textContent = extractTextContent(message);
        if (textContent) {
          // Use markdown for assistant messages, plain text for user
          if (message.role === "assistant") {
            return <MarkdownRenderer content={textContent} />;
          }
          return (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {textContent}
            </div>
          );
        }
        return <div className="text-muted-foreground text-xs">(empty message)</div>;
      }

      // Process each part
      for (let index = 0; index < message.parts.length; index++) {
        const part = message.parts[index];
        if (!part) continue; // Skip undefined parts

        const partAny = part as unknown as Record<string, unknown>;

        // Text parts - handle multiple formats
        if (part.type === "text") {
          const textPart = part as { type: string; text: string };
          const textValue = textPart.text || (partAny.value as string) || (partAny.content as string);
          if (textValue && textValue.trim()) {
            // Use markdown for assistant messages, plain text for user
            if (message.role === "assistant") {
              elements.push(
                <MarkdownRenderer key={`text-${index}`} content={textValue} />
              );
            } else {
              elements.push(
                <div key={`text-${index}`} className="whitespace-pre-wrap text-sm leading-relaxed">
                  {textValue}
                </div>
              );
            }
          }
          continue;
        }

        // Tool parts - AI SDK v5 uses "tool-{toolName}" as the type
        if (part.type.startsWith("tool-")) {
          const toolPart = part as unknown as ToolPart;
          const toolName = toolPart.toolName || part.type.replace("tool-", "");

          elements.push(
            <ToolResultCard
              key={toolPart.toolCallId || `tool-${index}`}
              toolName={toolName}
              toolCallId={toolPart.toolCallId || `tool-${index}`}
              state={toolPart.state}
              input={toolPart.input}
              output={toolPart.output}
              errorText={toolPart.errorText}
            />
          );
          continue;
        }

        // Handle tool-invocation (alternative format)
        if (part.type === "tool-invocation" || part.type === "tool-call") {
          const toolName = ((partAny.toolName as string) || (partAny.name as string)) ?? "tool";
          const state = (partAny.state as string) ?? "output-available";
          const toolCallId = (partAny.toolCallId as string) || `tool-inv-${index}`;

          elements.push(
            <ToolResultCard
              key={toolCallId}
              toolName={toolName}
              toolCallId={toolCallId}
              state={state as "input-streaming" | "input-available" | "output-available" | "output-error"}
              input={partAny.input as Record<string, unknown> | undefined}
              output={partAny.output || partAny.result}
              errorText={partAny.errorText as string | undefined}
            />
          );
          continue;
        }

        // Handle reasoning/thinking parts if present
        if (part.type === "reasoning") {
          const reasoningPart = part as { type: string; reasoning?: string };
          if (reasoningPart.reasoning) {
            elements.push(
              <div key={`reasoning-${index}`} className="text-xs text-muted-foreground italic bg-muted/30 px-2 py-1.5 my-1 border-l-2 border-muted-foreground/30">
                {reasoningPart.reasoning}
              </div>
            );
          }
          continue;
        }

        // Step start parts (AI SDK v5)
        if (part.type === "step-start") {
          continue; // Skip step-start, it's just a marker
        }

        // Unknown part type - render as text if it has text content
        const unknownText = (partAny.text as string) || (partAny.content as string) || (partAny.value as string);
        if (unknownText && typeof unknownText === "string" && unknownText.trim()) {
          elements.push(
            <div key={`unknown-${index}`} className="whitespace-pre-wrap text-sm leading-relaxed">
              {unknownText}
            </div>
          );
        }
      }

      // If we processed parts but got no elements, try to extract text content as fallback
      if (elements.length === 0) {
        const textContent = extractTextContent(message);
        if (textContent) {
          // Use markdown for assistant messages, plain text for user
          if (message.role === "assistant") {
            return <MarkdownRenderer content={textContent} />;
          }
          return (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {textContent}
            </div>
          );
        }
        return <div className="text-muted-foreground text-xs">(processing...)</div>;
      }

      return elements;
    };
  }, [extractTextContent]);

  // Memoize quick prompt handler
  const handleQuickPrompt = useCallback((prompt: string) => {
    if (status === "ready") {
      void sendMessage({ text: prompt });
    }
  }, [status, sendMessage]);

  // Handle quick reply button clicks
  const handleQuickReply = useCallback((reply: string) => {
    if (status === "ready") {
      void sendMessage({ text: reply });
    }
  }, [status, sendMessage]);

  // Get the text content of the last assistant message for quick replies
  const lastAssistantMessage = useMemo(() => {
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    if (assistantMessages.length === 0) return null;
    const lastMsg = assistantMessages[assistantMessages.length - 1];
    return extractTextContent(lastMsg as ChatMessage);
  }, [messages, extractTextContent]);

  // Check if last message is from assistant (show quick replies only then)
  const showQuickReplies = useMemo(() => {
    if (messages.length === 0 || isLoading) return false;
    const lastMessage = messages[messages.length - 1];
    return lastMessage?.role === "assistant";
  }, [messages, isLoading]);

  // Virtualization disabled - causes infinite re-render issues with dynamic message heights
  // TODO: Re-enable once @tanstack/react-virtual issues are resolved
  const useVirtualization = false;

  return (
    <Card className="relative flex flex-col h-full min-h-0 rounded-none border overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 flex-none">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">AI Assistant</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateThread}
            className="h-6 w-6 p-0"
            aria-label="New conversation"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearChat} className="h-6 w-6 p-0" aria-label="Clear chat">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages - Scrollable area with drop zone */}
      <ChatDropZone onFilesAdded={handleFilesAdded} disabled={isLoading || isUploading}>
        <div className="h-full">
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto p-3"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="flex h-12 w-12 items-center justify-center border bg-gradient-to-br from-primary/5 to-primary/10 mb-3">
                  <Sparkles className="h-5 w-5 text-primary/70" />
                </div>
                <h3 className="font-medium text-sm mb-1 tracking-tight">How can I help?</h3>
                <p className="text-muted-foreground text-xs max-w-sm mb-4">
                  I can analyze your data, create documents, and automate accounting tasks.
                </p>
                <p className="text-muted-foreground text-[10px] mb-4">
                  Drop documents here or use the attachment button to upload
                </p>
                <div className="grid gap-2 sm:grid-cols-2 w-full max-w-md">
                  {QUICK_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleQuickPrompt(item.prompt)}
                      className="text-left text-xs px-3 py-2.5 border bg-card hover:bg-muted/50 transition-colors font-medium"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : useVirtualization ? (
              // Virtualized rendering for long conversations (50+ messages)
              <VirtualizedMessages
                messages={messages}
                renderMessageContent={renderMessageParts}
                isLoading={isLoading}
              />
            ) : (
              // Standard rendering for normal conversations
              <div className="space-y-3">
                {messages.filter((message) => message.role !== "system").map((message) => (
                  <div
                    key={message.id}
                    className={cn("flex gap-2.5", message.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {message.role !== "user" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center border bg-gradient-to-br from-muted/50 to-muted">
                        <Bot className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-none px-3 py-2 max-w-[85%]",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/30 border"
                      )}
                    >
                      {renderMessageParts(message)}
                    </div>
                    {message.role === "user" && (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-primary/90">
                        <UserIcon className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {/* Quick reply buttons for assistant questions */}
                {showQuickReplies && lastAssistantMessage && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-6 shrink-0" /> {/* Spacer to align with messages */}
                    <QuickReply
                      content={lastAssistantMessage}
                      onReply={handleQuickReply}
                      disabled={isLoading}
                    />
                  </div>
                )}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center border bg-gradient-to-br from-muted/50 to-muted">
                      <Bot className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs bg-muted/30 border rounded-none px-3 py-2">
                      <Loader2Icon className="h-3 w-3 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ChatDropZone>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 bg-destructive/10 text-destructive text-xs border-t flex-none">
          {error.message}
        </div>
      )}

      {/* Document Preview */}
      {pendingFiles.length > 0 && pendingFiles.length <= 5 && (
        <DocumentPreview
          files={pendingFiles}
          onRemove={handleFileRemove}
          onClearAll={handleClearFiles}
          isUploading={isUploading}
        />
      )}
      {pendingFiles.length > 5 && (
        <CompactDocumentPreview
          files={pendingFiles}
          onClearAll={handleClearFiles}
          isUploading={isUploading}
        />
      )}

      {/* Command Palette - Positioned relative to Card, above input */}
      <CommandPalette
        onNewChat={handleCreateThread}
        onClearChat={handleClearChat}
        onQuickPrompt={handleQuickPrompt}
        hasMessages={messages.length > 0}
        isLoading={isLoading}
        isOpen={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        threads={threads}
        currentThreadId={chatStore.currentThreadId}
        onSelectThread={handleSelectThread}
        onDeleteThread={handleDeleteThread}
      />

      {/* Compact Input */}
      <form onSubmit={handleSubmit} className="px-2 py-1.5 border-t flex-none">
        <div className="flex items-end gap-1.5">
          {/* Attachment button */}
          <DocumentUpload
            onFilesAdded={handleFilesAdded}
            disabled={isLoading || isUploading}
          />
          {/* Input field */}
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingFiles.length > 0 ? "Add a message..." : "Ask anything..."}
              disabled={isLoading || isUploading}
              className="min-h-[36px] max-h-[120px] resize-none rounded-none text-sm pr-16"
              rows={1}
            />
            {/* Command palette hint inside input */}
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <kbd className="inline-flex h-4 items-center gap-0.5 border bg-muted/50 px-1">⌘K</kbd>
            </button>
          </div>
          {/* Send button */}
          <Button
            type="submit"
            size="icon"
            disabled={(isLoading || isUploading) || (!input.trim() && pendingFiles.length === 0)}
            className="h-[36px] w-[36px] rounded-none shrink-0"
          >
            {isLoading || isUploading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </Card>
  );
});
