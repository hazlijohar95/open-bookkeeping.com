/**
 * T3-style local-first chat storage hook
 * Uses IndexedDB for persistence with reactive updates
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { getDB } from "@/global/indexdb";
import {
  IDB_AGENT_THREADS,
  IDB_AGENT_MESSAGES,
} from "@/constants/indexed-db";
import type {
  IDBAgentThread,
  IDBAgentMessage,
  IDBAgentMessagePart,
} from "@/types/indexdb";

// Event emitter for reactive updates (T3 uses signals, we use events)
const chatEvents = new EventTarget();
const THREAD_UPDATE = "thread-update";
const MESSAGES_UPDATE = "messages-update";

/**
 * Hook for managing agent chat threads
 */
export function useAgentThreads() {
  const [threads, setThreads] = useState<IDBAgentThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    try {
      const db = await getDB();
      const allThreads = await db.getAllFromIndex(
        IDB_AGENT_THREADS,
        "updatedAt"
      );
      // Sort by most recent first
      setThreads(allThreads.reverse());
    } catch (error) {
      console.error("[AgentChat] Failed to load threads:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  // Listen for updates
  useEffect(() => {
    const handler = () => void loadThreads();
    chatEvents.addEventListener(THREAD_UPDATE, handler);
    return () => chatEvents.removeEventListener(THREAD_UPDATE, handler);
  }, [loadThreads]);

  return { threads, isLoading, refresh: loadThreads };
}

/**
 * Check if a message has valid content
 */
function isValidMessage(msg: IDBAgentMessage): boolean {
  // Must have parts array
  if (!msg.parts || !Array.isArray(msg.parts) || msg.parts.length === 0) {
    return false;
  }

  // User messages need at least one text part with content
  if (msg.role === "user") {
    return msg.parts.some((p) => p.type === "text" && p.text && p.text.trim().length > 0);
  }

  // Assistant messages need at least one meaningful part
  return msg.parts.some((p) => {
    if (p.type === "text") return p.text && p.text.trim().length > 0;
    // Tool parts are valid
    if (p.type?.startsWith?.("tool-") || p.toolName) return true;
    if (p.type === "tool-invocation" || p.type === "tool-call") return true;
    if (p.type === "reasoning") return true;
    return false;
  });
}

/**
 * Hook for managing messages in a specific thread
 */
export function useAgentMessages(threadId: string | null) {
  const [messages, setMessages] = useState<IDBAgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMessages = useCallback(async () => {
    if (!threadId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    try {
      const db = await getDB();
      const threadMessages = await db.getAllFromIndex(
        IDB_AGENT_MESSAGES,
        "threadId",
        threadId
      );

      // Filter out invalid messages (empty parts, streaming leftovers)
      const validMessages = threadMessages.filter(isValidMessage);

      // Sort by creation time
      validMessages.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      setMessages(validMessages);
    } catch (error) {
      console.error("[AgentChat] Failed to load messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  // Initial load
  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Listen for updates
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.threadId === threadId) {
        void loadMessages();
      }
    };
    chatEvents.addEventListener(MESSAGES_UPDATE, handler as EventListener);
    return () =>
      chatEvents.removeEventListener(MESSAGES_UPDATE, handler as EventListener);
  }, [loadMessages, threadId]);

  return { messages, isLoading, refresh: loadMessages };
}

/**
 * Main hook for agent chat operations
 * Provides CRUD operations with automatic IndexedDB persistence
 */
export function useAgentChatStore() {
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const streamingMessageRef = useRef<string | null>(null);

  // Create a new thread
  const createThread = useCallback(async (title?: string): Promise<string> => {
    const db = await getDB();
    const now = new Date().toISOString();
    const threadId = crypto.randomUUID();

    const thread: IDBAgentThread = {
      id: threadId,
      title: title ?? null,
      createdAt: now,
      updatedAt: now,
      serverSessionId: null,
      syncStatus: "local",
      messageCount: 0,
    };

    await db.put(IDB_AGENT_THREADS, thread);
    chatEvents.dispatchEvent(new CustomEvent(THREAD_UPDATE));
    setCurrentThreadId(threadId);

    return threadId;
  }, []);

  // Delete a thread and its messages
  const deleteThread = useCallback(async (threadId: string) => {
    const db = await getDB();

    // Delete all messages in the thread
    const messages = await db.getAllFromIndex(
      IDB_AGENT_MESSAGES,
      "threadId",
      threadId
    );
    const tx = db.transaction(IDB_AGENT_MESSAGES, "readwrite");
    await Promise.all(messages.map((m) => tx.store.delete(m.id)));
    await tx.done;

    // Delete the thread
    await db.delete(IDB_AGENT_THREADS, threadId);

    chatEvents.dispatchEvent(new CustomEvent(THREAD_UPDATE));
    chatEvents.dispatchEvent(
      new CustomEvent(MESSAGES_UPDATE, { detail: { threadId } })
    );

    if (currentThreadId === threadId) {
      setCurrentThreadId(null);
    }
  }, [currentThreadId]);

  // Add a user message
  const addUserMessage = useCallback(
    async (threadId: string, text: string): Promise<string> => {
      const db = await getDB();
      const now = new Date().toISOString();
      const messageId = crypto.randomUUID();

      const message: IDBAgentMessage = {
        id: messageId,
        threadId,
        role: "user",
        parts: [{ type: "text", text }],
        createdAt: now,
        isStreaming: false,
        syncStatus: "local",
      };

      await db.put(IDB_AGENT_MESSAGES, message);

      // Update thread
      const thread = await db.get(IDB_AGENT_THREADS, threadId);
      if (thread) {
        thread.updatedAt = now;
        thread.messageCount += 1;
        // Auto-generate title from first message
        if (!thread.title && text.length > 0) {
          thread.title = text.slice(0, 50) + (text.length > 50 ? "..." : "");
        }
        await db.put(IDB_AGENT_THREADS, thread);
      }

      chatEvents.dispatchEvent(new CustomEvent(THREAD_UPDATE));
      chatEvents.dispatchEvent(
        new CustomEvent(MESSAGES_UPDATE, { detail: { threadId } })
      );

      return messageId;
    },
    []
  );

  // Start an assistant message (for streaming)
  const startAssistantMessage = useCallback(
    async (threadId: string): Promise<string> => {
      const db = await getDB();
      const now = new Date().toISOString();
      const messageId = crypto.randomUUID();

      const message: IDBAgentMessage = {
        id: messageId,
        threadId,
        role: "assistant",
        parts: [],
        createdAt: now,
        isStreaming: true,
        syncStatus: "local",
      };

      await db.put(IDB_AGENT_MESSAGES, message);
      streamingMessageRef.current = messageId;

      chatEvents.dispatchEvent(
        new CustomEvent(MESSAGES_UPDATE, { detail: { threadId } })
      );

      return messageId;
    },
    []
  );

  // Update streaming message with new parts (T3-style direct-to-IDB streaming)
  const updateStreamingMessage = useCallback(
    async (messageId: string, parts: IDBAgentMessagePart[]) => {
      const db = await getDB();
      const message = await db.get(IDB_AGENT_MESSAGES, messageId);

      if (message) {
        message.parts = parts;
        await db.put(IDB_AGENT_MESSAGES, message);

        chatEvents.dispatchEvent(
          new CustomEvent(MESSAGES_UPDATE, { detail: { threadId: message.threadId } })
        );
      }
    },
    []
  );

  // Complete streaming message
  const completeStreamingMessage = useCallback(
    async (messageId: string, finalParts: IDBAgentMessagePart[]) => {
      const db = await getDB();
      const message = await db.get(IDB_AGENT_MESSAGES, messageId);

      if (message) {
        message.parts = finalParts;
        message.isStreaming = false;
        await db.put(IDB_AGENT_MESSAGES, message);

        // Update thread
        const thread = await db.get(IDB_AGENT_THREADS, message.threadId);
        if (thread) {
          thread.updatedAt = new Date().toISOString();
          thread.messageCount += 1;
          await db.put(IDB_AGENT_THREADS, thread);
        }

        streamingMessageRef.current = null;

        chatEvents.dispatchEvent(new CustomEvent(THREAD_UPDATE));
        chatEvents.dispatchEvent(
          new CustomEvent(MESSAGES_UPDATE, { detail: { threadId: message.threadId } })
        );
      }
    },
    []
  );

  // Clear all messages in a thread (but keep thread)
  const clearThreadMessages = useCallback(async (threadId: string) => {
    const db = await getDB();

    // Delete all messages
    const messages = await db.getAllFromIndex(
      IDB_AGENT_MESSAGES,
      "threadId",
      threadId
    );
    const tx = db.transaction(IDB_AGENT_MESSAGES, "readwrite");
    await Promise.all(messages.map((m) => tx.store.delete(m.id)));
    await tx.done;

    // Update thread
    const thread = await db.get(IDB_AGENT_THREADS, threadId);
    if (thread) {
      thread.messageCount = 0;
      thread.updatedAt = new Date().toISOString();
      thread.syncStatus = "local"; // Reset sync status
      await db.put(IDB_AGENT_THREADS, thread);
    }

    chatEvents.dispatchEvent(new CustomEvent(THREAD_UPDATE));
    chatEvents.dispatchEvent(
      new CustomEvent(MESSAGES_UPDATE, { detail: { threadId } })
    );
  }, []);

  // Clean up invalid/empty messages from a thread
  const cleanupInvalidMessages = useCallback(async (threadId: string) => {
    const db = await getDB();
    const messages = await db.getAllFromIndex(
      IDB_AGENT_MESSAGES,
      "threadId",
      threadId
    );

    const invalidMessages = messages.filter((m) => !isValidMessage(m));
    if (invalidMessages.length === 0) return;

    console.log("[AgentChat] Cleaning up", invalidMessages.length, "invalid messages");

    const tx = db.transaction(IDB_AGENT_MESSAGES, "readwrite");
    await Promise.all(invalidMessages.map((m) => tx.store.delete(m.id)));
    await tx.done;

    // Update thread message count
    const thread = await db.get(IDB_AGENT_THREADS, threadId);
    if (thread) {
      thread.messageCount = Math.max(0, (thread.messageCount || 0) - invalidMessages.length);
      await db.put(IDB_AGENT_THREADS, thread);
    }

    chatEvents.dispatchEvent(new CustomEvent(THREAD_UPDATE));
    chatEvents.dispatchEvent(
      new CustomEvent(MESSAGES_UPDATE, { detail: { threadId } })
    );
  }, []);

  // Link thread to server session (for sync)
  const linkToServerSession = useCallback(
    async (threadId: string, serverSessionId: string) => {
      const db = await getDB();
      const thread = await db.get(IDB_AGENT_THREADS, threadId);

      if (thread) {
        thread.serverSessionId = serverSessionId;
        thread.syncStatus = "synced";
        await db.put(IDB_AGENT_THREADS, thread);
        chatEvents.dispatchEvent(new CustomEvent(THREAD_UPDATE));
      }
    },
    []
  );

  // Get or create active thread
  const getOrCreateThread = useCallback(async (): Promise<string> => {
    if (currentThreadId) {
      const db = await getDB();
      const thread = await db.get(IDB_AGENT_THREADS, currentThreadId);
      if (thread) return currentThreadId;
    }

    // Check localStorage for last thread
    const lastThreadId = localStorage.getItem("agent_current_thread");
    if (lastThreadId) {
      const db = await getDB();
      const thread = await db.get(IDB_AGENT_THREADS, lastThreadId);
      if (thread) {
        setCurrentThreadId(lastThreadId);
        return lastThreadId;
      }
    }

    // Create new thread
    return createThread();
  }, [currentThreadId, createThread]);

  // Persist current thread to localStorage
  useEffect(() => {
    if (currentThreadId) {
      localStorage.setItem("agent_current_thread", currentThreadId);
    }
  }, [currentThreadId]);

  return {
    currentThreadId,
    setCurrentThreadId,
    createThread,
    deleteThread,
    addUserMessage,
    startAssistantMessage,
    updateStreamingMessage,
    completeStreamingMessage,
    clearThreadMessages,
    cleanupInvalidMessages,
    linkToServerSession,
    getOrCreateThread,
    streamingMessageId: streamingMessageRef.current,
  };
}

/**
 * Convert AI SDK message format to our IDB format
 */
export function aiMessageToIDBParts(
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>
): IDBAgentMessagePart[] {
  return parts.map((part) => ({
    type: part.type,
    text: part.text,
    toolName: part.toolName as string | undefined,
    toolCallId: part.toolCallId as string | undefined,
    state: part.state as IDBAgentMessagePart["state"],
    input: part.input as Record<string, unknown> | undefined,
    output: part.output,
    errorText: part.errorText as string | undefined,
  }));
}

/**
 * Convert IDB message format back to AI SDK format
 */
export function idbMessageToAIFormat(message: IDBAgentMessage) {
  return {
    id: message.id,
    role: message.role,
    parts: message.parts,
    createdAt: new Date(message.createdAt),
  };
}
