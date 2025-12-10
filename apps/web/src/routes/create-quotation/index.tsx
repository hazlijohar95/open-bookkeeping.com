import {
  createQuotationSchema,
  createQuotationSchemaDefaultValues,
  type ZodCreateQuotationSchema,
} from "@/zod-schemas/quotation/create-quotation";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { quotationTabAtom, type QuotationTab } from "@/global/atoms/quotation-atom";
import { zodResolver } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCallback, useRef } from "react";
import { PdfWorkerProvider } from "@/providers";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import QuotationOptions from "./options/quotation-options";
import QuotationPreview from "./quotation-preview";
import QuotationForm from "./quotation-form";

interface QuotationPageProps {
  defaultQuotation?: ZodCreateQuotationSchema;
}

export function CreateQuotationPage({ defaultQuotation }: QuotationPageProps) {
  const quotationFormPanelRef = useRef<ImperativePanelHandle>(null);
  const quotationPreviewPanelRef = useRef<ImperativePanelHandle>(null);
  const [quotationTab, setQuotationTab] = useAtom(quotationTabAtom);
  const isMobile = useIsMobile();

  // Form
  const form = useForm<ZodCreateQuotationSchema>({
    resolver: zodResolver(createQuotationSchema),
    defaultValues: defaultQuotation || createQuotationSchemaDefaultValues,
  });

  // Handle tab change and panel resize in the same event handler
  const handleTabChange = useCallback(
    (newTab: QuotationTab) => {
      const quotationPanel = quotationFormPanelRef.current;
      const quotationPreviewPanel = quotationPreviewPanelRef.current;

      const effectiveTab = isMobile && newTab === "both" ? "form" : newTab;
      setQuotationTab(effectiveTab);

      if (!quotationPanel || !quotationPreviewPanel) return;

      switch (effectiveTab) {
        case "form":
          if (quotationPanel.isCollapsed()) quotationPanel.expand();
          quotationPreviewPanel.collapse();
          quotationPanel.resize(100);
          break;
        case "preview":
          if (quotationPreviewPanel.isCollapsed()) quotationPreviewPanel.expand();
          quotationPanel.collapse();
          quotationPreviewPanel.resize(100);
          break;
        case "both":
          if (quotationPanel.isCollapsed()) quotationPanel.expand();
          if (quotationPreviewPanel.isCollapsed()) quotationPreviewPanel.expand();
          quotationPanel.resize(50);
          quotationPreviewPanel.resize(50);
          break;
      }
    },
    [isMobile, setQuotationTab]
  );

  return (
    <div className="flex h-full flex-col">
      <QuotationOptions form={form} onTabChange={handleTabChange} />
      <ResizablePanelGroup direction="horizontal" className="divide-x">
        <ResizablePanel collapsible={true} defaultSize={50} ref={quotationFormPanelRef}>
          <QuotationForm form={form} />
        </ResizablePanel>
        <ResizablePanel
          className={cn(quotationTab === "both" ? "hidden md:flex" : "flex")}
          collapsible={true}
          defaultSize={50}
          ref={quotationPreviewPanelRef}
        >
          <PdfWorkerProvider>
            <QuotationPreview form={form} />
          </PdfWorkerProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default CreateQuotationPage;
