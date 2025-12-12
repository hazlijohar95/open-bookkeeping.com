import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Customer } from "@/types/common/customer";
import { UsersIcon } from "@/assets/icons";
import { useUnpaidInvoices } from "@/api/invoices";
import { AgingChart, formatAgingBuckets } from "@/components/aging/aging-chart";
import { AgingTable } from "@/components/aging/aging-table";
import { UserIcon, FileTextIcon, TrendingUp, MailIcon, Phone, MapPin } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

function CustomerInfo({ customer }: { customer: Customer }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <UserIcon className="size-4" />
          Contact Information
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <MailIcon className="size-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="text-sm">
                {customer.email || <span className="text-muted-foreground/50">Not provided</span>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="size-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Phone</div>
              <div className="text-sm">
                {customer.phone || <span className="text-muted-foreground/50">Not provided</span>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:col-span-2">
            <MapPin className="size-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Address</div>
              <div className="text-sm">
                {customer.address || <span className="text-muted-foreground/50">Not provided</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {customer.metadata && customer.metadata.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="font-medium mb-3">Additional Details</h4>
          <div className="grid grid-cols-2 gap-3">
            {customer.metadata.map((meta) => (
              <div key={meta.id}>
                <div className="text-xs text-muted-foreground">{meta.label}</div>
                <div className="text-sm">{meta.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerAging({ customerId }: { customerId: string }) {
  const { data: invoices, isLoading } = useUnpaidInvoices(customerId);

  const { agingData, tableData } = useMemo(() => {
    if (!invoices) return { agingData: null, tableData: [] };

    const now = new Date();
    const bucketAmounts = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0,
    };
    const bucketCounts = {
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0,
    };

    const tableItems = invoices.map((inv) => {
      const items = inv.invoiceFields?.items ?? [];
      const total = items.reduce((sum, item) => {
        const price = typeof item.unitPrice === "number" ? item.unitPrice : parseFloat(String(item.unitPrice ?? "0"));
        return sum + (item.quantity * price);
      }, 0);
      const dueDateStr = inv.invoiceFields?.invoiceDetails?.dueDate;
      const dueDate = dueDateStr ? new Date(dueDateStr) : null;
      const daysOverdue = dueDate
        ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Categorize into bucket
      if (daysOverdue <= 0) {
        bucketAmounts.current += total;
        bucketCounts.current++;
      } else if (daysOverdue <= 30) {
        bucketAmounts.days1to30 += total;
        bucketCounts.days1to30++;
      } else if (daysOverdue <= 60) {
        bucketAmounts.days31to60 += total;
        bucketCounts.days31to60++;
      } else if (daysOverdue <= 90) {
        bucketAmounts.days61to90 += total;
        bucketCounts.days61to90++;
      } else {
        bucketAmounts.over90 += total;
        bucketCounts.over90++;
      }

      const dateStr = inv.invoiceFields?.invoiceDetails?.date || inv.createdAt;

      return {
        id: inv.id,
        serialNumber: `${inv.invoiceFields?.invoiceDetails?.prefix ?? "INV"}-${inv.invoiceFields?.invoiceDetails?.serialNumber ?? "000"}`,
        date: new Date(dateStr),
        dueDate,
        total,
        currency: inv.invoiceFields?.invoiceDetails?.currency ?? "MYR",
        status: inv.status,
        daysOverdue,
      };
    });

    return {
      agingData: formatAgingBuckets(bucketCounts, bucketAmounts, "ar"),
      tableData: tableItems.sort((a, b) => b.daysOverdue - a.daysOverdue),
    };
  }, [invoices]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!invoices?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TrendingUp className="size-12 text-muted-foreground/30 mb-3" />
        <div className="text-muted-foreground text-sm">No outstanding invoices</div>
        <div className="text-muted-foreground/70 text-xs mt-1">
          All invoices have been paid
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {agingData && (
        <AgingChart
          buckets={agingData}
          currency={invoices[0]?.invoiceFields?.invoiceDetails?.currency ?? "MYR"}
        />
      )}

      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <FileTextIcon className="size-4" />
          Outstanding Invoices
        </h4>
        <AgingTable invoices={tableData} type="ar" />
      </div>
    </div>
  );
}

export function CustomerDetailModal({ isOpen, onClose, customer }: CustomerDetailModalProps) {
  if (!customer) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeaderContainer>
          <DialogIcon>
            <UsersIcon />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {customer.name}
              <Badge variant="secondary" className="text-xs font-normal">
                Customer
              </Badge>
            </DialogTitle>
            <DialogDescription>
              View customer details and accounts receivable aging
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList>
            <TabsTrigger value="details" className="gap-1.5">
              <UserIcon className="size-3.5" />
              Details
            </TabsTrigger>
            <TabsTrigger value="aging" className="gap-1.5">
              <TrendingUp className="size-3.5" />
              AR Aging
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <CustomerInfo customer={customer} />
          </TabsContent>

          <TabsContent value="aging" className="mt-4">
            <CustomerAging customerId={customer.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
