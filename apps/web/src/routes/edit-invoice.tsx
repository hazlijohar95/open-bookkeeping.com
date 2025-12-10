import { useParams, Navigate } from "react-router-dom";
import { CreateInvoicePage } from "./create-invoice";
import { getInvoiceById } from "@/lib/indexdb-queries/invoice";
import { useQuery } from "@tanstack/react-query";
import { useInvoice } from "@/api/invoices";
import { Loader2 } from "@/components/ui/icons";
import { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";

export function EditInvoice() {
  const { type, id } = useParams<{ type: string; id: string }>();

  // Fetch from IndexedDB for local invoices
  const localInvoice = useQuery({
    queryKey: ["idb-invoice", id],
    queryFn: () => getInvoiceById(id!),
    enabled: type === "local" && !!id,
  });

  // Fetch from server for server invoices
  const serverInvoice = useInvoice(id!, {
    enabled: type === "server" && !!id,
  });

  if (!type || !id) {
    return <Navigate to="/invoices" replace />;
  }

  // Loading state
  if (type === "local" && localInvoice.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (type === "server" && serverInvoice.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (type === "local" && !localInvoice.data) {
    return <Navigate to="/invoices" replace />;
  }

  if (type === "server" && !serverInvoice.data) {
    return <Navigate to="/invoices" replace />;
  }

  // Transform the data to match the form schema
  let defaultInvoice: ZodCreateInvoiceSchema | undefined;

  if (type === "local" && localInvoice.data) {
    defaultInvoice = localInvoice.data.invoiceFields;
  }

  if (type === "server" && serverInvoice.data?.invoiceFields) {
    const fields = serverInvoice.data.invoiceFields;

    // Skip if required fields are missing
    if (!fields.companyDetails || !fields.clientDetails || !fields.invoiceDetails) {
      return <Navigate to="/invoices" replace />;
    }

    // Get template from server or use default
    const serverTemplate = fields.invoiceDetails.theme?.template;
    const mappedTemplate = serverTemplate ?? "default";

    defaultInvoice = {
      customerId: serverInvoice.data.customerId ?? undefined,
      companyDetails: {
        name: fields.companyDetails.name,
        address: fields.companyDetails.address,
        logo: fields.companyDetails.logo ?? undefined,
        signature: fields.companyDetails.signature ?? undefined,
        metadata: fields.companyDetails.metadata?.map((m: { label: string; value: string }) => ({
          label: m.label,
          value: m.value,
        })) ?? [],
      },
      clientDetails: {
        name: fields.clientDetails.name,
        address: fields.clientDetails.address,
        metadata: fields.clientDetails.metadata?.map((m: { label: string; value: string }) => ({
          label: m.label,
          value: m.value,
        })) ?? [],
      },
      invoiceDetails: {
        theme: {
          baseColor: fields.invoiceDetails.theme?.baseColor ?? "#2563EB",
          mode: (fields.invoiceDetails.theme?.mode as "dark" | "light") ?? "light",
          template: mappedTemplate as "default" | "cynco" | "classic",
        },
        currency: fields.invoiceDetails.currency,
        prefix: fields.invoiceDetails.prefix,
        serialNumber: fields.invoiceDetails.serialNumber,
        poNumber: fields.invoiceDetails.poNumber ?? undefined,
        referenceNumber: fields.invoiceDetails.referenceNumber ?? undefined,
        date: new Date(fields.invoiceDetails.date),
        dueDate: fields.invoiceDetails.dueDate ? new Date(fields.invoiceDetails.dueDate) : undefined,
        paymentTerms: fields.invoiceDetails.paymentTerms ?? "",
        billingDetails: (fields.invoiceDetails.billingDetails ?? []).map((bd: { label: string; value: string | number; type: string; isSstTax?: boolean; sstTaxType?: string; sstRateCode?: string }) => ({
          label: bd.label,
          value: typeof bd.value === "string" ? parseFloat(bd.value) || 0 : bd.value,
          type: (bd.type as "fixed" | "percentage") ?? "fixed",
          isSstTax: bd.isSstTax,
          sstTaxType: bd.sstTaxType as "sales_tax" | "service_tax" | undefined,
          sstRateCode: bd.sstRateCode,
        })),
      },
      items: fields.items.map((item: { name: string; description?: string; quantity: number; unitPrice: number | string }) => ({
        name: item.name,
        description: item.description ?? "",
        quantity: item.quantity,
        unitPrice: typeof item.unitPrice === "string" ? parseFloat(item.unitPrice) || 0 : item.unitPrice,
      })),
      metadata: {
        notes: fields.metadata?.notes ?? "",
        terms: fields.metadata?.terms ?? "",
        paymentInformation: fields.metadata?.paymentInformation?.map((p: { label: string; value: string }) => ({
          label: p.label,
          value: p.value,
        })) ?? [],
      },
    };
  }

  return <CreateInvoicePage defaultInvoice={defaultInvoice} />;
}

export default EditInvoice;
