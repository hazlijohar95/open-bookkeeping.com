import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuickReplyProps {
  content: string;
  onReply: (reply: string) => void;
  disabled?: boolean;
  className?: string;
}

// Patterns that indicate the AI is asking a question
const QUESTION_PATTERNS = [
  /\?$/m,                                    // Ends with question mark
  /would you like/i,                         // Would you like...
  /do you want/i,                            // Do you want...
  /should I/i,                               // Should I...
  /shall I/i,                                // Shall I...
  /can I help/i,                             // Can I help...
  /which (one|option)/i,                     // Which one/option...
  /please (confirm|let me know|choose)/i,   // Please confirm...
  /is that (correct|right|ok)/i,            // Is that correct...
  /does (this|that) (look|sound)/i,         // Does this look...
];

// Context-based quick replies
const REPLY_CONTEXTS: Array<{
  pattern: RegExp;
  replies: string[];
}> = [
  // Confirmation questions
  {
    pattern: /proceed|confirm|continue|go ahead|create|submit|save/i,
    replies: ["Yes, proceed", "No, cancel", "Let me review first"],
  },
  // Choice questions
  {
    pattern: /which (customer|vendor|invoice|bill|account)/i,
    replies: ["Show me options", "I'll specify"],
  },
  // Date/period questions
  {
    pattern: /(this month|last month|this year|period|date range)/i,
    replies: ["This month", "Last month", "This year", "Custom range"],
  },
  // Amount/value questions
  {
    pattern: /(amount|total|value|price|cost)/i,
    replies: ["Yes, that's correct", "No, let me adjust"],
  },
  // Help/assistance questions
  {
    pattern: /help|assist|anything else|other questions/i,
    replies: ["Yes, please", "No, that's all", "Show me more"],
  },
  // Approval questions
  {
    pattern: /approve|authorization|permission/i,
    replies: ["Approve", "Reject", "Need more info"],
  },
];

// Default replies when question is detected but no specific context
const DEFAULT_REPLIES = ["Yes", "No", "Tell me more"];

/**
 * Detects if the AI message contains a question and suggests quick replies
 */
function detectQuestionAndReplies(content: string): string[] | null {
  // Check if content contains a question
  const hasQuestion = QUESTION_PATTERNS.some((pattern) => pattern.test(content));

  if (!hasQuestion) {
    return null;
  }

  // Find context-specific replies
  for (const ctx of REPLY_CONTEXTS) {
    if (ctx.pattern.test(content)) {
      return ctx.replies;
    }
  }

  // Return default replies for general questions
  return DEFAULT_REPLIES;
}

/**
 * Quick reply buttons for AI agent questions
 * Automatically detects questions and shows relevant response options
 */
export const QuickReply = memo(function QuickReply({
  content,
  onReply,
  disabled = false,
  className,
}: QuickReplyProps) {
  const suggestedReplies = useMemo(() => detectQuestionAndReplies(content), [content]);

  if (!suggestedReplies || suggestedReplies.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5 mt-2", className)}>
      {suggestedReplies.map((reply) => (
        <Button
          key={reply}
          variant="outline"
          size="sm"
          onClick={() => onReply(reply)}
          disabled={disabled}
          className="h-7 px-3 text-xs rounded-full border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-colors"
        >
          {reply}
        </Button>
      ))}
    </div>
  );
});

/**
 * Hook to check if content has questions (for external use)
 */
export function useHasQuestion(content: string): boolean {
  return useMemo(() => {
    return QUESTION_PATTERNS.some((pattern) => pattern.test(content));
  }, [content]);
}
