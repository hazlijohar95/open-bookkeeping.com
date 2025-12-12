import { useParams, Navigate } from "react-router-dom";
import { CreateCreditNotePage } from "./create-credit-note";
import { getCreditNoteById } from "@/lib/indexdb-queries/credit-note";
import { useQuery } from "@tanstack/react-query";
import { useCreditNote } from "@/api/credit-notes";
import { Loader2Icon } from "@/components/ui/icons";
import type { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";

export function EditCreditNotePage() {
  const { type, id } = useParams<{ type: string; id: string }>();

  // Fetch from IndexedDB for local credit notes
  const localCreditNote = useQuery({
    queryKey: ["idb-credit-note", id],
    queryFn: () => getCreditNoteById(id!),
    enabled: type === "local" && !!id,
  });

  // Fetch from server for server credit notes
  const serverCreditNote = useCreditNote(id!, {
    enabled: type === "server" && !!id,
  });

  if (!type || !id) {
    return <Navigate to="/credit-notes" replace />;
  }

  // Loading state
  if (type === "local" && localCreditNote.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading credit note...</p>
        </div>
      </div>
    );
  }

  if (type === "server" && serverCreditNote.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading credit note...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (type === "local" && !localCreditNote.data) {
    return <Navigate to="/credit-notes" replace />;
  }

  if (type === "server" && !serverCreditNote.data) {
    return <Navigate to="/credit-notes" replace />;
  }

  // Transform the data to match the form schema
  let defaultCreditNote: ZodCreateCreditNoteSchema | undefined;

  if (type === "local" && localCreditNote.data) {
    defaultCreditNote = localCreditNote.data.creditNoteFields;
  }

  if (type === "server" && serverCreditNote.data?.creditNoteFields) {
    const fields = serverCreditNote.data.creditNoteFields;

    // Skip if required fields are missing
    if (!fields.companyDetails || !fields.clientDetails || !fields.creditNoteDetails) {
      return <Navigate to="/credit-notes" replace />;
    }

    // Get template from server or use default
    const serverTemplate = fields.creditNoteDetails.theme?.template;
    const mappedTemplate = serverTemplate ?? "default";

    defaultCreditNote = {
      companyDetails: {
        name: fields.companyDetails.name,
        address: fields.companyDetails.address,
        logo: fields.companyDetails.logo ?? undefined,
        signature: fields.companyDetails.signature ?? undefined,
        metadata: fields.companyDetails.metadata ?? [],
      },
      clientDetails: {
        name: fields.clientDetails.name,
        address: fields.clientDetails.address,
        metadata: fields.clientDetails.metadata ?? [],
      },
      creditNoteDetails: {
        theme: {
          baseColor: fields.creditNoteDetails.theme?.baseColor ?? "#2563EB",
          mode: (fields.creditNoteDetails.theme?.mode ?? "light") as "dark" | "light",
          template: mappedTemplate as "default" | "cynco" | "classic",
        },
        currency: fields.creditNoteDetails.currency,
        prefix: fields.creditNoteDetails.prefix,
        serialNumber: fields.creditNoteDetails.serialNumber,
        date: new Date(fields.creditNoteDetails.date),
        originalInvoiceNumber: fields.creditNoteDetails.originalInvoiceNumber ?? undefined,
        billingDetails: (fields.creditNoteDetails.billingDetails ?? []).map((bd) => ({
          label: bd.label,
          value: typeof bd.value === "string" ? parseFloat(bd.value) ?? 0 : bd.value,
          type: ("type" in bd ? bd.type : "fixed") as "fixed" | "percentage",
        })),
      },
      items: fields.items.map((item) => ({
        name: item.name,
        description: item.description ?? "",
        quantity: item.quantity,
        unitPrice: typeof item.unitPrice === "string" ? parseFloat(item.unitPrice) ?? 0 : item.unitPrice,
      })),
      metadata: {
        notes: fields.metadata?.notes ?? "",
        terms: fields.metadata?.terms ?? "",
      },
    };
  }

  return <CreateCreditNotePage defaultCreditNote={defaultCreditNote} />;
}

export default EditCreditNotePage;
