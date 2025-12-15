"use client";

import { memo, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  RotateCcw,
  SearchIcon,
  MessageSquare,
  Sparkles,
  FileText,
  HelpCircle,
  XIcon,
  Trash2Icon,
} from "@/components/ui/icons";
import type { IDBAgentThread } from "@/types/indexdb";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  category: "chat" | "history" | "actions" | "help";
  isActive?: boolean;
  onDelete?: () => void;
}

interface CommandPaletteProps {
  onNewChat: () => void;
  onClearChat: () => void;
  onQuickPrompt: (prompt: string) => void;
  hasMessages: boolean;
  isLoading: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // Thread history props
  threads: IDBAgentThread[];
  currentThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => Promise<void>;
}

// Quick prompts for the command palette
const QUICK_COMMANDS = [
  { id: "monthly-summary", label: "Monthly Summary", prompt: "Give me a summary of this month's revenue, expenses, and profit" },
  { id: "overdue-invoices", label: "Overdue Invoices", prompt: "Show me all overdue invoices and their total value" },
  { id: "top-customers", label: "Top Customers", prompt: "Who are my top 5 customers by revenue this month?" },
  { id: "create-invoice", label: "Create Invoice", prompt: "Help me create an invoice for a new sale" },
  { id: "aging-report", label: "Aging Report", prompt: "Show me the accounts receivable aging report" },
  { id: "profit-loss", label: "Profit & Loss", prompt: "Generate a profit and loss statement for this month" },
];

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-MY", {
    month: "short",
    day: "numeric",
  });
}

