"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useCallback, useMemo, memo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot,
  SendIcon,
  Loader2Icon,
  Sparkles,
  UserIcon,
  Wrench,
  CheckCircle2Icon,
  AlertTriangleIcon,
  RotateCcw,
} from "@/components/ui/icons";
import { DocumentUpload, ChatDropZone, type PendingFile } from "@/components/agent/document-upload";
import { DocumentPreview, CompactDocumentPreview } from "@/components/agent/document-preview";
import { MarkdownRenderer } from "@/components/agent/markdown-renderer";
import { QuickReply } from "@/components/agent/quick-reply";
import { useUploadDocument } from "@/api/vault";
import { toast } from "sonner";
import {
  useAgentChatStore,
  useAgentMessages,
  aiMessageToIDBParts,
} from "@/hooks/use-agent-chat-store";
import { useChatBackgroundSync } from "@/hooks/use-chat-background-sync";
import type { IDBAgentMessage } from "@/types/indexdb";

// Tool name to friendly label mapping
const TOOL_LABELS: Record<string, string> = {
  // Data access tools
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
  getProfitAndLoss: "Generating profit & loss",
  getBalanceSheet: "Generating balance sheet",
  getAccountingPeriodStatus: "Checking accounting periods",
  searchLedgerTransactions: "Searching transactions",
  getUnpaidBills: "Finding unpaid bills",
  // Action tools
  createInvoice: "Creating invoice",
  createBill: "Creating bill",
  createCustomer: "Creating customer",
  createVendor: "Creating vendor",
  createJournalEntry: "Creating journal entry",
  postJournalEntry: "Posting to ledger",
  reverseJournalEntry: "Reversing journal entry",
  markInvoiceAsPaid: "Marking invoice as paid",
  markBillAsPaid: "Marking bill as paid",
  updateInvoiceStatus: "Updating invoice status",
  updateQuotationStatus: "Updating quotation status",
  convertQuotationToInvoice: "Converting quotation to invoice",
  listAccounts: "Loading chart of accounts",
  // Memory & reasoning tools
  rememberPreference: "Remembering preference",
  recallMemories: "Recalling memories",
  updateUserContext: "Updating context",
  thinkStep: "Planning approach",
  validateAction: "Validating action",
  // Document processing tools
  listVaultDocuments: "Loading vault documents",
  processDocuments: "Processing documents with AI",
  getDocumentDetails: "Getting document details",
  queryDocumentCabinet: "Searching document cabinet",
  createEntriesFromDocument: "Creating entries from document",
};

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
  const [agentSessionId, setAgentSessionId] = useState<string | null>(() => {
    // Restore session from localStorage if available
    return localStorage.getItem("agent_session_id");
  });

  // Document upload state
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const uploadMutation = useUploadDocument();

  // T3-style IndexedDB chat store
  const chatStore = useAgentChatStore();
  const { messages: idbMessages, isLoading: idbLoading } = useAgentMessages(chatStore.currentThreadId);
  const streamingMessageIdRef = useRef<string | null>(null);
  const lastSyncedMessageCountRef = useRef(0);

  const { messages, sendMessage, status, error, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/ai/chat`,
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ""}`,
        ...(agentSessionId ? { "X-Session-Id": agentSessionId } : {}),
      },
      // Capture sessionId from response headers
      fetch: async (url, options) => {
        const response = await fetch(url, options);
        const newSessionId = response.headers.get("X-Session-Id");
        if (newSessionId && newSessionId !== agentSessionId) {
          setAgentSessionId(newSessionId);
          localStorage.setItem("agent_session_id", newSessionId);
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

  // T3-style background sync to PostgreSQL
  const { triggerSync } = useChatBackgroundSync({
    enabled: true,
    onSyncComplete: (threadId) => {
      console.log("[ChatSync] Thread synced:", threadId);
    },
    onSyncError: (error) => {
      console.error("[ChatSync] Sync failed:", error);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMessages(aiMessages as any);
      lastSyncedMessageCountRef.current = validMessages.length;
      // Mark loaded messages as already synced to prevent re-syncing
      validMessages.forEach((msg) => syncedMessageIdsRef.current.add(msg.id));
    }
  }, [idbLoading, idbMessages, messages.length, setMessages]);

  // Sync new messages to IndexedDB (T3-style: stream to local)
  useEffect(() => {
    const syncToIndexedDB = async () => {
      if (!chatStore.currentThreadId || messages.length === 0) return;

      for (const msg of messages) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    };

    void syncToIndexedDB();
  }, [messages, chatStore]);

  // Complete streaming message when status changes from streaming
  useEffect(() => {
    if (status === "ready" && streamingMessageIdRef.current) {
      const lastMessage = messages[messages.length - 1];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lastMsgAny = lastMessage as any;

      if (lastMsgAny?.role === "assistant" && lastMsgAny.parts) {
        void chatStore.completeStreamingMessage(
          streamingMessageIdRef.current,
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

    // Clear session
    setAgentSessionId(null);
    localStorage.removeItem("agent_session_id");

    // Clear IndexedDB thread messages FIRST (before clearing React state)
    if (chatStore.currentThreadId) {
      await chatStore.clearThreadMessages(chatStore.currentThreadId);
      lastSyncedMessageCountRef.current = 0;
      streamingMessageIdRef.current = null;
      syncedMessageIdsRef.current.clear();
    }

    // Now clear React messages state (after IDB is cleared)
    setMessages([]);

    // Reset clearing flag after a tick to allow effects to settle
    setTimeout(() => {
      isClearingRef.current = false;
    }, 100);
  }, [setMessages, pendingFiles, chatStore]);

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

  // Debug: Log all messages whenever they change - FULL STRUCTURE
  useEffect(() => {
    console.log("[AI Agent] === MESSAGES UPDATE ===");
    console.log("[AI Agent] Total messages:", messages.length);
    messages.forEach((msg, i) => {
      console.log(`[AI Agent] Message ${i}:`, JSON.stringify(msg, null, 2));
    });
    console.log("[AI Agent] === END MESSAGES ===");
  }, [messages]);

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
      const msgAny = message as unknown as Record<string, unknown>;

      // Log full message structure for debugging
      console.log("[AI Agent] Rendering message:", message.id, {
        role: message.role,
        partsCount: message.parts?.length,
        hasContent: typeof msgAny.content === "string",
        contentPreview: typeof msgAny.content === "string" ? msgAny.content.substring(0, 100) : null,
      });

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

        // Log each part for debugging
        console.log(`[AI Agent] Part ${index}:`, part.type, partAny);

        // Text parts - handle multiple formats
        if (part.type === "text") {
          const textPart = part as { type: string; text: string };
          const textValue = textPart.text || (partAny.value as string) || (partAny.content as string);
          if (textValue && textValue.trim()) {
            console.log("[AI Agent] Rendering text part:", textValue.substring(0, 100));
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
          const state = toolPart.state;

          // Determine if complete based on state
          const isComplete = state === "output-available";
          const isError = state === "output-error";
          const isStreaming = state === "input-streaming";

          const label = TOOL_LABELS[toolName] || toolName;

          elements.push(
            <div
              key={toolPart.toolCallId || `tool-${index}`}
              className={cn(
                "flex items-center gap-2 text-xs bg-muted/50 rounded-none px-2 py-1.5 my-1 border-l-2",
                isError ? "border-destructive/50 text-destructive" : "border-primary/30 text-muted-foreground"
              )}
            >
              {isComplete ? (
                <CheckCircle2Icon className="h-3 w-3 text-emerald-500" />
              ) : isError ? (
                <AlertTriangleIcon className="h-3 w-3 text-destructive" />
              ) : (
                <Loader2Icon className="h-3 w-3 animate-spin" />
              )}
              <Wrench className="h-3 w-3" />
              <span className="jetbrains-mono">
                {isStreaming ? `${label}...` : label}
              </span>
              {isError && toolPart.errorText && (
                <span className="text-destructive">- {toolPart.errorText}</span>
              )}
            </div>
          );
          continue;
        }

        // Handle tool-invocation (alternative format)
        if (part.type === "tool-invocation" || part.type === "tool-call") {
          const toolName = ((partAny.toolName as string) || (partAny.name as string)) ?? "tool";
          const state = (partAny.state as string) ?? "output-available";
          const isComplete = state === "output-available" || state === "result";
          const label = TOOL_LABELS[toolName] || toolName;

          elements.push(
            <div
              key={`tool-inv-${index}`}
              className="flex items-center gap-2 text-xs bg-muted/50 rounded-none px-2 py-1.5 my-1 border-l-2 border-primary/30 text-muted-foreground"
            >
              {isComplete ? (
                <CheckCircle2Icon className="h-3 w-3 text-emerald-500" />
              ) : (
                <Loader2Icon className="h-3 w-3 animate-spin" />
              )}
              <Wrench className="h-3 w-3" />
              <span className="jetbrains-mono">{label}</span>
            </div>
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
        console.log("[AI Agent] Unknown part type:", part.type, part);
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

  return (
    <Card className="flex flex-col h-full min-h-0 rounded-none border overflow-hidden">
      {/* Header - Fixed at top */}
      <CardHeader className="border-b py-2.5 px-4 flex-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center border bg-gradient-to-br from-primary/5 to-primary/10">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium tracking-tight">AI Assistant</CardTitle>
              <p className="text-[11px] text-muted-foreground">Ask questions or automate tasks</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearChat} className="h-7 text-xs px-2 gap-1.5" aria-label="Clear chat">
              <RotateCcw className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

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
            ) : (
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

      {/* Input - Fixed at bottom */}
      <form onSubmit={handleSubmit} className="p-2.5 border-t bg-muted/30 flex-none">
        <div className="flex gap-2">
          <DocumentUpload
            onFilesAdded={handleFilesAdded}
            disabled={isLoading || isUploading}
          />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingFiles.length > 0 ? "Add a message or just send to process documents..." : "Ask a question or describe a task..."}
            disabled={isLoading || isUploading}
            className="min-h-[40px] max-h-[80px] resize-none rounded-none text-sm"
            rows={1}
          />
          <Button
            type="submit"
            size="icon"
            disabled={(isLoading || isUploading) || (!input.trim() && pendingFiles.length === 0)}
            className="h-[40px] w-[40px] rounded-none shrink-0"
          >
            {isLoading || isUploading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </Card>
  );
});
