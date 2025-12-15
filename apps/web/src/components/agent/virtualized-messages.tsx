"use client";

import { memo, useRef, useEffect, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Bot, UserIcon } from "@/components/ui/icons";

// Message type for virtualization
type VirtualMessage = {
  id: string;
  role: "user" | "assistant" | "system";
   
  [key: string]: any;
};

interface VirtualizedMessagesProps {
  messages: VirtualMessage[];
   
  renderMessageContent: (message: any) => React.ReactNode;
  isLoading: boolean;
}

// Estimated row heights for virtualization
const ESTIMATED_ROW_HEIGHT = 120;
const MIN_ROW_HEIGHT = 60;

export const VirtualizedMessages = memo(function VirtualizedMessages({
  messages,
  renderMessageContent,
  isLoading,
}: VirtualizedMessagesProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const measurementsCache = useRef<Map<string, number>>(new Map());
  const lastMessageCountRef = useRef(0);

  // Memoize filtered messages to prevent recreating on every render
  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role !== "system"),
    [messages]
  );

  // Create a stable estimate function
  const estimateSize = useCallback(
    (index: number) => {
      const message = visibleMessages[index];
      if (!message) return ESTIMATED_ROW_HEIGHT;

      // Use cached measurement if available
      const cached = measurementsCache.current.get(message.id);
      if (cached) return cached;

      // Estimate based on message type
      if (message.role === "user") {
        return MIN_ROW_HEIGHT;
      }

      return ESTIMATED_ROW_HEIGHT;
    },
    [visibleMessages]
  );

  const virtualizer = useVirtualizer({
    count: visibleMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
    getItemKey: (index) => visibleMessages[index]?.id ?? String(index),
  });

  // Scroll to bottom only when new messages are added
  useEffect(() => {
    const currentCount = visibleMessages.length;
    if (currentCount > lastMessageCountRef.current && currentCount > 0) {
      // New message added, scroll to bottom
      const timeoutId = setTimeout(() => {
        virtualizer.scrollToIndex(currentCount - 1, {
          align: "end",
          behavior: "smooth",
        });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    lastMessageCountRef.current = currentCount;
  }, [visibleMessages.length]);  

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className="h-full overflow-y-auto"
      style={{
        contain: "strict",
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        <div
          className="p-3 space-y-3"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
          }}
        >
          {virtualItems.map((virtualRow) => {
            const message = visibleMessages[virtualRow.index];
            if (!message) return null;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
              >
                <MessageRow
                  message={message}
                  renderContent={renderMessageContent}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading indicator at bottom */}
      {isLoading && visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1]?.role === "user" && (
        <div className="sticky bottom-0 px-3 pb-3">
          <LoadingIndicator />
        </div>
      )}
    </div>
  );
});

// Individual message row component
const MessageRow = memo(function MessageRow({
  message,
  renderContent,
}: {
  message: VirtualMessage;
   
  renderContent: (message: any) => React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex gap-2.5",
        message.role === "user" ? "justify-end" : "justify-start"
      )}
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
        {renderContent(message)}
      </div>
      {message.role === "user" && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-primary/90">
          <UserIcon className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
    </div>
  );
});

// Loading indicator component
const LoadingIndicator = memo(function LoadingIndicator() {
  return (
    <div className="flex gap-2.5 justify-start">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center border bg-gradient-to-br from-muted/50 to-muted">
        <Bot className="h-3 w-3 text-muted-foreground" />
      </div>
      <div className="flex items-center gap-2 text-muted-foreground text-xs bg-muted/30 border rounded-none px-3 py-2">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span>Thinking...</span>
      </div>
    </div>
  );
});
