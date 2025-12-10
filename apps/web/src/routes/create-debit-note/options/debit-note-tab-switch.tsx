import { FileFeatherIcon, LayoutSplitIcon, EyeScannerIcon } from "@/assets/icons";
import { debitNoteTabAtom, type DebitNoteTab } from "@/global/atoms/debit-note-atom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAtomValue } from "jotai";

interface DebitNoteTabSwitchProps {
  onTabChange?: (tab: DebitNoteTab) => void;
}

const DebitNoteTabSwitch = ({ onTabChange }: DebitNoteTabSwitchProps) => {
  const debitNoteTab = useAtomValue(debitNoteTabAtom);

  const handleValueChange = (value: string) => {
    onTabChange?.(value as DebitNoteTab);
  };

  return (
    <Tabs value={debitNoteTab} onValueChange={handleValueChange}>
      <TabsList className="h-9">
        <TabsTrigger value="form" className="gap-1.5 px-3">
          <FileFeatherIcon className="size-4" />
          <span className="hidden sm:inline">Form</span>
        </TabsTrigger>
        <TabsTrigger value="both" className="hidden gap-1.5 px-3 md:flex">
          <LayoutSplitIcon className="size-4" />
          <span className="hidden sm:inline">Both</span>
        </TabsTrigger>
        <TabsTrigger value="preview" className="gap-1.5 px-3">
          <EyeScannerIcon className="size-4" />
          <span className="hidden sm:inline">Preview</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

export default DebitNoteTabSwitch;
