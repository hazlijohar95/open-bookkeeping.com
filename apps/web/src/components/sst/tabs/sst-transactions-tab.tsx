import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Filter, FileText } from "@/components/ui/icons";
import type { TaxTypeFilter, DocumentTypeFilter } from "./types";

interface SSTTransaction {
  id: string;
  documentDate: string;
  documentType: string;
  documentNumber: string;
  customerName?: string | null;
  customerTin?: string | null;
  taxType: string;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
}

interface Pagination {
  page: number;
  totalPages: number;
  totalCount: number;
}

interface SSTTransactionsTabProps {
  transactions: { transactions: SSTTransaction[]; pagination: Pagination } | undefined;
  transactionsLoading: boolean;
  taxTypeFilter: TaxTypeFilter;
  setTaxTypeFilter: (filter: TaxTypeFilter) => void;
  documentTypeFilter: DocumentTypeFilter;
  setDocumentTypeFilter: (filter: DocumentTypeFilter) => void;
  transactionPage: number;
  setTransactionPage: (page: number | ((p: number) => number)) => void;
  currency?: string;
}

export function SSTTransactionsTab({
  transactions,
  transactionsLoading,
  taxTypeFilter,
  setTaxTypeFilter,
  documentTypeFilter,
  setDocumentTypeFilter,
  transactionPage,
  setTransactionPage,
  currency = "MYR",
}: SSTTransactionsTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-medium">SST Transactions</CardTitle>
              <CardDescription>All SST transactions from invoices</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={taxTypeFilter} onValueChange={(v) => setTaxTypeFilter(v as TaxTypeFilter)}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 size-4" />
                  <SelectValue placeholder="Tax Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="sales_tax">Sales Tax</SelectItem>
                  <SelectItem value="service_tax">Service Tax</SelectItem>
                </SelectContent>
              </Select>
              <Select value={documentTypeFilter} onValueChange={(v) => setDocumentTypeFilter(v as DocumentTypeFilter)}>
                <SelectTrigger className="w-[140px]">
                  <FileText className="mr-2 size-4" />
                  <SelectValue placeholder="Document" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  <SelectItem value="invoice">Invoices</SelectItem>
                  <SelectItem value="credit_note">Credit Notes</SelectItem>
                  <SelectItem value="debit_note">Debit Notes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !transactions?.transactions.length ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              No SST transactions found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Tax Type</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{new Date(t.documentDate).toLocaleDateString("en-MY")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {t.documentType}
                          </Badge>
                          <span className="text-sm">{t.documentNumber}</span>
                        </div>
                      </TableCell>
                      <TableCell>{t.customerName || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={t.taxType === "sales_tax" ? "default" : "secondary"}>
                          {t.taxType === "sales_tax" ? "Sales" : "Service"}
                        </Badge>
                      </TableCell>
                      <TableCell>{t.taxRate}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.taxableAmount, currency)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(t.taxAmount, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {transactions.pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Page {transactions.pagination.page} of {transactions.pagination.totalPages} (
                    {transactions.pagination.totalCount} total)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={transactionPage === 1}
                      onClick={() => setTransactionPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={transactionPage === transactions.pagination.totalPages}
                      onClick={() => setTransactionPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
