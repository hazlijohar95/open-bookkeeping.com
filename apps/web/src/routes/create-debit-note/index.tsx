import {
  createDebitNoteSchema,
  createDebitNoteSchemaDefaultValues,
  type ZodCreateDebitNoteSchema,
} from "@/zod-schemas/debit-note/create-debit-note";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { debitNoteTabAtom, type DebitNoteTab } from "@/global/atoms/debit-note-atom";
import { zodResolver } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCallback, useRef } from "react";
import { PdfWorkerProvider } from "@/providers";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import DebitNoteOptions from "./options/debit-note-options";
import DebitNotePreview from "./debit-note-preview";
import DebitNoteForm from "./debit-note-form";

interface DebitNotePageProps {
  defaultDebitNote?: ZodCreateDebitNoteSchema;
}

export function CreateDebitNotePage({ defaultDebitNote }: DebitNotePageProps) {
  const debitNoteFormPanelRef = useRef<ImperativePanelHandle>(null);
  const debitNotePreviewPanelRef = useRef<ImperativePanelHandle>(null);
  const [debitNoteTab, setDebitNoteTab] = useAtom(debitNoteTabAtom);
  const isMobile = useIsMobile();

  // Form
  const form = useForm<ZodCreateDebitNoteSchema>({
    resolver: zodResolver(createDebitNoteSchema),
    defaultValues: defaultDebitNote || createDebitNoteSchemaDefaultValues,
  });

  // Handle tab change and panel resize in the same event handler
  const handleTabChange = useCallback(
    (newTab: DebitNoteTab) => {
      const debitNotePanel = debitNoteFormPanelRef.current;
      const debitNotePreviewPanel = debitNotePreviewPanelRef.current;

      const effectiveTab = isMobile && newTab === "both" ? "form" : newTab;
      setDebitNoteTab(effectiveTab);

      if (!debitNotePanel || !debitNotePreviewPanel) return;

      switch (effectiveTab) {
        case "form":
          if (debitNotePanel.isCollapsed()) debitNotePanel.expand();
          debitNotePreviewPanel.collapse();
          debitNotePanel.resize(100);
          break;
        case "preview":
          if (debitNotePreviewPanel.isCollapsed()) debitNotePreviewPanel.expand();
          debitNotePanel.collapse();
          debitNotePreviewPanel.resize(100);
          break;
        case "both":
          if (debitNotePanel.isCollapsed()) debitNotePanel.expand();
          if (debitNotePreviewPanel.isCollapsed()) debitNotePreviewPanel.expand();
          debitNotePanel.resize(50);
          debitNotePreviewPanel.resize(50);
          break;
      }
    },
    [isMobile, setDebitNoteTab]
  );

  return (
    <div className="flex h-full flex-col">
      <DebitNoteOptions form={form} onTabChange={handleTabChange} />
      <ResizablePanelGroup direction="horizontal" className="divide-x">
        <ResizablePanel collapsible={true} defaultSize={50} ref={debitNoteFormPanelRef}>
          <DebitNoteForm form={form} />
        </ResizablePanel>
        <ResizablePanel
          className={cn(debitNoteTab === "both" ? "hidden md:flex" : "flex")}
          collapsible={true}
          defaultSize={50}
          ref={debitNotePreviewPanelRef}
        >
          <PdfWorkerProvider>
            <DebitNotePreview form={form} />
          </PdfWorkerProvider>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default CreateDebitNotePage;
