import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/utils";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { InboxArrowDownIcon } from "@/assets/icons";
import { Loader2 } from "@/components/ui/icons";
import { toast } from "sonner";

const notificationSettingsSchema = z.object({
  emailOnOverdue: z.boolean().optional(),
  emailOnPayment: z.boolean().optional(),
  emailOnQuotationAccepted: z.boolean().optional(),
  overdueReminderDays: z.number().min(1).max(90).optional().nullable(),
});

type NotificationSettingsFormData = z.infer<typeof notificationSettingsSchema>;

interface NotificationSettingsFormProps {
  defaultValues?: Partial<NotificationSettingsFormData>;
  onSubmit: (data: NotificationSettingsFormData) => Promise<void>;
  isLoading?: boolean;
  isSaving?: boolean;
}

export function NotificationSettingsForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  isSaving = false,
}: NotificationSettingsFormProps) {
  const form = useForm<NotificationSettingsFormData>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      emailOnOverdue: defaultValues?.emailOnOverdue ?? true,
      emailOnPayment: defaultValues?.emailOnPayment ?? true,
      emailOnQuotationAccepted: defaultValues?.emailOnQuotationAccepted ?? true,
      overdueReminderDays: defaultValues?.overdueReminderDays || 7,
    },
  });

  const handleSubmit = async (data: NotificationSettingsFormData) => {
    try {
      await onSubmit(data);
      toast.success("Notification settings updated");
    } catch {
      toast.error("Failed to update notification settings");
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
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-6 w-12" />
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
          <InboxArrowDownIcon className="size-5 text-primary" />
          <CardTitle className="text-lg">Notifications</CardTitle>
        </div>
        <CardDescription>
          Configure email notifications for invoice events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="emailOnPayment" className="text-base">
                  Payment Received
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when a customer pays an invoice
                </p>
              </div>
              <Switch
                id="emailOnPayment"
                checked={form.watch("emailOnPayment")}
                onCheckedChange={(checked) => form.setValue("emailOnPayment", checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="emailOnOverdue" className="text-base">
                  Overdue Invoice
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when an invoice becomes overdue
                </p>
              </div>
              <Switch
                id="emailOnOverdue"
                checked={form.watch("emailOnOverdue")}
                onCheckedChange={(checked) => form.setValue("emailOnOverdue", checked)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="emailOnQuotationAccepted" className="text-base">
                  Quotation Accepted
                </Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when a customer accepts a quotation
                </p>
              </div>
              <Switch
                id="emailOnQuotationAccepted"
                checked={form.watch("emailOnQuotationAccepted")}
                onCheckedChange={(checked) =>
                  form.setValue("emailOnQuotationAccepted", checked)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="overdueReminderDays">Overdue Reminder Days</Label>
            <div className="flex items-center gap-2">
              <Input
                id="overdueReminderDays"
                type="number"
                min={1}
                max={90}
                className="w-24"
                {...form.register("overdueReminderDays", { valueAsNumber: true })}
              />
              <span className="text-sm text-muted-foreground">
                days after due date
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              How many days after the due date to send overdue reminders
            </p>
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
