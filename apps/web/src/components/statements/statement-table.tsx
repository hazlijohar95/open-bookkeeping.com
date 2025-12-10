import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatementEntry {
  id: string;
  date: string;
  type: "invoice" | "payment" | "credit_note" | "debit_note" | "bill";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

interface StatementTableProps {
  entries: StatementEntry[];
  currency: string;
  isLoading?: boolean;
}

const formatCurrency = (value: number, currency: string) => {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case "invoice":
      return { variant: "info" as const, label: "Invoice" };
    case "payment":
      return { variant: "success" as const, label: "Payment" };
    case "quotation":
      return { variant: "default" as const, label: "Quotation" };
    case "credit_note":
      return { variant: "warning" as const, label: "Credit Note" };
    case "debit_note":
      return { variant: "destructive" as const, label: "Debit Note" };
    default:
      return { variant: "secondary" as const, label: type };
  }
};

export function StatementTable({
  entries,
  currency,
  isLoading = false,
}: StatementTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">
            No transactions found for the selected period
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => {
                const typeBadge = getTypeBadge(entry.type);
                return (
                  <TableRow key={`${entry.reference}-${index}`}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeBadge.variant} size="xs">
                        {typeBadge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {entry.reference}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {entry.description}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.debit > 0 ? formatCurrency(entry.debit, currency) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.credit > 0 ? formatCurrency(entry.credit, currency) : "-"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono font-medium",
                        entry.balance < 0 && "text-destructive"
                      )}
                    >
                      {formatCurrency(entry.balance, currency)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
