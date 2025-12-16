import {
  createInvoiceSchema,
  createInvoiceSchemaDefaultValues,
  type ZodCreateInvoiceSchema,
} from "@/zod-schemas/invoice/create-invoice";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { invoiceTabAtom, type InvoiceTab } from "@/global/atoms/invoice-atom";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { zodResolver } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCallback, useRef } from "react";
import { PdfWorkerProvider } from "@/providers";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import InvoiceOptions from "./options/invoice-options";
import InvoicePreview from "./invoice-preview";
import InvoiceForm from "./invoice-form";

interface InvoicePageProps {
  defaultInvoice?: ZodCreateInvoiceSchema;
}

export function CreateInvoicePage({ defaultInvoice }: InvoicePageProps) {
  const invoiceFormPanelRef = useRef<ImperativePanelHandle>(null);
  const invoicePreviewPanelRef = useRef<ImperativePanelHandle>(null);
  const [invoiceTab, setInvoiceTab] = useAtom(invoiceTabAtom);
  const isMobile = useIsMobile();

  // Form
  const form = useForm<ZodCreateInvoiceSchema>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: defaultInvoice || createInvoiceSchemaDefaultValues,
  });

  // Warn user about unsaved changes before leaving
  useUnsavedChanges(form.formState.isDirty);

  // Handle tab change and panel resize in the same event handler
  // This avoids the useEffect anti-pattern of "reacting to state changes"
  const handleTabChange = useCallback(
    (newTab: InvoiceTab) => {
      const invoicePanel = invoiceFormPanelRef.current;
      const invoicePreviewPanel = invoicePreviewPanelRef.current;

      // If mobile and trying to set "both", default to "form"
      const effectiveTab = isMobile && newTab === "both" ? "form" : newTab;

      // Update the atom
      setInvoiceTab(effectiveTab);

      // Resize panels - do this after state update in the same handler
      if (!invoicePanel || !invoicePreviewPanel) return;

      switch (effectiveTab) {
        case "form":
          if (invoicePanel.isCollapsed()) {
            invoicePanel.expand();
          }
          invoicePreviewPanel.collapse();
          invoicePanel.resize(100);
          break;
        case "preview":
          if (invoicePreviewPanel.isCollapsed()) {
            invoicePreviewPanel.expand();
          }
          invoicePanel.collapse();
          invoicePreviewPanel.resize(100);
          break;
        case "both":
          if (invoicePanel.isCollapsed()) {
            invoicePanel.expand();
          }
          if (invoicePreviewPanel.isCollapsed()) {
            invoicePreviewPanel.expand();
          }
          invoicePanel.resize(50);
          invoicePreviewPanel.resize(50);
          break;
      }
    },
    [isMobile, setInvoiceTab]
  );

  return (
    <div className="flex h-full flex-col">
      <InvoiceOptions form={form} onTabChange={handleTabChange} />
      <ResizablePanelGroup direction="horizontal" className="divide-x">
        <ResizablePanel
          collapsible={true}
          defaultSize={50}
          ref={invoiceFormPanelRef}
        >
          <InvoiceForm form={form} />
        </ResizablePanel>
        <ResizablePanel
          className={cn(invoiceTab === "both" ? "hidden md:flex" : "flex")}
          collapsible={true}
          defaultSize={50}
          ref={invoicePreviewPanelRef}
        >
          <PdfWorkerProvider>
            <InvoicePreview form={form} />
          </PdfWorkerProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default CreateInvoicePage;
