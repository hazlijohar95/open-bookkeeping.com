import { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";
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

// Available Template Array for Debit Notes
export const availableDebitNoteTemplates: PdfTemplate[] = [
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

export const DebitNoteTemplateSelector = ({ form }: { form: UseFormReturn<ZodCreateDebitNoteSchema> }) => {
  return (
    <FormSelect
      name="debitNoteDetails.theme.template"
      reactform={form}
      defaultValue="default"
      placeholder="Select template"
      className="min-w-34"
    >
      {availableDebitNoteTemplates.map((template) => {
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
