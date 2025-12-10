import {
  createCreditNoteSchema,
  createCreditNoteSchemaDefaultValues,
  type ZodCreateCreditNoteSchema,
} from "@/zod-schemas/credit-note/create-credit-note";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ImperativePanelHandle } from "react-resizable-panels";
import { creditNoteTabAtom, type CreditNoteTab } from "@/global/atoms/credit-note-atom";
import { zodResolver } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCallback, useRef } from "react";
import { PdfWorkerProvider } from "@/providers";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import CreditNoteOptions from "./options/credit-note-options";
import CreditNotePreview from "./credit-note-preview";
import CreditNoteForm from "./credit-note-form";

interface CreditNotePageProps {
  defaultCreditNote?: ZodCreateCreditNoteSchema;
}

export function CreateCreditNotePage({ defaultCreditNote }: CreditNotePageProps) {
  const creditNoteFormPanelRef = useRef<ImperativePanelHandle>(null);
  const creditNotePreviewPanelRef = useRef<ImperativePanelHandle>(null);
  const [creditNoteTab, setCreditNoteTab] = useAtom(creditNoteTabAtom);
  const isMobile = useIsMobile();

  // Form
  const form = useForm<ZodCreateCreditNoteSchema>({
    resolver: zodResolver(createCreditNoteSchema),
    defaultValues: defaultCreditNote || createCreditNoteSchemaDefaultValues,
  });

  // Handle tab change and panel resize in the same event handler
  const handleTabChange = useCallback(
    (newTab: CreditNoteTab) => {
      const creditNotePanel = creditNoteFormPanelRef.current;
      const creditNotePreviewPanel = creditNotePreviewPanelRef.current;

      const effectiveTab = isMobile && newTab === "both" ? "form" : newTab;
      setCreditNoteTab(effectiveTab);

      if (!creditNotePanel || !creditNotePreviewPanel) return;

      switch (effectiveTab) {
        case "form":
          if (creditNotePanel.isCollapsed()) creditNotePanel.expand();
          creditNotePreviewPanel.collapse();
          creditNotePanel.resize(100);
          break;
        case "preview":
          if (creditNotePreviewPanel.isCollapsed()) creditNotePreviewPanel.expand();
          creditNotePanel.collapse();
          creditNotePreviewPanel.resize(100);
          break;
        case "both":
          if (creditNotePanel.isCollapsed()) creditNotePanel.expand();
          if (creditNotePreviewPanel.isCollapsed()) creditNotePreviewPanel.expand();
          creditNotePanel.resize(50);
          creditNotePreviewPanel.resize(50);
          break;
      }
    },
    [isMobile, setCreditNoteTab]
  );

  return (
    <div className="flex h-full flex-col">
      <CreditNoteOptions form={form} onTabChange={handleTabChange} />
      <ResizablePanelGroup direction="horizontal" className="divide-x">
        <ResizablePanel collapsible={true} defaultSize={50} ref={creditNoteFormPanelRef}>
          <CreditNoteForm form={form} />
        </ResizablePanel>
        <ResizablePanel
          className={cn(creditNoteTab === "both" ? "hidden md:flex" : "flex")}
          collapsible={true}
          defaultSize={50}
          ref={creditNotePreviewPanelRef}
        >
          <PdfWorkerProvider>
            <CreditNotePreview form={form} />
          </PdfWorkerProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default CreateCreditNotePage;
