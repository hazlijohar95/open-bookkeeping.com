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
import { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";
import { forceInsertQuotation } from "@/lib/indexdb-queries/quotation";
import QuotationErrorsModal from "./quotation-errors-modal";
import QuotationTabSwitch from "./quotation-tab-switch";
import { Button } from "@/components/ui/button";
import { UseFormReturn } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers";
import { useCreateQuotation } from "@/api/quotations";
import { toast } from "sonner";
import { useState } from "react";
import { QuotationDownloadManagerInstance } from "@/global/instances/quotation/quotation-download-manager";

import { type QuotationTab } from "@/global/atoms/quotation-atom";

type QuotationOptionsAction = "view-pdf" | "download-pdf" | "download-png" | "save-local" | "save-server";

interface QuotationOptionsProps {
  form: UseFormReturn<ZodCreateQuotationSchema>;
  onTabChange?: (tab: QuotationTab) => void;
}

const QuotationOptions = ({ form, onTabChange }: QuotationOptionsProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Mutation for saving to server
  const createQuotationMutation = useCreateQuotation();

  const handleDropDownAction = async (action: QuotationOptionsAction) => {
    const formValues = form.getValues();

    switch (action) {
      case "view-pdf":
        await QuotationDownloadManagerInstance.initialize(formValues);
        QuotationDownloadManagerInstance.previewPdf();
        break;
      case "download-pdf":
        await QuotationDownloadManagerInstance.initialize(formValues);
        QuotationDownloadManagerInstance.downloadPdf();
        break;
      case "download-png":
        await QuotationDownloadManagerInstance.initialize(formValues);
        QuotationDownloadManagerInstance.downloadPng();
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

  const handleSaveLocal = async (formValues: ZodCreateQuotationSchema) => {
    setIsSaving(true);
    try {
      await forceInsertQuotation(formValues);
      queryClient.invalidateQueries({ queryKey: ["idb-quotations"] });
      toast.success("Quotation saved locally!");
    } catch (error) {
      toast.error("Failed to save quotation locally");
      console.error("[ERROR]: Failed to save quotation locally:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveServer = async (formValues: ZodCreateQuotationSchema) => {
    if (!user) {
      toast.error("Please log in to save to server");
      return;
    }
    setIsSaving(true);
    try {
      // Map template types: cynco/classic -> default for server storage
      const template = formValues.quotationDetails.theme?.template;
      const mappedTemplate = template === "cynco" || template === "classic" ? "default" : template;

      await createQuotationMutation.mutateAsync(
        {
          items: formValues.items,
          companyDetails: formValues.companyDetails,
          clientDetails: formValues.clientDetails,
          quotationDetails: {
            ...formValues.quotationDetails,
            theme: formValues.quotationDetails.theme
              ? { ...formValues.quotationDetails.theme, template: mappedTemplate }
              : undefined,
          },
          metadata: formValues.metadata,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["quotation"] });
            toast.success("Quotation saved to server successfully!");
          },
          onError: (error) => {
            toast.error(`Failed to save quotation: ${error.message}`);
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
        <QuotationErrorsModal />
      </div>
      <div className="flex flex-row items-center gap-2">
        <QuotationTabSwitch onTabChange={onTabChange} />

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

            {/* Save Options */}
            <DropdownMenuItem onClick={() => handleDropDownAction("save-local")}>
              <HardDriveIcon className="size-4" />
              <span>Save Locally</span>
            </DropdownMenuItem>
            {user && (
              <DropdownMenuItem onClick={() => handleDropDownAction("save-server")}>
                <DatabaseIcon className="size-4" />
                <span>Save to Server</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default QuotationOptions;
