import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Decimal from "decimal.js";

interface AgingInvoice {
  id: string;
  serialNumber: string;
  date: Date;
  dueDate: Date | null;
  total: number;
  currency: string;
  status: string;
  daysOverdue: number;
}

interface AgingTableProps {
  invoices: AgingInvoice[];
  type: "ar" | "ap";
  emptyMessage?: string;
}

function getDaysOverdueClass(days: number): string {
  if (days <= 0) return "text-success";
  if (days <= 30) return "text-warning-foreground dark:text-warning";
  if (days <= 60) return "text-warning-foreground dark:text-warning";
  if (days <= 90) return "text-destructive";
  return "text-destructive font-semibold";
}

function getStatusBadgeClass(days: number): string {
  if (days <= 0) return "bg-success/10 text-success";
  if (days <= 30) return "bg-warning/10 text-warning-foreground dark:text-warning";
  if (days <= 60) return "bg-warning/10 text-warning-foreground dark:text-warning";
  if (days <= 90) return "bg-destructive/10 text-destructive";
  return "bg-destructive/20 text-destructive";
}

function getAgingLabel(days: number): string {
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30 Days";
  if (days <= 60) return "31-60 Days";
  if (days <= 90) return "61-90 Days";
  return "90+ Days";
}

export function AgingTable({ invoices, type, emptyMessage }: AgingTableProps) {
  const documentLabel = type === "ar" ? "Invoice" : "Bill";

  if (!invoices.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-muted-foreground text-sm">
          {emptyMessage || `No outstanding ${documentLabel.toLowerCase()}s`}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">
              {documentLabel} #
            </th>
            <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Date</th>
            <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Due Date</th>
            <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Amount</th>
            <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Aging</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-muted/30 transition-colors">
              <td className="py-2.5 px-3 font-medium">{invoice.serialNumber}</td>
              <td className="py-2.5 px-3 text-muted-foreground">
                {format(new Date(invoice.date), "dd MMM yyyy")}
              </td>
              <td className="py-2.5 px-3">
                {invoice.dueDate ? (
                  <span className={cn(getDaysOverdueClass(invoice.daysOverdue))}>
                    {format(new Date(invoice.dueDate), "dd MMM yyyy")}
                  </span>
                ) : (
                  <span className="text-muted-foreground/50">-</span>
                )}
              </td>
              <td className="py-2.5 px-3 text-right font-medium">
                {invoice.currency}{" "}
                {invoice.total.toLocaleString("en-MY", { minimumFractionDigits: 2 })}
              </td>
              <td className="py-2.5 px-3 text-center">
                <Badge
                  variant="outline"
                  className={cn("text-xs", getStatusBadgeClass(invoice.daysOverdue))}
                >
                  {getAgingLabel(invoice.daysOverdue)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/30 border-t">
          <tr>
            <td colSpan={3} className="py-2.5 px-3 font-medium">
              Total ({invoices.length} {invoices.length === 1 ? documentLabel.toLowerCase() : `${documentLabel.toLowerCase()}s`})
            </td>
            <td className="py-2.5 px-3 text-right font-semibold">
              {invoices[0]?.currency ?? "MYR"}{" "}
              {invoices
                .reduce((sum, inv) => sum + inv.total, 0)
                .toLocaleString("en-MY", { minimumFractionDigits: 2 })}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Helper to calculate invoice total from items
export function calculateInvoiceTotal(items: Array<{ quantity: number; unitPrice: string | number }>): number {
  return items.reduce((sum, item) => {
    const qty = new Decimal(item.quantity ?? 0);
    const price = new Decimal(item.unitPrice ?? 0);
    return sum + qty.times(price).toNumber();
  }, 0);
}

// Helper to calculate days overdue
export function calculateDaysOverdue(dueDate: Date | null): number {
  if (!dueDate) return 0;
  const now = new Date();
  const due = new Date(dueDate);
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}
