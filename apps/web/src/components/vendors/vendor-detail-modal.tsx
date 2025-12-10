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
import { Vendor } from "@/types/common/vendor";
import { TruckIcon } from "@/assets/icons";
import { useBillsByVendor } from "@/api/bills";
import { AgingChart, formatAgingBuckets } from "@/components/aging/aging-chart";
import { AgingTable } from "@/components/aging/aging-table";
import {
  User,
  FileText,
  TrendingDown,
  Mail,
  Phone,
  MapPin,
  Globe,
  Building2,
  CreditCard,
  Receipt,
} from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import Decimal from "decimal.js";

interface VendorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
}

function VendorInfo({ vendor }: { vendor: Vendor }) {
  return (
    <div className="space-y-4">
      {/* Contact Information */}
      <div className="rounded-lg border bg-card p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <User className="size-4" />
          Contact Information
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <Mail className="size-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div className="text-sm">
                {vendor.email || <span className="text-muted-foreground/50">Not provided</span>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="size-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Phone</div>
              <div className="text-sm">
                {vendor.phone || <span className="text-muted-foreground/50">Not provided</span>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Globe className="size-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Website</div>
              <div className="text-sm">
                {vendor.website || <span className="text-muted-foreground/50">Not provided</span>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 sm:col-span-2">
            <MapPin className="size-4 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground">Address</div>
              <div className="text-sm">
                {vendor.address || <span className="text-muted-foreground/50">Not provided</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Details */}
      {(vendor.bankName || vendor.bankAccountNumber) && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Building2 className="size-4" />
            Bank Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Bank Name</div>
              <div className="text-sm">{vendor.bankName || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Account Number</div>
              <div className="text-sm font-mono">{vendor.bankAccountNumber || "-"}</div>
            </div>
            {vendor.bankSwiftCode && (
              <div>
                <div className="text-xs text-muted-foreground">SWIFT Code</div>
                <div className="text-sm font-mono">{vendor.bankSwiftCode}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Terms */}
      {(vendor.paymentTermsDays || vendor.creditLimit) && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <CreditCard className="size-4" />
            Payment Terms
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vendor.paymentTermsDays && (
              <div>
                <div className="text-xs text-muted-foreground">Payment Terms</div>
                <div className="text-sm">Net {vendor.paymentTermsDays} days</div>
              </div>
            )}
            {vendor.creditLimit && (
              <div>
                <div className="text-xs text-muted-foreground">Credit Limit</div>
                <div className="text-sm">MYR {parseFloat(vendor.creditLimit).toLocaleString()}</div>
              </div>
            )}
            {vendor.preferredPaymentMethod && (
              <div>
                <div className="text-xs text-muted-foreground">Preferred Method</div>
                <div className="text-sm">{vendor.preferredPaymentMethod}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tax Information */}
      {(vendor.taxId || vendor.vatNumber || vendor.registrationNumber) && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Receipt className="size-4" />
            Tax Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {vendor.taxId && (
              <div>
                <div className="text-xs text-muted-foreground">Tax ID</div>
                <div className="text-sm font-mono">{vendor.taxId}</div>
              </div>
            )}
            {vendor.vatNumber && (
              <div>
                <div className="text-xs text-muted-foreground">VAT Number</div>
                <div className="text-sm font-mono">{vendor.vatNumber}</div>
              </div>
            )}
            {vendor.registrationNumber && (
              <div>
                <div className="text-xs text-muted-foreground">Registration No</div>
                <div className="text-sm font-mono">{vendor.registrationNumber}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Metadata */}
      {vendor.metadata && vendor.metadata.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h4 className="font-medium mb-3">Additional Details</h4>
          <div className="grid grid-cols-2 gap-3">
            {vendor.metadata.map((meta) => (
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

function VendorAging({ vendorId }: { vendorId: string }) {
  const { data: billsResponse, isLoading } = useBillsByVendor(vendorId, {
    limit: 100,
    offset: 0,
  });

  const bills = billsResponse?.data;

  const { agingData, tableData } = useMemo(() => {
    if (!bills) return { agingData: null, tableData: [] };

    // Filter to only unpaid bills
    const unpaidBills = bills.filter(
      (bill) => bill.status === "pending" || bill.status === "overdue"
    );

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

    const tableItems = unpaidBills.map((bill) => {
      const items = bill.items || [];
      const total = items.reduce((sum, item) => {
        const qty = new Decimal(item.quantity || "0");
        const price = new Decimal(item.unitPrice || "0");
        return sum + qty.times(price).toNumber();
      }, 0);
      const dueDate = bill.dueDate;
      const daysOverdue = dueDate
        ? Math.floor((now.getTime() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24))
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

      return {
        id: bill.id,
        serialNumber: bill.billNumber,
        date: bill.billDate,
        dueDate: dueDate || null,
        total,
        currency: bill.currency || "MYR",
        status: bill.status,
        daysOverdue,
      };
    });

    return {
      agingData: formatAgingBuckets(bucketCounts, bucketAmounts, "ap"),
      tableData: tableItems.sort((a, b) => b.daysOverdue - a.daysOverdue),
    };
  }, [bills]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!tableData.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <TrendingDown className="size-12 text-muted-foreground/30 mb-3" />
        <div className="text-muted-foreground text-sm">No outstanding bills</div>
        <div className="text-muted-foreground/70 text-xs mt-1">
          All bills have been paid
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {agingData && (
        <AgingChart
          buckets={agingData}
          currency={tableData[0]?.currency || "MYR"}
        />
      )}

      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <FileText className="size-4" />
          Outstanding Bills
        </h4>
        <AgingTable invoices={tableData} type="ap" />
      </div>
    </div>
  );
}

export function VendorDetailModal({ isOpen, onClose, vendor }: VendorDetailModalProps) {
  if (!vendor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeaderContainer>
          <DialogIcon>
            <TruckIcon />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {vendor.name}
              <Badge variant="secondary" className="text-xs font-normal">
                Vendor
              </Badge>
            </DialogTitle>
            <DialogDescription>
              View vendor details and accounts payable aging
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList>
            <TabsTrigger value="details" className="gap-1.5">
              <User className="size-3.5" />
              Details
            </TabsTrigger>
            <TabsTrigger value="aging" className="gap-1.5">
              <TrendingDown className="size-3.5" />
              AP Aging
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <VendorInfo vendor={vendor} />
          </TabsContent>

          <TabsContent value="aging" className="mt-4">
            <VendorAging vendorId={vendor.id} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
