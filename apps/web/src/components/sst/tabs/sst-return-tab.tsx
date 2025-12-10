import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar, Download } from "@/components/ui/icons";
import { formatPeriodLabel } from "./types";

interface SST02Return {
  partA: {
    sstRegistrationNumber?: string | null;
    tin?: string | null;
    brn?: string | null;
    taxPeriod: string;
  };
  partB: {
    byRate: Array<{
      rate: number;
      transactionCount: number;
      taxableAmount: number;
      taxAmount: number;
    }>;
    totalTaxableAmount: number;
    totalTaxAmount: number;
  };
  partC: {
    byRate: Array<{
      rate: number;
      transactionCount: number;
      taxableAmount: number;
      taxAmount: number;
    }>;
    totalTaxableAmount: number;
    totalTaxAmount: number;
  };
  partD: {
    totalSalesTax: number;
    totalServiceTax: number;
    totalTaxPayable: number;
  };
  transactions: Array<{
    documentType: string;
    documentNumber?: string | null;
    documentDate: string;
    customerName?: string | null;
    customerTin?: string | null;
    taxType: string;
    taxRate: number;
    taxableAmount: number;
    taxAmount: number;
  }>;
}

interface SSTReturnTabProps {
  sst02Return: SST02Return | undefined;
  returnLoading: boolean;
  availablePeriods: string[] | undefined;
  selectedReturnPeriod: string;
  setSelectedReturnPeriod: (period: string) => void;
  currency?: string;
}

export function SSTReturnTab({
  sst02Return,
  returnLoading,
  availablePeriods,
  selectedReturnPeriod,
  setSelectedReturnPeriod,
  currency = "MYR",
}: SSTReturnTabProps) {
  const exportToCSV = () => {
    if (!sst02Return?.transactions.length) return;

    const headers = [
      "Document Type",
      "Document Number",
      "Document Date",
      "Customer Name",
      "Customer TIN",
      "Tax Type",
      "Tax Rate (%)",
      "Taxable Amount",
      "Tax Amount",
    ];

    const rows = sst02Return.transactions.map((t) => [
      t.documentType,
      t.documentNumber || "",
      new Date(t.documentDate).toLocaleDateString("en-MY"),
      t.customerName || "",
      t.customerTin || "",
      t.taxType === "sales_tax" ? "Sales Tax" : "Service Tax",
      t.taxRate.toFixed(2),
      t.taxableAmount.toFixed(2),
      t.taxAmount.toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sst-transactions-${selectedReturnPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-medium">SST-02 Return Helper</CardTitle>
              <CardDescription>Generate data for your SST-02 return submission</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={selectedReturnPeriod} onValueChange={setSelectedReturnPeriod}>
                <SelectTrigger className="w-[180px]">
                  <Calendar className="mr-2 size-4" />
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent>
                  {availablePeriods?.map((p) => (
                    <SelectItem key={p} value={p}>
                      {formatPeriodLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportToCSV} disabled={!sst02Return?.transactions.length}>
                <Download className="mr-2 size-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {returnLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !sst02Return ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              Select a tax period to generate return data
            </div>
          ) : (
            <div className="space-y-6">
              {/* Part A: Taxable Person Details */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Part A: Taxable Person Details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">SST Registration No.</p>
                    <p className="font-medium">{sst02Return.partA.sstRegistrationNumber || "Not registered"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">TIN</p>
                    <p className="font-medium">{sst02Return.partA.tin || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">BRN</p>
                    <p className="font-medium">{sst02Return.partA.brn || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tax Period</p>
                    <p className="font-medium">{formatPeriodLabel(sst02Return.partA.taxPeriod)}</p>
                  </div>
                </div>
              </div>

              {/* Part B: Sales Tax */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Part B: Sales Tax</h3>
                {!sst02Return.partB.byRate.length ? (
                  <p className="text-muted-foreground">No sales tax transactions</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rate</TableHead>
                        <TableHead>Transactions</TableHead>
                        <TableHead className="text-right">Taxable Amount</TableHead>
                        <TableHead className="text-right">Tax Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sst02Return.partB.byRate.map((r) => (
                        <TableRow key={r.rate}>
                          <TableCell>{r.rate}%</TableCell>
                          <TableCell>{r.transactionCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.taxableAmount, currency)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.taxAmount, currency)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(sst02Return.partB.totalTaxableAmount, currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(sst02Return.partB.totalTaxAmount, currency)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Part C: Service Tax */}
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 font-semibold">Part C: Service Tax</h3>
                {!sst02Return.partC.byRate.length ? (
                  <p className="text-muted-foreground">No service tax transactions</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rate</TableHead>
                        <TableHead>Transactions</TableHead>
                        <TableHead className="text-right">Taxable Amount</TableHead>
                        <TableHead className="text-right">Tax Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sst02Return.partC.byRate.map((r) => (
                        <TableRow key={r.rate}>
                          <TableCell>{r.rate}%</TableCell>
                          <TableCell>{r.transactionCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.taxableAmount, currency)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.taxAmount, currency)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(sst02Return.partC.totalTaxableAmount, currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(sst02Return.partC.totalTaxAmount, currency)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Part D: Summary */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <h3 className="mb-3 font-semibold">Part D: Summary</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Sales Tax</p>
                    <p className="text-xl font-semibold">{formatCurrency(sst02Return.partD.totalSalesTax, currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Service Tax</p>
                    <p className="text-xl font-semibold">{formatCurrency(sst02Return.partD.totalServiceTax, currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Tax Payable</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(sst02Return.partD.totalTaxPayable, currency)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
