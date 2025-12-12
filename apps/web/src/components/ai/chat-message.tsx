import { cn } from "@/lib/utils";
import { Bot, UserIcon } from "@/components/ui/icons";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Bot className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div
        className={cn(
          "rounded-lg px-4 py-2.5 max-w-[85%] text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap">{content}</p>
      </div>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
          <UserIcon className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
