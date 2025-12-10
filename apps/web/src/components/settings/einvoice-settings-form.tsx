import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/utils";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { FileCheckIcon, TriangleWarningIcon, CircleCheckIcon } from "@/assets/icons";
import { Loader2, ExternalLink, Info } from "@/components/ui/icons";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const einvoiceSettingsSchema = z.object({
  enabled: z.boolean(),
  autoSubmit: z.boolean(),
  tin: z.string().min(1, "TIN is required").max(20).optional().or(z.literal("")),
  brn: z.string().min(1, "BRN is required").max(30).optional().or(z.literal("")),
  identificationScheme: z.enum(["NRIC", "BRN", "PASSPORT", "ARMY"]).optional(),
  msicCode: z.string().length(5, "MSIC Code must be 5 digits").optional().or(z.literal("")),
  msicDescription: z.string().min(1, "MSIC Description is required").max(255).optional().or(z.literal("")),
  sstRegistration: z.string().max(50).nullable().optional(),
  tourismTaxRegistration: z.string().max(50).nullable().optional(),
});

type EInvoiceSettingsFormData = z.infer<typeof einvoiceSettingsSchema>;

interface EInvoiceSettingsFormProps {
  defaultValues?: Partial<EInvoiceSettingsFormData>;
  onSubmit: (data: EInvoiceSettingsFormData) => Promise<void>;
  isLoading?: boolean;
  isSaving?: boolean;
  validationErrors?: string[];
}

const IDENTIFICATION_SCHEMES = [
  { value: "BRN", label: "Business Registration Number (BRN)" },
  { value: "NRIC", label: "Malaysian IC Number (NRIC)" },
  { value: "PASSPORT", label: "Passport Number" },
  { value: "ARMY", label: "Army ID" },
] as const;

