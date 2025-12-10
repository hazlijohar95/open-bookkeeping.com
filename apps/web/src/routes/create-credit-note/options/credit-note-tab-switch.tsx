import { FileFeatherIcon, LayoutSplitIcon, EyeScannerIcon } from "@/assets/icons";
import { creditNoteTabAtom, type CreditNoteTab } from "@/global/atoms/credit-note-atom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAtomValue } from "jotai";

interface CreditNoteTabSwitchProps {
  onTabChange?: (tab: CreditNoteTab) => void;
}

const CreditNoteTabSwitch = ({ onTabChange }: CreditNoteTabSwitchProps) => {
  const creditNoteTab = useAtomValue(creditNoteTabAtom);

  const handleValueChange = (value: string) => {
    onTabChange?.(value as CreditNoteTab);
  };

  return (
    <Tabs value={creditNoteTab} onValueChange={handleValueChange}>
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

export default CreditNoteTabSwitch;
