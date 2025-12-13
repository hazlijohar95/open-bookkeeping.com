/**
 * Payroll Run Form Modal
 * Create a new payroll run with refined, professional design
 */

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarIcon,
  Loader2Icon,
  UsersIcon,
  CurrencyDollarIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
} from "@/components/ui/icons";
import type { PayrollRun } from "@/api/payroll";
import { useCreatePayrollRun, useEmployees } from "@/api/payroll";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const monthNamesShort = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const formSchema = z.object({
  name: z.string().optional(),
  periodYear: z.coerce.number().min(2020).max(2100),
  periodMonth: z.coerce.number().min(1).max(12),
  payDate: z.string().min(1, "Pay date is required"),
  periodStartDate: z.string().optional(),
  periodEndDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface PayrollRunFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollRun?: PayrollRun | null;
}

export function PayrollRunFormModal({ isOpen, onClose, payrollRun }: PayrollRunFormModalProps) {
  const isEditing = !!payrollRun;
  const createMutation = useCreatePayrollRun();
  const { data: employees } = useEmployees({ status: "active" });

  const activeEmployeeCount = employees?.length ?? 0;

  // Default pay date to the last day of the selected month
  const getDefaultPayDate = (year: number, month: number) => {
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      periodYear: currentYear,
      periodMonth: currentMonth,
      payDate: getDefaultPayDate(currentYear, currentMonth),
      periodStartDate: "",
      periodEndDate: "",
    },
  });

  const watchYear = form.watch("periodYear");
  const watchMonth = form.watch("periodMonth");

  // Calculate period info for display
  const periodInfo = useMemo(() => {
    if (!watchYear || !watchMonth) return null;
    const startDate = new Date(watchYear, watchMonth - 1, 1);
    const lastDay = new Date(watchYear, watchMonth, 0).getDate();
    const endDate = new Date(watchYear, watchMonth - 1, lastDay);

    return {
      monthName: monthNames[watchMonth - 1],
      monthShort: monthNamesShort[watchMonth - 1],
      year: watchYear,
      startDate,
      endDate,
      lastDay,
      daysInMonth: lastDay,
    };
  }, [watchYear, watchMonth]);

  // Update period dates when year/month changes
  useEffect(() => {
    if (watchYear && watchMonth) {
      const startDate = `${watchYear}-${String(watchMonth).padStart(2, "0")}-01`;
      const lastDay = new Date(watchYear, watchMonth, 0).getDate();
      const endDate = `${watchYear}-${String(watchMonth).padStart(2, "0")}-${lastDay}`;
      const payDate = endDate;

      form.setValue("periodStartDate", startDate);
      form.setValue("periodEndDate", endDate);
      if (!form.getValues("payDate") || !isEditing) {
        form.setValue("payDate", payDate);
      }
    }
  }, [watchYear, watchMonth, form, isEditing]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (payrollRun) {
        form.reset({
          name: payrollRun.name || "",
          periodYear: payrollRun.periodYear,
          periodMonth: payrollRun.periodMonth,
          payDate: payrollRun.payDate || "",
          periodStartDate: payrollRun.periodStartDate || "",
          periodEndDate: payrollRun.periodEndDate || "",
        });
      } else {
        form.reset({
          name: "",
          periodYear: currentYear,
          periodMonth: currentMonth,
          payDate: getDefaultPayDate(currentYear, currentMonth),
          periodStartDate: `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`,
          periodEndDate: getDefaultPayDate(currentYear, currentMonth),
        });
      }
    }
  }, [isOpen, payrollRun, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      await createMutation.mutateAsync({
        name: data.name || undefined,
        periodYear: data.periodYear,
        periodMonth: data.periodMonth,
        payDate: data.payDate,
        periodStartDate: data.periodStartDate,
        periodEndDate: data.periodEndDate,
      });
      toast.success("Payroll run created successfully");
      onClose();
    } catch {
      toast.error("Failed to create payroll run");
    }
  };

  const isPending = createMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header with period preview */}
            <div className="relative overflow-hidden">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

              <DialogHeader className="relative p-6 pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <DialogTitle className="text-xl font-semibold tracking-tight">
                      {isEditing ? "Edit Payroll Run" : "New Payroll Run"}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Process salaries for your team
                    </p>
                  </div>

                  {/* Period badge */}
                  {periodInfo && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      key={`${periodInfo.monthShort}-${periodInfo.year}`}
                      className="flex flex-col items-center justify-center rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 min-w-[80px]"
                    >
                      <span className="text-2xl font-bold text-primary leading-none">
                        {periodInfo.monthShort}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {periodInfo.year}
                      </span>
                    </motion.div>
                  )}
                </div>
              </DialogHeader>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
                <div className="px-6 pb-6 space-y-5">
                  {/* Period Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground flex items-center gap-2">
                      <CalendarIcon className="size-4 text-muted-foreground" />
                      Pay Period
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="periodMonth"
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              value={String(field.value)}
                              onValueChange={(v) => field.onChange(parseInt(v))}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Month" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {monthNames.map((name, idx) => (
                                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                                    {name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="periodYear"
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              value={String(field.value)}
                              onValueChange={(v) => field.onChange(parseInt(v))}
                            >
                              <FormControl>
                                <SelectTrigger className="h-11">
                                  <SelectValue placeholder="Year" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year) => (
                                  <SelectItem key={year} value={String(year)}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Pay Date */}
                  <FormField
                    control={form.control}
                    name="payDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <CurrencyDollarIcon className="size-4 text-muted-foreground" />
                          Payment Date
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            className="h-11"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          The date when salaries will be credited
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Optional Name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">
                          Label <span className="text-xs">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={periodInfo ? `${periodInfo.monthName} ${periodInfo.year} Payroll` : "e.g., December Bonus Run"}
                            className="h-11"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Summary Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-xl border bg-muted/30 p-4 space-y-3"
                  >
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Summary
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <UsersIcon className="size-4" />
                          Active Employees
                        </span>
                        <span className="font-medium tabular-nums">
                          {activeEmployeeCount}
                        </span>
                      </div>
                      {periodInfo && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <CalendarIcon className="size-4" />
                            Working Days
                          </span>
                          <span className="font-medium tabular-nums">
                            {periodInfo.daysInMonth} days
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Next steps hint */}
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">
                        After creating, you'll be able to:
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {["Calculate salaries", "Review deductions", "Process payments"].map((step) => (
                          <span
                            key={step}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-background border"
                          >
                            <CheckCircle2Icon className="size-3 text-primary" />
                            {step}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-muted/20">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className={cn(
                      "min-w-[140px]",
                      isPending && "cursor-wait"
                    )}
                  >
                    {isPending ? (
                      <>
                        <Loader2Icon className="mr-2 size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        Create Payroll
                        <ChevronRightIcon className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
