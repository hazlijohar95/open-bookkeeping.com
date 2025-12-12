import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SlidersIcon,
  EyeScannerIcon,
  FileDownloadIcon,
  ImageSparkleIcon,
  HardDriveIcon,
  DatabaseIcon,
} from "@/assets/icons";
import type { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";
import { forceInsertCreditNote } from "@/lib/indexdb-queries/credit-note";
import CreditNoteErrorsModal from "./credit-note-errors-modal";
import CreditNoteTabSwitch from "./credit-note-tab-switch";
import { Button } from "@/components/ui/button";
import type { UseFormReturn } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers";
import { useCreateCreditNote } from "@/api/credit-notes";
import { toast } from "sonner";
import { useState } from "react";
import { CreditNoteDownloadManagerInstance } from "@/global/instances/credit-note/credit-note-download-manager";

import { type CreditNoteTab } from "@/global/atoms/credit-note-atom";

type CreditNoteOptionsAction = "view-pdf" | "download-pdf" | "download-png" | "save-local" | "save-server";

interface CreditNoteOptionsProps {
  form: UseFormReturn<ZodCreateCreditNoteSchema>;
  onTabChange?: (tab: CreditNoteTab) => void;
}

const CreditNoteOptions = ({ form, onTabChange }: CreditNoteOptionsProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // API mutation for saving to server
  const createCreditNoteMutation = useCreateCreditNote();

  const handleDropDownAction = async (action: CreditNoteOptionsAction) => {
    const formValues = form.getValues();

    switch (action) {
      case "view-pdf":
        await CreditNoteDownloadManagerInstance.initialize(formValues);
        void CreditNoteDownloadManagerInstance.previewPdf();
        break;
      case "download-pdf":
        await CreditNoteDownloadManagerInstance.initialize(formValues);
        void CreditNoteDownloadManagerInstance.downloadPdf();
        break;
      case "download-png":
        await CreditNoteDownloadManagerInstance.initialize(formValues);
        void CreditNoteDownloadManagerInstance.downloadPng();
        break;
      case "save-local":
        await handleSaveLocal(formValues);
        break;
      case "save-server":
        await handleSaveServer(formValues);
        break;
      default:
        break;
    }
  };

  const handleSaveLocal = async (formValues: ZodCreateCreditNoteSchema) => {
    setIsSaving(true);
    try {
      await forceInsertCreditNote(formValues);
      void queryClient.invalidateQueries({ queryKey: ["idb-credit-notes"] });
      toast.success("Credit Note saved locally!");
    } catch (error) {
      toast.error("Failed to save credit note locally");
      console.error("[ERROR]: Failed to save credit note locally:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveServer = async (formValues: ZodCreateCreditNoteSchema) => {
    if (!user) {
      toast.error("Please log in to save to server");
      return;
    }
    setIsSaving(true);
    try {
      // Map template types: cynco/classic -> default for server storage
      const template = formValues.creditNoteDetails.theme?.template;
      const mappedTemplate = template === "cynco" || template === "classic" ? "default" : template;

      await createCreditNoteMutation.mutateAsync(
        {
          reason: "other" as const, // Default reason for credit note
          items: formValues.items,
          companyDetails: formValues.companyDetails,
          clientDetails: formValues.clientDetails,
          creditNoteDetails: {
            ...formValues.creditNoteDetails,
            theme: formValues.creditNoteDetails.theme
              ? { ...formValues.creditNoteDetails.theme, template: mappedTemplate }
              : undefined,
          },
          metadata: formValues.metadata,
        },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["creditNote"] });
            toast.success("Credit Note saved to server successfully!");
          },
          onError: (error) => {
            toast.error(`Failed to save credit note: ${error.message}`);
          },
        }
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-12 shrink-0 flex-row items-center justify-between gap-2 border-b px-2">
      <div className="flex flex-row items-center gap-2">
        <CreditNoteErrorsModal />
      </div>
      <div className="flex flex-row items-center gap-2">
        <CreditNoteTabSwitch onTabChange={onTabChange} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="default" className="gap-2" disabled={isSaving}>
              {isSaving ? (
                <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <SlidersIcon className="size-4" />
              )}
              <span className="hidden sm:inline">{isSaving ? "Saving..." : "Actions"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* View/Download Options */}
            <DropdownMenuItem onClick={() => handleDropDownAction("view-pdf")}>
              <EyeScannerIcon className="size-4" />
              <span>View PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDropDownAction("download-pdf")}>
              <FileDownloadIcon className="size-4" />
              <span>Download PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDropDownAction("download-png")}>
              <ImageSparkleIcon className="size-4" />
              <span>Download PNG</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* SaveIcon Options */}
            <DropdownMenuItem onClick={() => handleDropDownAction("save-local")}>
              <HardDriveIcon className="size-4" />
              <span>SaveIcon Locally</span>
            </DropdownMenuItem>
            {user && (
              <DropdownMenuItem onClick={() => handleDropDownAction("save-server")}>
                <DatabaseIcon className="size-4" />
                <span>SaveIcon to Server</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default CreditNoteOptions;
