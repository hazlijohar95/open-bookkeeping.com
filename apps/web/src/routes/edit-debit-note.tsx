import { useParams, Navigate } from "react-router-dom";
import { CreateDebitNotePage } from "./create-debit-note";
import { getDebitNoteById } from "@/lib/indexdb-queries/debit-note";
import { useQuery } from "@tanstack/react-query";
import { useDebitNote } from "@/api/debit-notes";
import { Loader2 } from "@/components/ui/icons";
import { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";

export function EditDebitNotePage() {
  const { type, id } = useParams<{ type: string; id: string }>();

  // Fetch from IndexedDB for local debit notes
  const localDebitNote = useQuery({
    queryKey: ["idb-debit-note", id],
    queryFn: () => getDebitNoteById(id!),
    enabled: type === "local" && !!id,
  });

  // Fetch from server for server debit notes
  const serverDebitNote = useDebitNote(id!, {
    enabled: type === "server" && !!id,
  });

  if (!type || !id) {
    return <Navigate to="/debit-notes" replace />;
  }

  // Loading state
  if (type === "local" && localDebitNote.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading debit note...</p>
        </div>
      </div>
    );
  }

  if (type === "server" && serverDebitNote.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading debit note...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (type === "local" && !localDebitNote.data) {
    return <Navigate to="/debit-notes" replace />;
  }

  if (type === "server" && !serverDebitNote.data) {
    return <Navigate to="/debit-notes" replace />;
  }

  // Transform the data to match the form schema
  let defaultDebitNote: ZodCreateDebitNoteSchema | undefined;

  if (type === "local" && localDebitNote.data) {
    defaultDebitNote = localDebitNote.data.debitNoteFields;
  }

  if (type === "server" && serverDebitNote.data?.debitNoteFields) {
    const fields = serverDebitNote.data.debitNoteFields;

    // Skip if required fields are missing
    if (!fields.companyDetails || !fields.clientDetails || !fields.debitNoteDetails) {
      return <Navigate to="/debit-notes" replace />;
    }

    // Get template from server or use default
    const serverTemplate = fields.debitNoteDetails.theme?.template;
    const mappedTemplate = serverTemplate ?? "default";

    defaultDebitNote = {
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
      debitNoteDetails: {
        theme: {
          baseColor: fields.debitNoteDetails.theme?.baseColor ?? "#2563EB",
          mode: (fields.debitNoteDetails.theme?.mode ?? "light") as "dark" | "light",
          template: mappedTemplate as "default" | "cynco" | "classic",
        },
        currency: fields.debitNoteDetails.currency,
        prefix: fields.debitNoteDetails.prefix,
        serialNumber: fields.debitNoteDetails.serialNumber,
        date: new Date(fields.debitNoteDetails.date),
        originalInvoiceNumber: fields.debitNoteDetails.originalInvoiceNumber ?? undefined,
        billingDetails: (fields.debitNoteDetails.billingDetails ?? []).map((bd) => ({
          label: bd.label,
          value: typeof bd.value === "string" ? parseFloat(bd.value) || 0 : bd.value,
          type: ("type" in bd ? bd.type : "fixed") as "fixed" | "percentage",
        })),
      },
      items: fields.items.map((item) => ({
        name: item.name,
        description: item.description ?? "",
        quantity: item.quantity,
        unitPrice: typeof item.unitPrice === "string" ? parseFloat(item.unitPrice) || 0 : item.unitPrice,
      })),
      metadata: {
        notes: fields.metadata?.notes ?? "",
        terms: fields.metadata?.terms ?? "",
      },
    };
  }

  return <CreateDebitNotePage defaultDebitNote={defaultDebitNote} />;
}

export default EditDebitNotePage;