export function EInvoiceSettingsForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  isSaving = false,
  validationErrors = [],
}: EInvoiceSettingsFormProps) {
  const form = useForm<EInvoiceSettingsFormData>({
    resolver: zodResolver(einvoiceSettingsSchema),
    defaultValues: {
      enabled: defaultValues?.enabled ?? false,
      autoSubmit: defaultValues?.autoSubmit ?? false,
      tin: defaultValues?.tin || "",
      brn: defaultValues?.brn || "",
      identificationScheme: defaultValues?.identificationScheme || "BRN",
      msicCode: defaultValues?.msicCode || "",
      msicDescription: defaultValues?.msicDescription || "",
      sstRegistration: defaultValues?.sstRegistration || "",
      tourismTaxRegistration: defaultValues?.tourismTaxRegistration || "",
    },
  });

  const isEnabled = form.watch("enabled");
  const isConfigured = validationErrors.length === 0 && defaultValues?.tin && defaultValues?.brn;

  const handleSubmit = async (data: EInvoiceSettingsFormData) => {
    try {
      await onSubmit({
        ...data,
        sstRegistration: data.sstRegistration || null,
        tourismTaxRegistration: data.tourismTaxRegistration || null,
      });
      toast.success("E-Invoice settings updated");
    } catch {
      toast.error("Failed to update e-invoice settings");
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
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheckIcon className="size-5 text-primary" />
              <CardTitle className="text-lg">MyInvois E-Invoice</CardTitle>
            </div>
            <Badge variant={isEnabled && isConfigured ? "default" : "secondary"}>
              {isEnabled && isConfigured ? "Active" : isEnabled ? "Not Configured" : "Disabled"}
            </Badge>
          </div>
          <CardDescription>
            Connect to Malaysia's MyInvois system for e-invoice compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="enabled" className="text-base font-medium">
                Enable E-Invoice
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable MyInvois e-invoice submission for your invoices
              </p>
            </div>
            <Switch
              id="enabled"
              checked={form.watch("enabled")}
              onCheckedChange={(checked) => form.setValue("enabled", checked)}
            />
          </div>

          {isEnabled && (
            <div className="mt-4 flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="autoSubmit" className="text-base font-medium">
                  Auto-Submit Invoices
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically submit invoices to MyInvois when created
                </p>
              </div>
              <Switch
                id="autoSubmit"
                checked={form.watch("autoSubmit")}
                onCheckedChange={(checked) => form.setValue("autoSubmit", checked)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Status */}
      {isEnabled && validationErrors.length > 0 && (
        <Alert variant="destructive">
          <TriangleWarningIcon className="size-4" />
          <AlertTitle>Configuration Required</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc pl-4 text-sm">
              {validationErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {isEnabled && validationErrors.length === 0 && defaultValues?.tin && (
        <Alert>
          <CircleCheckIcon className="size-4" />
          <AlertTitle>Configuration Complete</AlertTitle>
          <AlertDescription>
            Your e-invoice settings are configured and ready for submission.
          </AlertDescription>
        </Alert>
      )}

      {/* Business Information */}
      {isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business Information</CardTitle>
            <CardDescription>
              Your business identification details for MyInvois registration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tin">
                    TIN (Tax Identification Number) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tin"
                    placeholder="C1234567890"
                    {...form.register("tin")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your LHDN Tax Identification Number
                  </p>
                  {form.formState.errors.tin && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.tin.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brn">
                    BRN (Business Registration Number) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="brn"
                    placeholder="202001012345"
                    {...form.register("brn")}
                  />
                  <p className="text-xs text-muted-foreground">
                    SSM Registration Number
                  </p>
                  {form.formState.errors.brn && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.brn.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="identificationScheme">
                  Identification Scheme <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.watch("identificationScheme")}
                  onValueChange={(value) =>
                    form.setValue("identificationScheme", value as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select identification type" />
                  </SelectTrigger>
                  <SelectContent>
                    {IDENTIFICATION_SCHEMES.map((scheme) => (
                      <SelectItem key={scheme.value} value={scheme.value}>
                        {scheme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="msicCode">
                    MSIC Code <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="msicCode"
                    placeholder="62020"
                    maxLength={5}
                    {...form.register("msicCode")}
                  />
                  <p className="text-xs text-muted-foreground">
                    5-digit Malaysia Standard Industrial Classification code
                  </p>
                  {form.formState.errors.msicCode && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.msicCode.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="msicDescription">
                    MSIC Description <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="msicDescription"
                    placeholder="Computer programming activities"
                    {...form.register("msicDescription")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Business activity description
                  </p>
                  {form.formState.errors.msicDescription && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.msicDescription.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="flex items-start gap-2">
                  <Info className="size-4 mt-0.5 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">Find your MSIC Code</p>
                    <p className="text-muted-foreground">
                      Look up your MSIC code based on your business activity.
                    </p>
                    <a
                      href="https://www.dosm.gov.my/v1/uploads/files/4_Portal%20Content/3_Methods%20%26%20Classifications/2_Classifications/MSIC2008%20Malay/MSIC_2008_COMPLETE_BOOK_MALAY.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                    >
                      MSIC Classification Guide
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sstRegistration">SST Registration Number</Label>
                  <Input
                    id="sstRegistration"
                    placeholder="Optional"
                    {...form.register("sstRegistration")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sales and Service Tax registration (if applicable)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tourismTaxRegistration">
                    Tourism Tax Registration
                  </Label>
                  <Input
                    id="tourismTaxRegistration"
                    placeholder="Optional"
                    {...form.register("tourismTaxRegistration")}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tourism tax registration (if applicable)
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save Settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Help Card */}
      {isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">MyInvois Resources</CardTitle>
            <CardDescription>
              Learn more about Malaysia's e-invoicing requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a
              href="https://myinvois.hasil.gov.my/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted transition-colors"
            >
              <div>
                <p className="font-medium">MyInvois Portal</p>
                <p className="text-sm text-muted-foreground">
                  Official LHDN e-invoice portal
                </p>
              </div>
              <ExternalLink className="size-4 text-muted-foreground" />
            </a>
            <a
              href="https://sdk.myinvois.hasil.gov.my/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted transition-colors"
            >
              <div>
                <p className="font-medium">Developer Sandbox</p>
                <p className="text-sm text-muted-foreground">
                  Test e-invoice submissions in sandbox mode
                </p>
              </div>
              <ExternalLink className="size-4 text-muted-foreground" />
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
