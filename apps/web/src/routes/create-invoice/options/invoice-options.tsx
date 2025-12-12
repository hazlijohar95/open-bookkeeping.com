import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceDownloadManagerInstance } from "@/global/instances/invoice/invoice-download-manager";
import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { forceInsertInvoice } from "@/lib/indexdb-queries/invoice";
import InvoiceErrorsModal from "./invoice-errors-modal";
import InvoiceTabSwitch from "./invoice-tab-switch";
import ImportInvoice from "./import-invoice";
import { Button } from "@/components/ui/button";
import type { UseFormReturn } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers";
import { useCreateInvoice } from "@/api/invoices";
import { toast } from "sonner";
import { useState } from "react";
import {
  Download,
  Eye,
  Image,
  SaveIcon,
  Cloud,
  ChevronDownIcon,
  FileTextIcon,
  Sparkles,
  CheckCircle2Icon,
  Loader2Icon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

import { type InvoiceTab } from "@/global/atoms/invoice-atom";

type InvoiceOptionsAction = "view-pdf" | "download-pdf" | "download-png" | "save-local" | "save-server";

interface InvoiceOptionsProps {
  form: UseFormReturn<ZodCreateInvoiceSchema>;
  onTabChange?: (tab: InvoiceTab) => void;
}

const InvoiceOptions = ({ form, onTabChange }: InvoiceOptionsProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Mutation for saving to server
  const createInvoiceMutation = useCreateInvoice();

  const handleDropDownAction = async (action: InvoiceOptionsAction) => {
    const formValues = form.getValues();

    switch (action) {
      case "view-pdf":
        await InvoiceDownloadManagerInstance.initialize(formValues);
        void InvoiceDownloadManagerInstance.previewPdf();
        break;
      case "download-pdf":
        await InvoiceDownloadManagerInstance.initialize(formValues);
        void InvoiceDownloadManagerInstance.downloadPdf();
        setLastAction("downloaded");
        setTimeout(() => setLastAction(null), 2000);
        break;
      case "download-png":
        await InvoiceDownloadManagerInstance.initialize(formValues);
        void InvoiceDownloadManagerInstance.downloadPng();
        setLastAction("downloaded");
        setTimeout(() => setLastAction(null), 2000);
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

  const handleSaveLocal = async (formValues: ZodCreateInvoiceSchema) => {
    setIsSaving(true);
    try {
      await forceInsertInvoice(formValues);
      void queryClient.invalidateQueries({ queryKey: ["idb-invoices"] });
      toast.success("Invoice saved locally!");
      setLastAction("saved-local");
      setTimeout(() => setLastAction(null), 2000);
    } catch (error) {
      toast.error("Failed to save invoice locally");
      console.error("[ERROR]: Failed to save invoice locally:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveServer = async (formValues: ZodCreateInvoiceSchema) => {
    if (!user) {
      toast.error("Please log in to save to server");
      return;
    }
    setIsSaving(true);
    try {
      // Map template types: cynco/classic -> default for server storage
      const template = formValues.invoiceDetails.theme?.template;
      const mappedTemplate = template === "cynco" || template === "classic" ? "default" : template;

      await createInvoiceMutation.mutateAsync(
        {
          customerId: formValues.customerId,
          items: formValues.items,
          companyDetails: formValues.companyDetails,
          clientDetails: formValues.clientDetails,
          invoiceDetails: {
            ...formValues.invoiceDetails,
            theme: formValues.invoiceDetails.theme
              ? { ...formValues.invoiceDetails.theme, template: mappedTemplate }
              : undefined,
          },
          metadata: formValues.metadata,
        },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["invoice"] });
            toast.success("Invoice saved to server successfully!");
            setLastAction("saved-server");
            setTimeout(() => setLastAction(null), 2000);
          },
          onError: (error) => {
            toast.error(`Failed to save invoice: ${error.message}`);
          },
        }
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-14 shrink-0 flex-row items-center justify-between gap-3 border-b bg-gradient-to-r from-background via-background to-muted/30 px-4">
      {/* Left Side - Errors & Import */}
      <div className="flex flex-row items-center gap-2">
        <InvoiceErrorsModal />
        <ImportInvoice form={form} />
      </div>

      {/* Right Side - View Toggle & Actions */}
      <div className="flex flex-row items-center gap-3">
        <InvoiceTabSwitch onTabChange={onTabChange} />

        {/* Quick Actions */}
        <div className="flex items-center gap-1.5">
          {/* Preview Button */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => handleDropDownAction("view-pdf")}
          >
            <Eye className="size-4" />
            <span className="hidden sm:inline">Preview</span>
          </Button>

          {/* Download Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5 text-muted-foreground hover:text-foreground transition-all",
                  lastAction === "downloaded" && "text-success"
                )}
              >
                {lastAction === "downloaded" ? (
                  <CheckCircle2Icon className="size-4 text-success" />
                ) : (
                  <Download className="size-4" />
                )}
                <span className="hidden sm:inline">Download</span>
                <ChevronDownIcon className="size-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleDropDownAction("download-pdf")}>
                <FileTextIcon className="size-4 text-destructive" />
                <span>Download PDF</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDropDownAction("download-png")}>
                <Image className="size-4 text-info" />
                <span>Download PNG</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-border" />

        {/* SaveIcon Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className={cn(
                "gap-2 min-w-[120px] transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30",
                lastAction === "saved-local" && "bg-success hover:bg-success/90",
                lastAction === "saved-server" && "bg-success hover:bg-success/90"
              )}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : lastAction === "saved-local" || lastAction === "saved-server" ? (
                <>
                  <CheckCircle2Icon className="size-4" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>SaveIcon Invoice</span>
                  <ChevronDownIcon className="size-3 opacity-70" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => handleDropDownAction("save-local")}
              className="gap-3 py-2.5"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-warning/10">
                <SaveIcon className="size-4 text-warning" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">SaveIcon Locally</span>
                <span className="text-xs text-muted-foreground">Store in browser</span>
              </div>
            </DropdownMenuItem>
            {user && (
              <DropdownMenuItem
                onClick={() => handleDropDownAction("save-server")}
                className="gap-3 py-2.5"
              >
                <div className="flex size-8 items-center justify-center rounded-lg bg-info/10">
                  <Cloud className="size-4 text-info" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium">SaveIcon to Cloud</span>
                  <span className="text-xs text-muted-foreground">Sync across devices</span>
                </div>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default InvoiceOptions;
