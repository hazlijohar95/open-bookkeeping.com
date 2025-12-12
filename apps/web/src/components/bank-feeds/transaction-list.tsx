import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowUpRight,
  ArrowDownLeft,
  MoreHorizontalIcon,
  Link,
  CheckCircle2Icon,
  XCircleIcon,
  UserIcon,
  Building2,
  Sparkles,
  Check,
  X,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { MatchSuggestionsModal } from "./match-suggestions-modal";
import {
  useTransactions,
  useUpdateTransactionMatch,
  useReconcileTransaction,
  useAcceptSuggestion,
  useRejectSuggestion
} from "@/api/bank-feed";

interface TransactionListProps {
  bankAccountId: string;
}

interface SelectedTransaction {
  id: string;
  description: string;
  amount: string;
  type: "deposit" | "withdrawal";
}

const statusConfig = {
  unmatched: { label: "Unmatched", className: "bg-warning/10 text-warning-foreground dark:text-warning" },
  suggested: { label: "Suggested", className: "bg-info/10 text-info" },
  matched: { label: "Matched", className: "bg-success/10 text-success" },
  excluded: { label: "Excluded", className: "bg-secondary text-secondary-foreground" },
};

export function TransactionList({ bankAccountId }: TransactionListProps) {
  const [filter, setFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<SelectedTransaction | null>(null);

  const { data: transactionsResponse, isLoading } = useTransactions(bankAccountId, {
    limit: 100,
    matchStatus: filter !== "all" ? (filter as any) : undefined,
  });

  const transactions = transactionsResponse?.data;

  const updateMatchMutation = useUpdateTransactionMatch();
  const reconcileMutation = useReconcileTransaction();
  const acceptSuggestionMutation = useAcceptSuggestion();
  const rejectSuggestionMutation = useRejectSuggestion();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!transactions?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border bg-muted/30">
        <div className="text-muted-foreground text-sm">No transactions yet</div>
        <div className="text-muted-foreground/70 text-xs mt-1">
          Import a bank statement to get started
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { value: "all", label: "All" },
          { value: "unmatched", label: "Unmatched" },
          { value: "suggested", label: "Suggested" },
          { value: "matched", label: "Matched" },
        ].map((tab) => (
          <Button
            key={tab.value}
            variant={filter === tab.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Transaction List */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground w-8"></th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">
                Description
              </th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Status</th>
              <th className="text-center py-2.5 px-3 font-medium text-muted-foreground w-12">
                Match
              </th>
              <th className="text-right py-2.5 px-3 font-medium text-muted-foreground w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map((transaction) => {
              const status = statusConfig[transaction.matchStatus];
              const isDeposit = transaction.type === "deposit";

              return (
                <tr
                  key={transaction.id}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    transaction.isReconciled && "bg-muted/20"
                  )}
                >
                  <td className="py-2.5 px-3">
                    <div
                      className={cn(
                        "size-6 rounded-full flex items-center justify-center",
                        isDeposit ? "bg-success/10" : "bg-destructive/10"
                      )}
                    >
                      {isDeposit ? (
                        <ArrowDownLeft className="size-3.5 text-success" />
                      ) : (
                        <ArrowUpRight className="size-3.5 text-destructive" />
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">
                    {format(new Date(transaction.transactionDate), "dd MMM yyyy")}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="max-w-[250px] truncate">{transaction.description}</div>
                    {transaction.reference && (
                      <div className="text-xs text-muted-foreground">
                        Ref: {transaction.reference}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-medium">
                    <span className={isDeposit ? "text-success" : "text-destructive"}>
                      {isDeposit ? "+" : "-"}MYR{" "}
                      {parseFloat(transaction.amount).toLocaleString("en-MY", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <Badge variant="outline" className={cn("text-xs", status.className)}>
                      {status.label}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {transaction.matchStatus === "suggested" && (
                      <div className="flex items-center justify-center gap-1">
                        {transaction.matchedCustomerId && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <UserIcon className="size-3" />
                            <span className="truncate max-w-[60px]">Customer</span>
                          </div>
                        )}
                        {transaction.matchedVendorId && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="size-3" />
                            <span className="truncate max-w-[60px]">Vendor</span>
                          </div>
                        )}
                        <div className="flex gap-0.5 ml-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 text-success hover:bg-success/10"
                            onClick={() => acceptSuggestionMutation.mutate(transaction.id)}
                            disabled={acceptSuggestionMutation.isPending}
                          >
                            <Check className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-5 text-destructive hover:bg-destructive/10"
                            onClick={() => rejectSuggestionMutation.mutate(transaction.id)}
                            disabled={rejectSuggestionMutation.isPending}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {transaction.matchStatus !== "suggested" && transaction.matchedCustomerId && (
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <UserIcon className="size-3" />
                        <span className="truncate max-w-[80px]">Customer Match</span>
                      </div>
                    )}
                    {transaction.matchStatus !== "suggested" && transaction.matchedVendorId && (
                      <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="size-3" />
                        <span className="truncate max-w-[80px]">Vendor Match</span>
                      </div>
                    )}
                    {transaction.categoryId && (
                      <Badge variant="outline" className="text-xs">
                        Category
                      </Badge>
                    )}
                    {!transaction.matchedCustomerId &&
                      !transaction.matchedVendorId &&
                      !transaction.categoryId && <span className="text-muted-foreground/50">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-7">
                          <MoreHorizontalIcon className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            setSelectedTransaction({
                              id: transaction.id,
                              description: transaction.description,
                              amount: transaction.amount,
                              type: transaction.type,
                            })
                          }
                        >
                          <Sparkles className="size-4" />
                          <span>Find Match</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateMatchMutation.mutate({
                              id: transaction.id,
                              matchStatus: "matched",
                            })
                          }
                        >
                          <Link className="size-4" />
                          <span>Mark as Matched</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => reconcileMutation.mutate(transaction.id)}
                          disabled={transaction.isReconciled}
                        >
                          <CheckCircle2Icon className="size-4" />
                          <span>Reconcile</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() =>
                            updateMatchMutation.mutate({
                              id: transaction.id,
                              matchStatus: "excluded",
                            })
                          }
                        >
                          <XCircleIcon className="size-4" />
                          <span>Exclude</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Match Suggestions Modal */}
      <MatchSuggestionsModal
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        transactionId={selectedTransaction?.id ?? null}
        transactionDescription={selectedTransaction?.description}
        transactionAmount={selectedTransaction?.amount}
        transactionType={selectedTransaction?.type}
      />
    </div>
  );
}
