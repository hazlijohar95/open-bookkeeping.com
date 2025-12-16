import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { Button } from "@/components/ui/button";
import type { UseFormReturn } from "react-hook-form";
import * as React from "react";

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
import {
  importInvoiceColumnConfig,
  importInvoiceColumns,
} from "@/components/table-columns/invoices";
import { getAllInvoices } from "@/lib/indexdb-queries/invoice";
import { DataTable } from "@/components/ui/data-table";
import type { Invoice } from "@/types/common/invoice";
import { toInvoices } from "@/types/common/invoice";
import type { IDBInvoice, IDBInvoiceLegacy } from "@/types/indexdb/invoice";
import { isLegacyInvoice } from "@/types/indexdb/invoice";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers";
import { useInvoices } from "@/api/invoices";
import { InboxArrowDownIcon } from "@/assets/icons";

// Union type for import dialog - can be server Invoice or local IDBInvoice (V2 or legacy)
type ImportableInvoice = Invoice | IDBInvoice | IDBInvoiceLegacy;

const ImportInvoice = ({
  form,
}: {
  form: UseFormReturn<ZodCreateInvoiceSchema>;
}) => {
  const [open, setOpen] = React.useState(false);
  const [pendingImport, setPendingImport] =
    React.useState<ImportableInvoice | null>(null);
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
  const serverInvoices = toInvoices(
    serverData.data as Parameters<typeof toInvoices>[0]
  );
  const data: ImportableInvoice[] = [
    ...serverInvoices,
    ...(idbData.data ?? []),
  ];

  // Convert V2 IDBInvoice to form schema
  const convertV2ToFormSchema = React.useCallback(
    (inv: IDBInvoice): ZodCreateInvoiceSchema => {
      return {
        customerId: undefined,
        companyDetails: {
          name: inv.companyDetails.name,
          address: inv.companyDetails.address,
          logo: inv.companyDetails.logo ?? undefined,
          signature: inv.companyDetails.signature ?? undefined,
          metadata: inv.companyDetails.metadata ?? [],
        },
        clientDetails: {
          name: inv.clientDetails.name,
          address: inv.clientDetails.address,
          metadata: inv.clientDetails.metadata ?? [],
        },
        invoiceDetails: {
          theme: inv.theme ?? {
            baseColor: "#2563EB",
            mode: "light",
            template: "default",
          },
          currency: inv.currency,
          prefix: inv.prefix,
          serialNumber: inv.serialNumber,
          poNumber: undefined,
          referenceNumber: undefined,
          date: new Date(inv.invoiceDate),
          dueDate: inv.dueDate ? new Date(inv.dueDate) : undefined,
          paymentTerms: inv.paymentTerms ?? "",
          billingDetails: inv.billingDetails.map((bd) => ({
            label: bd.label,
            value: parseFloat(bd.value) || 0,
            type: bd.type,
            isSstTax: bd.isSstTax,
            sstTaxType: bd.sstTaxType,
            sstRateCode: bd.sstRateCode,
          })),
        },
        items: inv.items.map((item) => ({
          name: item.name,
          description: item.description ?? "",
          quantity: parseFloat(item.quantity) || 0,
          unitPrice: parseFloat(item.unitPrice) || 0,
        })),
        metadata: {
          notes: inv.metadata?.notes ?? "",
          terms: inv.metadata?.terms ?? "",
          paymentInformation: inv.metadata?.paymentInformation ?? [],
        },
      };
    },
    []
  );

  // Check if invoice is a V1 format (has invoiceFields property)
  const isV1Invoice = (inv: ImportableInvoice): inv is Invoice => {
    return "invoiceFields" in inv;
  };

  // Actually perform the import
  const performImport = React.useCallback(
    (invoice: ImportableInvoice) => {
      // Default metadata if none exists
      const defaultMetadata = { notes: "", terms: "", paymentInformation: [] };

      if (invoice.type === "local") {
        // Check if it's legacy format (IDBInvoiceLegacy) or V2 format (IDBInvoice)
        if (isLegacyInvoice(invoice as unknown as IDBInvoiceLegacy)) {
          // Legacy local invoice with invoiceFields
          const legacyInvoice = invoice as unknown as IDBInvoiceLegacy;
          const invoiceFields = { ...legacyInvoice.invoiceFields };
          const imageBase64 = invoiceFields.companyDetails.logoBase64;
          const sigBase64 = invoiceFields.companyDetails.signatureBase64;

          // If logo is not a remote URL, use the base64 version
          if (
            invoiceFields.companyDetails.logo &&
            !invoiceFields.companyDetails.logo.startsWith("https://")
          ) {
            invoiceFields.companyDetails.logo = imageBase64 ?? "";
          }
          // If signature is not a remote URL, use the base64 version
          if (
            invoiceFields.companyDetails.signature &&
            !invoiceFields.companyDetails.signature.startsWith("https://")
          ) {
            invoiceFields.companyDetails.signature = sigBase64 ?? "";
          }

          form.reset({
            ...invoiceFields,
            metadata: invoiceFields.metadata ?? defaultMetadata,
          });
        } else {
          // V2 local invoice (IDBInvoice) - convert to form schema
          const formData = convertV2ToFormSchema(invoice as IDBInvoice);
          form.reset({
            ...formData,
            metadata: formData.metadata ?? defaultMetadata,
          });
        }
      } else {
        // Server invoice (V1 format with invoiceFields)
        if (isV1Invoice(invoice)) {
          form.reset({
            ...invoice.invoiceFields,
            metadata: invoice.invoiceFields.metadata ?? defaultMetadata,
          });
        }
      }

      setOpen(false);
      setPendingImport(null);
    },
    [form, convertV2ToFormSchema]
  );

  // Handle row click - check for unsaved changes first
  const handleRowClick = (invoice: ImportableInvoice) => {
    if (form.formState.isDirty) {
      // Form has unsaved changes, show confirmation dialog
      setPendingImport(invoice);
    } else {
      // No unsaved changes, import directly
      performImport(invoice);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <InboxArrowDownIcon className="size-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[80vh] max-w-4xl flex-col overflow-hidden">
          <DialogHeaderContainer>
            <DialogIcon>
              <InboxArrowDownIcon className="size-5" />
            </DialogIcon>
            <DialogHeader>
              <DialogTitle>Import Invoice</DialogTitle>
              <DialogDescription>
                Click on an invoice to import the data
              </DialogDescription>
            </DialogHeader>
          </DialogHeaderContainer>
          <DialogContentContainer className="flex-1 overflow-y-auto">
            <DataTable
              isLoading={isLoading}
              data={data as unknown as Invoice[]}
              columns={importInvoiceColumns}
              columnConfig={importInvoiceColumnConfig}
              defaultSorting={[{ id: "createdAt", desc: true }]}
              onRowClick={handleRowClick as (row: Invoice) => void}
            />
          </DialogContentContainer>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for unsaved changes */}
      <AlertDialog
        open={!!pendingImport}
        onOpenChange={(isOpen) => !isOpen && setPendingImport(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Importing this invoice will replace your
              current work. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingImport) {
                  performImport(pendingImport);
                }
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ImportInvoice;
