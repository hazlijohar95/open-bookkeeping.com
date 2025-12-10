import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContentContainer,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/trpc/provider";
import { toast } from "sonner";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@/lib/utils";
import { useEffect, useMemo } from "react";
import { FileSpreadsheet, Plus, Trash2, AlertCircle } from "@/components/ui/icons";
import {
  createJournalEntrySchema,
  type CreateJournalEntrySchema,
} from "@/zod-schemas/chart-of-accounts";
import { format } from "date-fns";

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JournalEntryModal({ isOpen, onClose }: JournalEntryModalProps) {
  const utils = trpc.useUtils();

  const { data: accounts } = trpc.chartOfAccounts.searchAccounts.useQuery(
    { query: "", excludeHeaders: true },
    { enabled: isOpen }
  );

  const form = useForm<CreateJournalEntrySchema>({
    resolver: zodResolver(createJournalEntrySchema),
    defaultValues: {
      entryDate: format(new Date(), "yyyy-MM-dd"),
      description: "",
      reference: "",
      lines: [
        { accountId: "", debitAmount: "", creditAmount: "" },
        { accountId: "", debitAmount: "", creditAmount: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const createMutation = trpc.chartOfAccounts.createJournalEntry.useMutation({
    onSuccess: (data) => {
      utils.chartOfAccounts.getAccountTree.invalidate();
      utils.chartOfAccounts.getAccountSummary.invalidate();
      utils.chartOfAccounts.listJournalEntries.invalidate();
      toast.success(`Journal entry ${data?.entryNumber ?? ""} created`);
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const postMutation = trpc.chartOfAccounts.postJournalEntry.useMutation({
    onSuccess: () => {
      utils.chartOfAccounts.getAccountTree.invalidate();
      utils.chartOfAccounts.getAccountSummary.invalidate();
      utils.chartOfAccounts.listJournalEntries.invalidate();
      toast.success("Journal entry posted successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        entryDate: format(new Date(), "yyyy-MM-dd"),
        description: "",
        reference: "",
        lines: [
          { accountId: "", debitAmount: "", creditAmount: "" },
          { accountId: "", debitAmount: "", creditAmount: "" },
        ],
      });
    }
  }, [isOpen, form]);

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const watchLines = form.watch("lines");

  const { totalDebit, totalCredit, isBalanced } = useMemo(() => {
    let debit = 0;
    let credit = 0;

    for (const line of watchLines) {
      debit += parseFloat(line.debitAmount || "0");
      credit += parseFloat(line.creditAmount || "0");
    }

    return {
      totalDebit: debit,
      totalCredit: credit,
      isBalanced: Math.abs(debit - credit) < 0.01,
    };
  }, [watchLines]);

  const handleDebitChange = (index: number, value: string) => {
    form.setValue(`lines.${index}.debitAmount`, value);
    if (value && parseFloat(value) > 0) {
      form.setValue(`lines.${index}.creditAmount`, "");
    }
  };

  const handleCreditChange = (index: number, value: string) => {
    form.setValue(`lines.${index}.creditAmount`, value);
    if (value && parseFloat(value) > 0) {
      form.setValue(`lines.${index}.debitAmount`, "");
    }
  };

  const onSubmit = async (data: CreateJournalEntrySchema) => {
    await createMutation.mutateAsync(data);
  };

  const onSubmitAndPost = async (data: CreateJournalEntrySchema) => {
    const entry = await createMutation.mutateAsync(data);
    if (entry) {
      await postMutation.mutateAsync({ id: entry.id });
    }
  };

  const isPending = createMutation.isPending || postMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeaderContainer>
          <DialogIcon>
            <FileSpreadsheet className="size-5" />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Create Journal Entry</DialogTitle>
            <DialogDescription>
              Record a manual journal entry with balanced debits and credits.
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogContentContainer className="flex-1 overflow-y-auto">
          <form className="space-y-4">
            {/* Header Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entryDate">Entry Date *</Label>
                <Input
                  id="entryDate"
                  type="date"
                  {...form.register("entryDate")}
                />
                {form.formState.errors.entryDate && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.entryDate.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  placeholder="Optional reference..."
                  {...form.register("reference")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Describe this journal entry..."
                rows={2}
                {...form.register("description")}
              />
              {form.formState.errors.description && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            {/* Journal Entry Lines */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Entry Lines</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({ accountId: "", debitAmount: "", creditAmount: "" })
                  }
                >
                  <Plus className="size-3" />
                  Add Line
                </Button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_120px_120px_40px] gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                  <div>Account</div>
                  <div className="text-right">Debit</div>
                  <div className="text-right">Credit</div>
                  <div></div>
                </div>

                {/* Lines */}
                <div className="divide-y">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_120px_120px_40px] gap-2 px-3 py-2 items-center"
                    >
                      <Select
                        value={watchLines[index]?.accountId || ""}
                        onValueChange={(v) =>
                          form.setValue(`lines.${index}.accountId`, v)
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts?.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              <span className="font-mono text-xs mr-2">
                                {account.code}
                              </span>
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="h-8 text-sm text-right"
                        value={watchLines[index]?.debitAmount || ""}
                        onChange={(e) =>
                          handleDebitChange(index, e.target.value)
                        }
                      />

                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="h-8 text-sm text-right"
                        value={watchLines[index]?.creditAmount || ""}
                        onChange={(e) =>
                          handleCreditChange(index, e.target.value)
                        }
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => remove(index)}
                        disabled={fields.length <= 2}
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="grid grid-cols-[1fr_120px_120px_40px] gap-2 px-3 py-2 bg-muted/30 border-t">
                  <div className="text-sm font-medium">Totals</div>
                  <div className="text-right font-mono text-sm font-medium">
                    {totalDebit.toFixed(2)}
                  </div>
                  <div className="text-right font-mono text-sm font-medium">
                    {totalCredit.toFixed(2)}
                  </div>
                  <div></div>
                </div>
              </div>

              {/* Balance Warning */}
              {!isBalanced && totalDebit > 0 && totalCredit > 0 && (
                <div className="flex items-center gap-2 text-sm text-warning-foreground dark:text-warning bg-warning/10 rounded-lg px-3 py-2">
                  <AlertCircle className="size-4" />
                  <span>
                    Entry is not balanced. Difference:{" "}
                    {Math.abs(totalDebit - totalCredit).toFixed(2)}
                  </span>
                </div>
              )}

              {form.formState.errors.lines && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.lines.message ||
                    form.formState.errors.lines.root?.message}
                </p>
              )}
            </div>
          </form>
        </DialogContentContainer>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="outline"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isPending || !isBalanced}
          >
            {createMutation.isPending ? "Saving..." : "Save as Draft"}
          </Button>
          <Button
            onClick={form.handleSubmit(onSubmitAndPost)}
            disabled={isPending || !isBalanced}
          >
            {isPending ? "Posting..." : "Save & Post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
