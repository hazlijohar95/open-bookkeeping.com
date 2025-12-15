/**
 * T3-style background sync hook for chat sessions
 * Syncs IndexedDB threads to PostgreSQL in the background
 */
import { useEffect, useRef, useCallback } from "react";
import { getDB } from "@/global/indexdb";
import { IDB_AGENT_THREADS, IDB_AGENT_MESSAGES } from "@/constants/indexed-db";
import type { IDBAgentThread, IDBAgentMessage } from "@/types/indexdb";
import { useSyncSession } from "@/api/agent";
import { useAuth } from "@/providers/auth-provider";

// Sync interval in ms (30 seconds)
const SYNC_INTERVAL = 30000;

// Debounce time for sync after message (5 seconds)
const DEBOUNCE_TIME = 5000;

interface UseChatBackgroundSyncOptions {
  /** Enable/disable automatic background sync */
  enabled?: boolean;
  /** Sync interval in milliseconds */
  syncInterval?: number;
  /** Callback when sync completes */
  onSyncComplete?: (threadId: string) => void;
  /** Callback when sync fails */
  onSyncError?: (error: Error) => void;
}

/**
 * Hook to automatically sync local IndexedDB chat threads to PostgreSQL
 * Uses T3-style background sync pattern
 */
export function useChatBackgroundSync(options: UseChatBackgroundSyncOptions = {}) {
  const {
    enabled = true,
    syncInterval = SYNC_INTERVAL,
    onSyncComplete,
    onSyncError,
  } = options;

  const { user, session } = useAuth();
  const isAuthenticated = !!user && !!session;

  const syncMutation = useSyncSession();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);
  const lastSyncRef = useRef<Map<string, number>>(new Map());
  const authErrorCountRef = useRef(0);

  /**
   * Convert IDB message parts to PostgreSQL format
   */
  const convertMessageForSync = useCallback((msg: IDBAgentMessage) => {
    // Extract text content from parts
    const textParts = msg.parts.filter((p) => p.type === "text");
    const content = textParts.map((p) => p.text).join("\n") ?? null;

    // Extract tool calls
    const toolCallParts = msg.parts.filter((p) => p.type === "tool-invocation" || p.toolName);
    const toolCalls = toolCallParts.length > 0
      ? toolCallParts.map((p) => ({
          id: p.toolCallId || crypto.randomUUID(),
          name: p.toolName ?? "unknown",
          arguments: (p.input ?? {}),
        }))
      : null;

    // Extract tool results
    const toolResultParts = msg.parts.filter((p) => p.state === "output-available" || p.output !== undefined);
    const toolResults = toolResultParts.length > 0
      ? toolResultParts.map((p) => ({
          toolCallId: p.toolCallId ?? "",
          result: p.output,
          error: p.errorText,
        }))
      : null;

    return {
      localId: msg.id,
      role: msg.role,
      content,
      toolCalls,
      toolResults,
      createdAt: msg.createdAt,
    };
  }, []);

  /**
   * Sync a single thread to PostgreSQL
   */
  const syncThread = useCallback(async (thread: IDBAgentThread) => {
    if (thread.syncStatus === "synced") return;

    try {
      const db = await getDB();
      const messages = await db.getAllFromIndex(
        IDB_AGENT_MESSAGES,
        "threadId",
        thread.id
      );

      // Only sync completed messages (not streaming) that have parts
      const completedMessages = messages.filter((m) => !m.isStreaming && m.parts && m.parts.length > 0);

      // Don't call API if there are no messages to sync
      if (completedMessages.length === 0) {
        console.log("[ChatSync] No completed messages to sync for thread:", thread.id);
        return;
      }

      // Convert messages and filter out invalid ones
      const convertedMessages = completedMessages.map(convertMessageForSync).filter((msg) => {
        // Skip messages with no content and no tool calls
        return (msg.content && msg.content.trim().length > 0) || (msg.toolCalls && msg.toolCalls.length > 0);
      });

      // Still don't sync if all messages were filtered out
      if (convertedMessages.length === 0) {
        console.log("[ChatSync] No valid messages after conversion for thread:", thread.id);
        return;
      }

      // Final validation - ensure we have valid data
      if (!thread.id || !convertedMessages || convertedMessages.length === 0) {
        console.log("[ChatSync] Invalid sync data, skipping:", thread.id);
        return;
      }

      // Sync to PostgreSQL
      await syncMutation.mutateAsync({
        localThreadId: thread.id,
        title: thread.title ?? undefined,
        messages: convertedMessages,
      });

      // Update thread sync status in IndexedDB
      thread.syncStatus = "synced";
      await db.put(IDB_AGENT_THREADS, thread);

      // Update message sync status
      for (const msg of completedMessages) {
        if (msg.syncStatus !== "synced") {
          msg.syncStatus = "synced";
          await db.put(IDB_AGENT_MESSAGES, msg);
        }
      }

      lastSyncRef.current.set(thread.id, Date.now());
      onSyncComplete?.(thread.id);
    } catch (error) {
      // Check if it's an auth error (401)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isAuthError = errorMessage.includes("401") || errorMessage.includes("Unauthorized");

      if (isAuthError) {
        // Don't spam console for auth errors - only log once
        authErrorCountRef.current++;
        if (authErrorCountRef.current === 1) {
          console.log("[ChatSync] Sync paused - user not authenticated");
        }
        return;
      }

      // Reset auth error count on non-auth errors
      authErrorCountRef.current = 0;
      console.error("[ChatSync] Failed to sync thread:", thread.id, error);
      onSyncError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [syncMutation, convertMessageForSync, onSyncComplete, onSyncError]);

  /**
   * Sync all local threads that need syncing
   */
  const syncAllThreads = useCallback(async () => {
    // Skip sync if not authenticated
    if (!isAuthenticated) {
      return;
    }

    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const db = await getDB();
      const allThreads = await db.getAll(IDB_AGENT_THREADS);

      // Find threads that need syncing
      const threadsToSync = allThreads.filter((t) => {
        // Skip already synced threads unless they've been updated
        if (t.syncStatus === "synced") {
          const lastSync = lastSyncRef.current.get(t.id);
          const threadTime = new Date(t.updatedAt).getTime();
          return lastSync ? threadTime > lastSync : false;
        }
        return true;
      });

      // Sync each thread
      for (const thread of threadsToSync) {
        await syncThread(thread);
      }
    } catch (error) {
      console.error("[ChatSync] Background sync failed:", error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [isAuthenticated, syncThread]);

  /**
   * Trigger a debounced sync (called after new messages)
   */
  const triggerSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(() => {
      void syncAllThreads();
    }, DEBOUNCE_TIME);
  }, [syncAllThreads]);

  /**
   * Force immediate sync
   */
  const forceSync = useCallback(async () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    await syncAllThreads();
  }, [syncAllThreads]);

  // Reset auth error count when user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      authErrorCountRef.current = 0;
    }
  }, [isAuthenticated]);

  // Set up background sync interval
  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    // Initial sync after a short delay
    const initialTimeout = setTimeout(() => {
      void syncAllThreads();
    }, 5000);

    // Periodic sync
    const intervalId = setInterval(() => {
      void syncAllThreads();
    }, syncInterval);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [enabled, isAuthenticated, syncInterval, syncAllThreads]);

  // Sync on page visibility change (when user returns to tab)
  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        triggerSync();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, isAuthenticated, triggerSync]);

  // Sync before page unload (best effort)
  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    const handleBeforeUnload = () => {
      // Best effort sync - may not complete
      void syncAllThreads();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, isAuthenticated, syncAllThreads]);

  return {
    triggerSync,
    forceSync,
    isSyncing: syncMutation.isPending,
  };
}
