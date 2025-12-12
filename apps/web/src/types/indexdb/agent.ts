/**
 * IndexedDB types for AI Agent chat storage
 * T3-style local-first architecture
 */

export interface IDBAgentThread {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  serverSessionId: string | null; // Links to PostgreSQL agent_sessions
  syncStatus: "local" | "syncing" | "synced";
  messageCount: number;
}

export interface IDBAgentMessagePart {
  type: string;
  text?: string;
  toolName?: string;
  toolCallId?: string;
  state?: "input-streaming" | "input-available" | "output-available" | "output-error";
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}

export interface IDBAgentMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  parts: IDBAgentMessagePart[];
  createdAt: string;
  // For streaming - message can be updated as tokens arrive
  isStreaming: boolean;
  // Track if synced to server
  syncStatus: "local" | "synced";
}
