import { useState } from "react";
import { useJournalEntries, usePostJournalEntry, useReverseJournalEntry } from "@/api/chart-of-accounts";
import type { JournalEntry, JournalEntryFilters } from "@/api/chart-of-accounts";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileSpreadsheet, MoreHorizontal, CheckCircle, Undo2Icon, Eye } from "@/components/ui/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const statusColors: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  posted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  reversed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const sourceTypeLabels: Record<string, string> = {
  manual: "Manual",
  invoice: "Invoice",
  bill: "Bill",
  bank_transaction: "Bank",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: string): string {
  const value = parseFloat(amount);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function JournalEntries() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "posted" | "reversed">("all");
  const [entryToPost, setEntryToPost] = useState<JournalEntry | null>(null);
  const [entryToReverse, setEntryToReverse] = useState<JournalEntry | null>(null);

  const filters: JournalEntryFilters = {
    ...(statusFilter !== "all" && { status: statusFilter }),
    limit: 100,
  };

  const { data: entries, isLoading } = useJournalEntries(filters, {
    enabled: !!user && !isAuthLoading,
  });

  const postEntry = usePostJournalEntry();
  const reverseEntry = useReverseJournalEntry();

  const handlePostEntry = async () => {
    if (!entryToPost) return;
    try {
      await postEntry.mutateAsync({ id: entryToPost.id });
      toast.success(`Journal entry ${entryToPost.entryNumber} posted successfully`);
      setEntryToPost(null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to post journal entry");
    }
  };

  const handleReverseEntry = async () => {
    if (!entryToReverse) return;
    try {
      const today = new Date().toISOString().split("T")[0] ?? "";
      await reverseEntry.mutateAsync({
        id: entryToReverse.id,
        reversalDate: today,
      });
      toast.success(`Journal entry ${entryToReverse.entryNumber} reversed successfully`);
      setEntryToReverse(null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to reverse journal entry");
    }
  };

  // Calculate totals for each entry
  const calculateTotals = (entry: JournalEntry) => {
    if (!entry.lines) return { debit: "0", credit: "0" };
    const debit = entry.lines.reduce((sum, line) => sum + parseFloat(line.debitAmount || "0"), 0);
    const credit = entry.lines.reduce((sum, line) => sum + parseFloat(line.creditAmount || "0"), 0);
    return { debit: debit.toFixed(2), credit: credit.toFixed(2) };
  };

  if (isLoading || isAuthLoading) {
    return (
      <PageSkeleton
        title="Journal Entries"
        description="View and manage double-entry bookkeeping records"
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Journal Entries"
        description="View and manage double-entry bookkeeping records"
        action={
          <Link to="/chart-of-accounts">
            <Button variant="outline">
              <FileSpreadsheet className="size-4" />
              New Entry
            </Button>
          </Link>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!entries?.length ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="No journal entries yet"
          description="Create journal entries from the Chart of Accounts page to record transactions."
          action={
            <Link to="/chart-of-accounts">
              <Button>
                <FileSpreadsheet className="size-4" />
                Go to Chart of Accounts
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-32">Entry #</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-24">Source</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-32 text-right">Debit</TableHead>
                <TableHead className="w-32 text-right">Credit</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const totals = calculateTotals(entry);
                return (
                  <TableRow key={entry.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-sm">
                      {entry.entryNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(entry.entryDate)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md truncate">{entry.description}</div>
                      {entry.reference && (
                        <div className="text-xs text-muted-foreground">
                          Ref: {entry.reference}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {entry.sourceType ? sourceTypeLabels[entry.sourceType] || entry.sourceType : "Manual"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className={cn("text-xs capitalize", statusColors[entry.status])}
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrency(totals.debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrency(totals.credit)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="size-4" />
                            <span>View Details</span>
                          </DropdownMenuItem>
                          {entry.status === "draft" && (
                            <DropdownMenuItem onClick={() => setEntryToPost(entry)}>
                              <CheckCircle className="size-4" />
                              <span>Post Entry</span>
                            </DropdownMenuItem>
                          )}
                          {entry.status === "posted" && (
                            <DropdownMenuItem onClick={() => setEntryToReverse(entry)}>
                              <Undo2Icon className="size-4" />
                              <span>Reverse Entry</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Post Confirmation Dialog */}
      <AlertDialog open={!!entryToPost} onOpenChange={(open: boolean) => !open && setEntryToPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to post entry "{entryToPost?.entryNumber}"?
              This will update account balances and cannot be undone directly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePostEntry}>
              {postEntry.isPending ? "Posting..." : "Post Entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reverse Confirmation Dialog */}
      <AlertDialog open={!!entryToReverse} onOpenChange={(open: boolean) => !open && setEntryToReverse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reverse entry "{entryToReverse?.entryNumber}"?
              This will create a new reversing entry with today's date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReverseEntry} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {reverseEntry.isPending ? "Reversing..." : "Reverse Entry"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