export const CommandPalette = memo(function CommandPalette({
  onNewChat,
  onClearChat,
  onQuickPrompt,
  hasMessages,
  isLoading,
  isOpen,
  onOpenChange,
  threads,
  currentThreadId,
  onSelectThread,
  onDeleteThread,
}: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build commands list
  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [
      // Chat commands
      {
        id: "new-chat",
        label: "New Conversation",
        description: "Start a fresh conversation",
        icon: <Plus className="h-4 w-4" />,
        shortcut: "N",
        action: () => {
          onNewChat();
          onOpenChange(false);
        },
        category: "chat",
      },
    ];

    // Add clear chat if there are messages
    if (hasMessages) {
      cmds.push({
        id: "clear-chat",
        label: "Clear Conversation",
        description: "Clear current conversation",
        icon: <RotateCcw className="h-4 w-4" />,
        shortcut: "C",
        action: () => {
          onClearChat();
          onOpenChange(false);
        },
        category: "chat",
      });
    }

    // Add thread history (limit to 5 most recent)
    const recentThreads = threads.slice(0, 5);
    recentThreads.forEach((thread) => {
      const isActive = thread.id === currentThreadId;
      cmds.push({
        id: `thread-${thread.id}`,
        label: thread.title || "New conversation",
        description: `${formatRelativeTime(thread.updatedAt)}${thread.messageCount > 0 ? ` · ${thread.messageCount} messages` : ""}`,
        icon: <MessageSquare className="h-4 w-4" />,
        action: () => {
          onSelectThread(thread.id);
          onOpenChange(false);
        },
        category: "history",
        isActive,
        onDelete: () => {
          void onDeleteThread(thread.id);
        },
      });
    });

    // Quick action commands
    QUICK_COMMANDS.forEach((cmd) => {
      cmds.push({
        id: cmd.id,
        label: cmd.label,
        description: `Ask: "${cmd.prompt.substring(0, 40)}..."`,
        icon: <Sparkles className="h-4 w-4" />,
        action: () => {
          onQuickPrompt(cmd.prompt);
          onOpenChange(false);
        },
        category: "actions",
      });
    });

    // Help commands
    cmds.push({
      id: "help-docs",
      label: "View Documentation",
      description: "Learn how to use the AI assistant",
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        window.open("/docs/ai-assistant", "_blank");
        onOpenChange(false);
      },
      category: "help",
    });

    cmds.push({
      id: "help-shortcuts",
      label: "Keyboard Shortcuts",
      description: "View all available shortcuts",
      icon: <HelpCircle className="h-4 w-4" />,
      action: () => {
        setSearchQuery("shortcuts");
      },
      category: "help",
    });

    return cmds;
  }, [hasMessages, onNewChat, onClearChat, onQuickPrompt, onOpenChange, threads, currentThreadId, onSelectThread, onDeleteThread]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commands;
    const query = searchQuery.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.description?.toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query)
    );
  }, [commands, searchQuery]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: { chat: Command[]; history: Command[]; actions: Command[]; help: Command[] } = {
      chat: [],
      history: [],
      actions: [],
      help: [],
    };
    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Flatten for keyboard navigation
  const flatCommands = useMemo((): Command[] => {
    return [...groupedCommands.chat, ...groupedCommands.history, ...groupedCommands.actions, ...groupedCommands.help];
  }, [groupedCommands]);

  // Reset selection when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatCommands[selectedIndex]) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, flatCommands]);

  // Handle keyboard navigation when open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % flatCommands.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + flatCommands.length) % flatCommands.length);
          break;
        case "Enter":
          e.preventDefault();
          if (flatCommands[selectedIndex] && !isLoading) {
            flatCommands[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, flatCommands, selectedIndex, isLoading, onOpenChange]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setSearchQuery("");
  }, [onOpenChange]);

  const handleCommandClick = useCallback((command: Command) => {
    if (!isLoading) {
      command.action();
    }
  }, [isLoading]);

  // Category labels
  const categoryLabels: Record<string, string> = {
    chat: "Conversations",
    history: "Recent",
    actions: "Quick Actions",
    help: "Help",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Light backdrop - click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
            className="absolute inset-0 z-40 bg-background/80"
          />

          {/* Command Palette - Expands upward from bottom, above input */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{
              duration: 0.25,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="absolute inset-x-0 bottom-[52px] z-50 px-2"
          >
            <div className="bg-background border shadow-xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-3 py-2.5 border-b">
                <SearchIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search commands or conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                />
                <div className="flex items-center gap-1">
                  <kbd className="hidden sm:inline-flex h-5 items-center gap-1 border bg-muted px-1.5 text-[10px] text-muted-foreground">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                  <button
                    onClick={handleClose}
                    className="h-6 w-6 flex items-center justify-center hover:bg-muted transition-colors"
                  >
                    <XIcon className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Commands List */}
              <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1.5">
                {flatCommands.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <div className="flex h-10 w-10 items-center justify-center bg-muted mb-2">
                      <MessageSquare className="h-5 w-5 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium">No results found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Try a different search term
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Chat Commands */}
                    {groupedCommands.chat.length > 0 && (
                      <div className="px-1.5 pb-1">
                        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {categoryLabels.chat}
                        </div>
                        {groupedCommands.chat.map((command) => {
                          const globalIndex = flatCommands.indexOf(command);
                          return (
                            <CommandItem
                              key={command.id}
                              command={command}
                              isSelected={selectedIndex === globalIndex}
                              onClick={() => handleCommandClick(command)}
                              dataIndex={globalIndex}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* History */}
                    {groupedCommands.history.length > 0 && (
                      <div className="px-1.5 pb-1">
                        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {categoryLabels.history}
                        </div>
                        {groupedCommands.history.map((command) => {
                          const globalIndex = flatCommands.indexOf(command);
                          return (
                            <CommandItem
                              key={command.id}
                              command={command}
                              isSelected={selectedIndex === globalIndex}
                              onClick={() => handleCommandClick(command)}
                              dataIndex={globalIndex}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Quick Actions */}
                    {groupedCommands.actions.length > 0 && (
                      <div className="px-1.5 pb-1">
                        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {categoryLabels.actions}
                        </div>
                        {groupedCommands.actions.map((command) => {
                          const globalIndex = flatCommands.indexOf(command);
                          return (
                            <CommandItem
                              key={command.id}
                              command={command}
                              isSelected={selectedIndex === globalIndex}
                              onClick={() => handleCommandClick(command)}
                              dataIndex={globalIndex}
                            />
                          );
                        })}
                      </div>
                    )}

                    {/* Help */}
                    {groupedCommands.help.length > 0 && (
                      <div className="px-1.5 pb-1">
                        <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {categoryLabels.help}
                        </div>
                        {groupedCommands.help.map((command) => {
                          const globalIndex = flatCommands.indexOf(command);
                          return (
                            <CommandItem
                              key={command.id}
                              command={command}
                              isSelected={selectedIndex === globalIndex}
                              onClick={() => handleCommandClick(command)}
                              dataIndex={globalIndex}
                            />
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-3 py-1.5 border-t bg-muted/30 flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="inline-flex h-4 items-center border bg-background px-1">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="inline-flex h-4 items-center border bg-background px-1">↵</kbd>
                    Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="inline-flex h-4 items-center border bg-background px-1">Esc</kbd>
                    Close
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

// Individual command item
const CommandItem = memo(function CommandItem({
  command,
  isSelected,
  onClick,
  dataIndex,
}: {
  command: Command;
  isSelected: boolean;
  onClick: () => void;
  dataIndex: number;
}) {
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    command.onDelete?.();
  }, [command]);

  return (
    <button
      data-index={dataIndex}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-2.5 py-2 transition-colors text-left group",
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted/50 text-foreground",
        command.isActive && "border-l-2 border-primary"
      )}
    >
      <div className={cn(
        "flex h-7 w-7 items-center justify-center transition-colors shrink-0",
        isSelected ? "bg-primary/20" : "bg-muted",
        command.isActive && "bg-primary/10"
      )}>
        {command.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-medium truncate",
          command.isActive && "text-primary"
        )}>
          {command.label}
        </p>
        {command.description && (
          <p className="text-[11px] text-muted-foreground truncate">
            {command.description}
          </p>
        )}
      </div>
      {command.shortcut && (
        <kbd className="hidden sm:inline-flex h-5 items-center border bg-muted px-1.5 text-[10px] text-muted-foreground shrink-0">
          {command.shortcut}
        </kbd>
      )}
      {command.onDelete && (
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center hover:bg-destructive/10 transition-all shrink-0"
        >
          <Trash2Icon className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </button>
  );
});
