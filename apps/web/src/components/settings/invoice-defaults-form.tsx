import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/utils";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReceiptIcon } from "@/assets/icons";
import { Loader2Icon } from "@/components/ui/icons";
import { toast } from "sonner";
import { CURRENCIES } from "@/constants/currency";

const invoiceDefaultsSchema = z.object({
  defaultCurrency: z.string().max(10).optional().nullable(),
  defaultPaymentTerms: z.string().max(500).optional().nullable(),
  defaultTaxRate: z.number().min(0).max(100).optional().nullable(),
  invoicePrefix: z.string().max(20).optional().nullable(),
  quotationPrefix: z.string().max(20).optional().nullable(),
  invoiceNotes: z.string().max(2000).optional().nullable(),
  invoiceTerms: z.string().max(2000).optional().nullable(),
});

type InvoiceDefaultsFormData = z.infer<typeof invoiceDefaultsSchema>;

interface InvoiceDefaultsFormProps {
  defaultValues?: Partial<InvoiceDefaultsFormData>;
  onSubmit: (data: InvoiceDefaultsFormData) => Promise<void>;
  isLoading?: boolean;
  isSaving?: boolean;
}

export function InvoiceDefaultsForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  isSaving = false,
}: InvoiceDefaultsFormProps) {
  const form = useForm<InvoiceDefaultsFormData>({
    resolver: zodResolver(invoiceDefaultsSchema),
    defaultValues: {
      defaultCurrency: defaultValues?.defaultCurrency ?? "MYR",
      defaultPaymentTerms: defaultValues?.defaultPaymentTerms ?? "",
      defaultTaxRate: defaultValues?.defaultTaxRate ?? 0,
      invoicePrefix: defaultValues?.invoicePrefix ?? "INV",
      quotationPrefix: defaultValues?.quotationPrefix ?? "QT",
      invoiceNotes: defaultValues?.invoiceNotes ?? "",
      invoiceTerms: defaultValues?.invoiceTerms ?? "",
    },
  });

  const handleSubmit = async (data: InvoiceDefaultsFormData) => {
    try {
      await onSubmit(data);
      toast.success("Invoice defaults updated");
    } catch {
      toast.error("Failed to update invoice defaults");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ReceiptIcon className="size-5 text-primary" />
          <CardTitle className="text-lg">Invoice Defaults</CardTitle>
        </div>
        <CardDescription>
          Default values applied when creating new invoices and quotations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Default Currency</Label>
              <Select
                value={form.watch("defaultCurrency") ?? "MYR"}
                onValueChange={(v) => form.setValue("defaultCurrency", v)}
              >
                <SelectTrigger id="defaultCurrency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
              <Input
                id="invoicePrefix"
                placeholder="INV"
                {...form.register("invoicePrefix")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quotationPrefix">Quotation Prefix</Label>
              <Input
                id="quotationPrefix"
                placeholder="QT"
                {...form.register("quotationPrefix")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultTaxRate">Default Tax Rate (%)</Label>
              <Input
                id="defaultTaxRate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                placeholder="0"
                {...form.register("defaultTaxRate", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultPaymentTerms">Default Payment Terms</Label>
              <Input
                id="defaultPaymentTerms"
                placeholder="e.g., Net 30"
                {...form.register("defaultPaymentTerms")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceNotes">Default Invoice Notes</Label>
            <Textarea
              id="invoiceNotes"
              placeholder="Notes that appear on every invoice..."
              rows={3}
              {...form.register("invoiceNotes")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoiceTerms">Default Terms & Conditions</Label>
            <Textarea
              id="invoiceTerms"
              placeholder="Terms and conditions for your invoices..."
              rows={3}
              {...form.register("invoiceTerms")}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              SaveIcon Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
