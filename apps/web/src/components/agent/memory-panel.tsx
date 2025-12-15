"use client";

import { useState, memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Brain,
  ChevronDownIcon,
  ChevronRightIcon,
  Trash2Icon,
  PenTool,
  SearchIcon,
  Loader2Icon,
  Sparkles,
  SettingsIcon,
  UserIcon,
  FileTextIcon,
} from "@/components/ui/icons";
import { motion, AnimatePresence } from "motion/react";
import { formatDistanceToNow } from "date-fns";

// Memory types based on the agent_memories schema
export type MemoryType = "preference" | "fact" | "pattern" | "instruction";

export interface AgentMemory {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  context: string | null;
  importance: number;
  accessCount: number;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Type icons and labels
const MEMORY_TYPE_CONFIG: Record<MemoryType, { icon: typeof Brain; label: string; color: string }> = {
  preference: { icon: SettingsIcon, label: "Preference", color: "text-blue-500" },
  fact: { icon: FileTextIcon, label: "Fact", color: "text-emerald-500" },
  pattern: { icon: Sparkles, label: "Pattern", color: "text-purple-500" },
  instruction: { icon: UserIcon, label: "Instruction", color: "text-amber-500" },
};

interface MemoryItemProps {
  memory: AgentMemory;
  onDelete?: (id: string) => void;
  onEdit?: (memory: AgentMemory) => void;
}

const MemoryItem = memo(function MemoryItem({
  memory,
  onDelete,
  onEdit,
}: MemoryItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = MEMORY_TYPE_CONFIG[memory.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="border rounded-none bg-card"
    >
      <div
        className="flex items-start gap-2 p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Icon */}
        <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted", config.color)}>
          <Icon className="h-3 w-3" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-none text-[9px] px-1 py-0 h-4">
              {config.label}
            </Badge>
            {memory.importance >= 8 && (
              <Badge variant="secondary" className="rounded-none text-[9px] px-1 py-0 h-4">
                Important
              </Badge>
            )}
          </div>
          <p className="text-xs text-foreground mt-1 line-clamp-2">
            {memory.content}
          </p>
        </div>

        {/* Chevron */}
        {isExpanded ? (
          <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t bg-muted/20"
          >
            <div className="p-2.5 space-y-2">
              {memory.context && (
                <div className="text-[10px]">
                  <span className="text-muted-foreground">Context: </span>
                  <span className="font-mono">{memory.context}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>Created {formatDistanceToNow(new Date(memory.createdAt), { addSuffix: true })}</span>
                <span>Accessed {memory.accessCount} time{memory.accessCount !== 1 ? "s" : ""}</span>
                <span>Importance: {memory.importance}/10</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {onEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(memory);
                    }}
                    className="h-6 text-[10px] rounded-none gap-1"
                  >
                    <PenTool className="h-2.5 w-2.5" />
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(memory.id);
                    }}
                    className="h-6 text-[10px] rounded-none gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2Icon className="h-2.5 w-2.5" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

interface MemoryPanelProps {
  memories?: AgentMemory[];
  isLoading?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (memory: AgentMemory) => void;
  className?: string;
}

export const MemoryPanel = memo(function MemoryPanel({
  memories = [],
  isLoading = false,
  onDelete,
  onEdit,
  className,
}: MemoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<MemoryType | "all">("all");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Filter memories
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      const matchesType = selectedType === "all" || m.type === selectedType;
      const matchesSearch =
        !searchQuery ||
        m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.context?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [memories, selectedType, searchQuery]);

  // Group by type for summary
  const typeCounts = useMemo(() => {
    const counts: Record<MemoryType, number> = {
      preference: 0,
      fact: 0,
      pattern: 0,
      instruction: 0,
    };
    memories.forEach((m) => {
      counts[m.type]++;
    });
    return counts;
  }, [memories]);

  const handleDelete = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm && onDelete) {
      onDelete(showDeleteConfirm);
    }
    setShowDeleteConfirm(null);
  };

  return (
    <>
      <div className={cn("border rounded-none bg-card", className)}>
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-muted/30 transition-colors border-b"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Brain className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-medium flex-1">Agent Memory</span>
          <Badge variant="outline" className="rounded-none text-[10px] px-1.5 py-0 h-4">
            {memories.length} item{memories.length !== 1 ? "s" : ""}
          </Badge>
          {isExpanded ? (
            <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>

        {/* Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {/* Filters */}
              <div className="p-2 border-b space-y-2 bg-muted/20">
                {/* Search */}
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search memories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 text-xs pl-7 rounded-none"
                  />
                </div>

                {/* Type filters */}
                <div className="flex items-center gap-1 flex-wrap">
                  <Button
                    size="sm"
                    variant={selectedType === "all" ? "secondary" : "ghost"}
                    onClick={() => setSelectedType("all")}
                    className="h-6 text-[10px] rounded-none px-2"
                  >
                    All ({memories.length})
                  </Button>
                  {(Object.keys(MEMORY_TYPE_CONFIG) as MemoryType[]).map((type) => (
                    <Button
                      key={type}
                      size="sm"
                      variant={selectedType === type ? "secondary" : "ghost"}
                      onClick={() => setSelectedType(type)}
                      className={cn(
                        "h-6 text-[10px] rounded-none px-2",
                        selectedType === type && MEMORY_TYPE_CONFIG[type].color
                      )}
                    >
                      {MEMORY_TYPE_CONFIG[type].label} ({typeCounts[type]})
                    </Button>
                  ))}
                </div>
              </div>

              {/* Memory list */}
              <div className="max-h-[300px] overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                    Loading memories...
                  </div>
                ) : filteredMemories.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                    <Brain className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {searchQuery || selectedType !== "all"
                        ? "No memories match your filters"
                        : "No memories stored yet"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      The agent learns your preferences as you interact
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1.5">
                    {filteredMemories.map((memory) => (
                      <MemoryItem
                        key={memory.id}
                        memory={memory}
                        onDelete={onDelete ? handleDelete : undefined}
                        onEdit={onEdit}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteConfirm !== null} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="max-w-xs rounded-none">
          <DialogHeader>
            <DialogTitle className="text-base">Remove Memory</DialogTitle>
            <DialogDescription className="text-xs">
              This memory will be permanently removed. The agent will no longer remember this information.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(null)}
              className="rounded-none h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="rounded-none h-8 text-xs"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

// Compact memory badge for showing in chat
interface MemoryBadgeProps {
  type: MemoryType;
  content: string;
  onClick?: () => void;
}

export const MemoryBadge = memo(function MemoryBadge({
  type,
  content,
  onClick,
}: MemoryBadgeProps) {
  const config = MEMORY_TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px]",
        "bg-muted/50 border rounded-none hover:bg-muted transition-colors",
        "max-w-[200px]"
      )}
    >
      <Icon className={cn("h-2.5 w-2.5 shrink-0", config.color)} />
      <span className="truncate">{content}</span>
    </button>
  );
});

export default MemoryPanel;
