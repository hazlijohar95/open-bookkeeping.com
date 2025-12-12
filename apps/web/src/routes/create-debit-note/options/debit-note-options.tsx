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
import type { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";
import { forceInsertDebitNote } from "@/lib/indexdb-queries/debit-note";
import DebitNoteErrorsModal from "./debit-note-errors-modal";
import DebitNoteTabSwitch from "./debit-note-tab-switch";
import { Button } from "@/components/ui/button";
import type { UseFormReturn } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers";
import { useCreateDebitNote } from "@/api/debit-notes";
import { toast } from "sonner";
import { useState } from "react";
import { DebitNoteDownloadManagerInstance } from "@/global/instances/debit-note/debit-note-download-manager";

import { type DebitNoteTab } from "@/global/atoms/debit-note-atom";

type DebitNoteOptionsAction = "view-pdf" | "download-pdf" | "download-png" | "save-local" | "save-server";

interface DebitNoteOptionsProps {
  form: UseFormReturn<ZodCreateDebitNoteSchema>;
  onTabChange?: (tab: DebitNoteTab) => void;
}

const DebitNoteOptions = ({ form, onTabChange }: DebitNoteOptionsProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // API mutation for saving to server
  const createDebitNoteMutation = useCreateDebitNote();

  const handleDropDownAction = async (action: DebitNoteOptionsAction) => {
    const formValues = form.getValues();

    switch (action) {
      case "view-pdf":
        await DebitNoteDownloadManagerInstance.initialize(formValues);
        void DebitNoteDownloadManagerInstance.previewPdf();
        break;
      case "download-pdf":
        await DebitNoteDownloadManagerInstance.initialize(formValues);
        void DebitNoteDownloadManagerInstance.downloadPdf();
        break;
      case "download-png":
        await DebitNoteDownloadManagerInstance.initialize(formValues);
        void DebitNoteDownloadManagerInstance.downloadPng();
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

  const handleSaveLocal = async (formValues: ZodCreateDebitNoteSchema) => {
    setIsSaving(true);
    try {
      await forceInsertDebitNote(formValues);
      void queryClient.invalidateQueries({ queryKey: ["idb-debit-notes"] });
      toast.success("Debit Note saved locally!");
    } catch (error) {
      toast.error("Failed to save debit note locally");
      console.error("[ERROR]: Failed to save debit note locally:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveServer = async (formValues: ZodCreateDebitNoteSchema) => {
    if (!user) {
      toast.error("Please log in to save to server");
      return;
    }
    setIsSaving(true);
    try {
      // Map template types: cynco/classic -> default for server storage
      const template = formValues.debitNoteDetails.theme?.template;
      const mappedTemplate = template === "cynco" || template === "classic" ? "default" : template;

      await createDebitNoteMutation.mutateAsync(
        {
          reason: "other" as const, // Default reason for debit note
          items: formValues.items,
          companyDetails: formValues.companyDetails,
          clientDetails: formValues.clientDetails,
          debitNoteDetails: {
            ...formValues.debitNoteDetails,
            theme: formValues.debitNoteDetails.theme
              ? { ...formValues.debitNoteDetails.theme, template: mappedTemplate }
              : undefined,
          },
          metadata: formValues.metadata,
        },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["debitNote"] });
            toast.success("Debit Note saved to server successfully!");
          },
          onError: (error) => {
            toast.error(`Failed to save debit note: ${error.message}`);
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
        <DebitNoteErrorsModal />
      </div>
      <div className="flex flex-row items-center gap-2">
        <DebitNoteTabSwitch onTabChange={onTabChange} />

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

export default DebitNoteOptions;
