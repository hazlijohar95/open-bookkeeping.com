import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContentContainer,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import {
  UserIcon,
  Building2,
  FileTextIcon,
  Receipt,
  CheckCircle2Icon,
  Sparkles,
  AlertCircleIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useMatchSuggestions, useApplyMatch } from "@/api/bank-feed";

interface MatchSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string | null;
  transactionDescription?: string;
  transactionAmount?: string;
  transactionType?: "deposit" | "withdrawal";
}

interface Suggestion {
  type: "customer" | "vendor" | "invoice" | "bill";
  id: string;
  name: string;
  confidence: number;
  reason: string;
  matchedAmount?: string;
}

const suggestionIcons = {
  customer: UserIcon,
  vendor: Building2,
  invoice: FileTextIcon,
  bill: Receipt,
};

const suggestionColors = {
  customer: "text-info bg-info/10",
  vendor: "text-primary bg-primary/10",
  invoice: "text-success bg-success/10",
  bill: "text-warning-foreground dark:text-warning bg-warning/10",
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);

  if (percentage >= 90) {
    return (
      <Badge variant="success">
        {percentage}% match
      </Badge>
    );
  }

  if (percentage >= 70) {
    return (
      <Badge variant="warning">
        {percentage}% match
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      {percentage}% match
    </Badge>
  );
}

export function MatchSuggestionsModal({
  isOpen,
  onClose,
  transactionId,
  transactionDescription,
  transactionAmount,
  transactionType,
}: MatchSuggestionsModalProps) {
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

  const { data: suggestions, isLoading } = useMatchSuggestions(transactionId ?? "");

  const applyMatchMutation = useApplyMatch();

  const handleClose = () => {
    setSelectedSuggestion(null);
    onClose();
  };

  const handleApplyMatch = () => {
    if (!selectedSuggestion || !transactionId) return;

    applyMatchMutation.mutate({
      transactionId,
      matchType: selectedSuggestion.type,
      matchId: selectedSuggestion.id,
      confidence: selectedSuggestion.confidence,
    }, {
      onSuccess: () => {
        toast.success("Match applied successfully");
        handleClose();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeaderContainer>
          <DialogIcon>
            <Sparkles className="size-5" />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Match Suggestions</DialogTitle>
            <DialogDescription>
              Select a match for this transaction or search for a specific match.
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogContentContainer>
          <div className="space-y-4">
            {/* Transaction Info */}
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-xs text-muted-foreground mb-1">Transaction</div>
              <div className="font-medium text-sm truncate">{transactionDescription}</div>
              <div className="text-sm mt-1">
                <span
                  className={
                    transactionType === "deposit" ? "text-success" : "text-destructive"
                  }
                >
                  {transactionType === "deposit" ? "+" : "-"}MYR {transactionAmount}
                </span>
              </div>
            </div>

            {/* Suggestions List */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Suggested Matches</div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : suggestions && suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map((suggestion) => {
                    const Icon = suggestionIcons[suggestion.type];
                    const colorClass = suggestionColors[suggestion.type];
                    const isSelected = selectedSuggestion?.id === suggestion.id;

                    return (
                      <button
                        key={`${suggestion.type}-${suggestion.id}`}
                        type="button"
                        className={cn(
                          "w-full rounded-lg border p-3 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => setSelectedSuggestion(suggestion)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "size-8 rounded-full flex items-center justify-center shrink-0",
                              colorClass
                            )}
                          >
                            <Icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-sm truncate">
                                {suggestion.name}
                              </div>
                              <ConfidenceBadge confidence={suggestion.confidence} />
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {suggestion.reason}
                            </div>
                            {suggestion.matchedAmount && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Amount: MYR {suggestion.matchedAmount}
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2Icon className="size-4 text-primary shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <AlertCircleIcon className="size-8 mb-2 text-muted-foreground/50" />
                  <div className="text-sm">No match suggestions found</div>
                  <div className="text-xs mt-1">
                    Try manually matching to a customer or vendor
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContentContainer>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={applyMatchMutation.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleApplyMatch}
            disabled={!selectedSuggestion || applyMatchMutation.isPending}
          >
            {applyMatchMutation.isPending ? "Applying..." : "Apply Match"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
