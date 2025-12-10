import { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { PdfTemplateName } from "@/lib/invoice/create-pdf-blob";
import { FormSelect } from "@/components/ui/form/form-select";
import { DefaultPDF, CyncoPDF, ClassicPDF, ZenPDF, ExecutivePDF } from "@/components/pdf";
import { SelectItem } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { BoxIcon, SyncIcon, FileFeatherIcon, TriangleIcon, IdBadgeIcon } from "@/assets/icons";

interface PdfTemplate {
  name: PdfTemplateName;
  label: string;
  component: React.ComponentType<{ data: ZodCreateInvoiceSchema }>;
  icon: React.ReactNode;
}

// Available Template Array
export const availablePdfTemplates: PdfTemplate[] = [
  {
    name: "default",
    label: "Default",
    component: DefaultPDF,
    icon: <BoxIcon className="size-4" />,
  },
  {
    name: "cynco",
    label: "Cynco",
    component: CyncoPDF,
    icon: <SyncIcon className="size-4" />,
  },
  {
    name: "classic",
    label: "Classic",
    component: ClassicPDF,
    icon: <FileFeatherIcon className="size-4" />,
  },
  {
    name: "zen",
    label: "Zen",
    component: ZenPDF,
    icon: <TriangleIcon className="size-4" />,
  },
  {
    name: "executive",
    label: "Executive",
    component: ExecutivePDF,
    icon: <IdBadgeIcon className="size-4" />,
  },
];

export const InvoiceTemplateSelector = ({ form }: { form: UseFormReturn<ZodCreateInvoiceSchema> }) => {
  return (
    <FormSelect
      name="invoiceDetails.theme.template"
      reactform={form}
      defaultValue="default"
      placeholder="Select template"
      className="min-w-34"
    >
      {availablePdfTemplates.map((template) => {
        // if the template is undefined, don't render it
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
