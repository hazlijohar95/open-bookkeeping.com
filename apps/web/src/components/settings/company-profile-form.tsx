import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/utils";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { IdBadgeIcon } from "@/assets/icons";
import { Loader2 } from "@/components/ui/icons";
import { toast } from "sonner";

const companyProfileSchema = z.object({
  companyName: z.string().max(255).optional().nullable(),
  companyAddress: z.string().max(1000).optional().nullable(),
  companyTaxId: z.string().max(100).optional().nullable(),
  companyPhone: z.string().max(50).optional().nullable(),
  companyEmail: z.string().email().max(255).optional().nullable().or(z.literal("")),
  companyWebsite: z.string().url().max(500).optional().nullable().or(z.literal("")),
});

type CompanyProfileFormData = z.infer<typeof companyProfileSchema>;

interface CompanyProfileFormProps {
  defaultValues?: Partial<CompanyProfileFormData>;
  onSubmit: (data: CompanyProfileFormData) => Promise<void>;
  isLoading?: boolean;
  isSaving?: boolean;
}

export function CompanyProfileForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  isSaving = false,
}: CompanyProfileFormProps) {
  const form = useForm<CompanyProfileFormData>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      companyName: defaultValues?.companyName || "",
      companyAddress: defaultValues?.companyAddress || "",
      companyTaxId: defaultValues?.companyTaxId || "",
      companyPhone: defaultValues?.companyPhone || "",
      companyEmail: defaultValues?.companyEmail || "",
      companyWebsite: defaultValues?.companyWebsite || "",
    },
  });

  const handleSubmit = async (data: CompanyProfileFormData) => {
    try {
      await onSubmit({
        ...data,
        companyEmail: data.companyEmail || null,
        companyWebsite: data.companyWebsite || null,
      });
      toast.success("Company profile updated");
    } catch {
      toast.error("Failed to update company profile");
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
          <IdBadgeIcon className="size-5 text-primary" />
          <CardTitle className="text-lg">Company Profile</CardTitle>
        </div>
        <CardDescription>
          Your company information that appears on invoices and quotations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Your Company Name"
                {...form.register("companyName")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyTaxId">Tax ID / Registration Number</Label>
              <Input
                id="companyTaxId"
                placeholder="e.g., 123456789"
                {...form.register("companyTaxId")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyAddress">Address</Label>
            <Textarea
              id="companyAddress"
              placeholder="Your company address"
              rows={3}
              {...form.register("companyAddress")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyPhone">Phone</Label>
              <Input
                id="companyPhone"
                type="tel"
                placeholder="+60 12-345 6789"
                {...form.register("companyPhone")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyEmail">Email</Label>
              <Input
                id="companyEmail"
                type="email"
                placeholder="contact@company.com"
                {...form.register("companyEmail")}
              />
              {form.formState.errors.companyEmail && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.companyEmail.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyWebsite">Website</Label>
            <Input
              id="companyWebsite"
              type="url"
              placeholder="https://www.yourcompany.com"
              {...form.register("companyWebsite")}
            />
            {form.formState.errors.companyWebsite && (
              <p className="text-xs text-destructive">
                {form.formState.errors.companyWebsite.message}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
