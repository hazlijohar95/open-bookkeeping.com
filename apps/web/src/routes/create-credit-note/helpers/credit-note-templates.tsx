import { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";
import { FormSelect } from "@/components/ui/form/form-select";
import { SelectItem } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { BoxIcon, SyncIcon, FileFeatherIcon } from "@/assets/icons";

type PdfTemplateName = "default" | "cynco" | "classic" | undefined;

interface PdfTemplate {
  name: PdfTemplateName;
  label: string;
  icon: React.ReactNode;
}

// Available Template Array for Credit Notes
export const availableCreditNoteTemplates: PdfTemplate[] = [
  {
    name: "default",
    label: "Default",
    icon: <BoxIcon className="size-4" />,
  },
  {
    name: "cynco",
    label: "Cynco",
    icon: <SyncIcon className="size-4" />,
  },
  {
    name: "classic",
    label: "Classic",
    icon: <FileFeatherIcon className="size-4" />,
  },
];

export const CreditNoteTemplateSelector = ({ form }: { form: UseFormReturn<ZodCreateCreditNoteSchema> }) => {
  return (
    <FormSelect
      name="creditNoteDetails.theme.template"
      reactform={form}
      defaultValue="default"
      placeholder="Select template"
      className="min-w-34"
    >
      {availableCreditNoteTemplates.map((template) => {
        if (!template.name) return null;
        return (
          <SelectItem key={template.name} value={template.name}>
            <div className="flex flex-row items-center gap-2">{template.icon}</div>
            <span>{template.label}</span>
          </SelectItem>
        );
      })}
    </FormSelect>
  );
};
