import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BadgeVariants } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRightIcon, FileTextIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { formatCurrencyWithDecimals, formatDate } from "@/lib/utils";

export interface RecentInvoice {
  id: string;
  serialNumber: string;
  customerName: string;
  total: number;
  currency: string;
  status: string;
  date: Date;
  dueDate?: Date | null;
}

interface RecentInvoicesProps {
  invoices: RecentInvoice[];
  isLoading?: boolean;
  className?: string;
}

const getStatusBadge = (status: string): { variant: BadgeVariants; label: string } => {
  switch (status) {
    case "success":
    case "paid":
      return { variant: "success", label: "Paid" };
    case "pending":
      return { variant: "warning", label: "Pending" };
    case "overdue":
      return { variant: "destructive", label: "Overdue" };
    case "expired":
      return { variant: "secondary", label: "Expired" };
    case "refunded":
      return { variant: "default", label: "Refunded" };
    default:
      return { variant: "secondary", label: status };
  }
};

export const RecentInvoices = memo(function RecentInvoices({
  invoices,
  isLoading = false,
  className,
}: RecentInvoicesProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-medium">Recent Invoices</CardTitle>
          <CardDescription>Latest invoice activity</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/invoices" className="flex items-center gap-1">
            View all
            <ArrowRightIcon className="size-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileTextIcon className="mb-2 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No invoices yet</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link to="/create/invoice">Create your first invoice</Link>
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {invoices.map((invoice) => {
                const statusBadge = getStatusBadge(invoice.status);
                return (
                  <Link
                    key={invoice.id}
                    to={`/edit/invoice/${invoice.id}`}
                    className="group flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{invoice.serialNumber}</p>
                        <Badge variant={statusBadge.variant} size="xs">
                          {statusBadge.label}
                        </Badge>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {invoice.customerName}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="font-medium">
                        {formatCurrencyWithDecimals(invoice.total, invoice.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invoice.date)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
});
