import { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { Button } from "@/components/ui/button";
import { UseFormReturn } from "react-hook-form";
import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogContentContainer,
  DialogDescription,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importInvoiceColumnConfig, importInvoiceColumns } from "@/components/table-columns/invoices";
import { getAllInvoices } from "@/lib/indexdb-queries/invoice";
import { DataTable } from "@/components/ui/data-table";
import { Invoice, toInvoices } from "@/types/common/invoice";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers";
import { useInvoices } from "@/api/invoices";
import { InboxArrowDownIcon } from "@/assets/icons";

const ImportInvoice = ({ form }: { form: UseFormReturn<ZodCreateInvoiceSchema> }) => {
  const [open, setOpen] = React.useState(false);
  const { user } = useAuth();

  // Fetching Invoices from the Server
  const serverData = useInvoices({
    enabled: !!user, // Only fetch if user is logged in
  });

  // Fetching Invoices from the LocalDB (IndexedDB)
  const idbData = useQuery({
    queryKey: ["idb-invoices"],
    queryFn: getAllInvoices,
  });

  const isLoading = serverData.isLoading || idbData.isLoading;

  // Combine server and local invoices (filter out incomplete server invoices)
  const serverInvoices = toInvoices(serverData.data as Parameters<typeof toInvoices>[0]);
  const data: Invoice[] = [...serverInvoices, ...(idbData.data ?? [])];

  const handleRowClick = (invoice: Invoice) => {
    if (invoice.type === "local") {
      // For local invoices, we need to convert image urls to base64 if they're local
      const invoiceFields = { ...invoice.invoiceFields };
      const imageBase64 = invoiceFields.companyDetails.logoBase64;
      const sigBase64 = invoiceFields.companyDetails.signatureBase64;

      // If logo is not a remote URL, use the base64 version
      if (invoiceFields.companyDetails.logo && !invoiceFields.companyDetails.logo.startsWith("https://")) {
        invoiceFields.companyDetails.logo = imageBase64 || "";
      }
      // If signature is not a remote URL, use the base64 version
      if (invoiceFields.companyDetails.signature && !invoiceFields.companyDetails.signature.startsWith("https://")) {
        invoiceFields.companyDetails.signature = sigBase64 || "";
      }

      // Reset form with the adjusted invoice fields
      form.reset(invoiceFields);
    } else {
      // For server invoices, just use the fields directly
      form.reset(invoice.invoiceFields);
    }

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <InboxArrowDownIcon className="size-4" />
          <span className="hidden sm:inline">Import</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeaderContainer>
          <DialogIcon>
            <InboxArrowDownIcon className="size-5" />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Import Invoice</DialogTitle>
            <DialogDescription>Click on an invoice to import the data</DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogContentContainer className="overflow-y-auto flex-1">
          <DataTable
            isLoading={isLoading}
            data={data}
            columns={importInvoiceColumns}
            columnConfig={importInvoiceColumnConfig}
            defaultSorting={[{ id: "createdAt", desc: true }]}
            onRowClick={handleRowClick}
          />
        </DialogContentContainer>
      </DialogContent>
    </Dialog>
  );
};

export default ImportInvoice;
