import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/utils";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersIcon, Sun, Moon, LayoutSplitIcon } from "@/assets/icons";
import { Loader2Icon } from "@/components/ui/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const appearanceSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  dateFormat: z.string().max(20).optional().nullable(),
  numberFormat: z.string().max(20).optional().nullable(),
});

type AppearanceSettingsFormData = z.infer<typeof appearanceSettingsSchema>;

interface AppearanceSettingsFormProps {
  defaultValues?: Partial<AppearanceSettingsFormData>;
  onSubmit: (data: AppearanceSettingsFormData) => Promise<void>;
  isLoading?: boolean;
  isSaving?: boolean;
}

const DATE_FORMATS = [
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (31/12/2024)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (12/31/2024)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2024-12-31)" },
  { value: "DD-MM-YYYY", label: "DD-MM-YYYY (31-12-2024)" },
  { value: "DD MMM YYYY", label: "DD MMM YYYY (31 Dec 2024)" },
];

const NUMBER_FORMATS = [
  { value: "1,234.56", label: "1,234.56 (comma thousands, dot decimal)" },
  { value: "1.234,56", label: "1.234,56 (dot thousands, comma decimal)" },
  { value: "1 234.56", label: "1 234.56 (space thousands, dot decimal)" },
];

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: LayoutSplitIcon },
];

export function AppearanceSettingsForm({
  defaultValues,
  onSubmit,
  isLoading = false,
  isSaving = false,
}: AppearanceSettingsFormProps) {
  const form = useForm<AppearanceSettingsFormData>({
    resolver: zodResolver(appearanceSettingsSchema),
    defaultValues: {
      theme: defaultValues?.theme ?? "system",
      dateFormat: defaultValues?.dateFormat ?? "DD/MM/YYYY",
      numberFormat: defaultValues?.numberFormat ?? "1,234.56",
    },
  });

  const handleSubmit = async (data: AppearanceSettingsFormData) => {
    try {
      await onSubmit(data);
      toast.success("Appearance settings updated");
    } catch {
      toast.error("Failed to update appearance settings");
    }
  };

  const selectedTheme = form.watch("theme") ?? "system";

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
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
          <SlidersIcon className="size-5 text-primary" />
          <CardTitle className="text-lg">Appearance</CardTitle>
        </div>
        <CardDescription>
          Customize how Open-Bookkeeping looks and formats data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="space-y-3">
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map((theme) => {
                const Icon = theme.icon;
                return (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => form.setValue("theme", theme.value as "light" | "dark" | "system")}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all",
                      selectedTheme === theme.value
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/25"
                    )}
                  >
                    <Icon className="size-5" />
                    <span className="text-sm font-medium">{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select
                value={form.watch("dateFormat") ?? "DD/MM/YYYY"}
                onValueChange={(v) => form.setValue("dateFormat", v)}
              >
                <SelectTrigger id="dateFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numberFormat">Number Format</Label>
              <Select
                value={form.watch("numberFormat") ?? "1,234.56"}
                onValueChange={(v) => form.setValue("numberFormat", v)}
              >
                <SelectTrigger id="numberFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NUMBER_FORMATS.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
