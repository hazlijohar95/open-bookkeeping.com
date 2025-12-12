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
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/trpc/provider";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/utils";
import { useEffect } from "react";
import { BookOpen } from "@/components/ui/icons";
import {
  createAccountSchema,
  accountTypeLabels,
  normalBalanceLabels,
  sstTaxCodeLabels,
  getDefaultNormalBalance,
  type CreateAccountSchema,
  type AccountType,
  type NormalBalance,
  type SstTaxCode,
} from "@/zod-schemas/chart-of-accounts";

interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAccount?: {
    id?: string;
    code?: string;
    name?: string;
    description?: string | null;
    accountType?: AccountType;
    normalBalance?: NormalBalance;
    parentId?: string | null;
    parentName?: string;
    sstTaxCode?: SstTaxCode | null;
    isHeader?: boolean;
    isSystemAccount?: boolean;
    openingBalance?: string | null;
  } | null;
}

export function AccountFormModal({
  isOpen,
  onClose,
  editingAccount,
}: AccountFormModalProps) {
  const utils = trpc.useUtils();
  const isEditing = editingAccount?.id;

  const form = useForm<CreateAccountSchema>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      accountType: "asset",
      normalBalance: "debit",
      parentId: null,
      sstTaxCode: "none",
      isHeader: false,
      openingBalance: "0",
    },
  });

  const createMutation = trpc.chartOfAccounts.createAccount.useMutation({
    onSuccess: () => {
      void utils.chartOfAccounts.getAccountTree.invalidate();
      void utils.chartOfAccounts.getAccountSummary.invalidate();
      void utils.chartOfAccounts.checkHasAccounts.invalidate();
      toast.success("Account created successfully");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.chartOfAccounts.updateAccount.useMutation({
    onSuccess: () => {
      void utils.chartOfAccounts.getAccountTree.invalidate();
      void utils.chartOfAccounts.getAccountSummary.invalidate();
      toast.success("Account updated successfully");
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (isOpen && editingAccount) {
      if (editingAccount.id) {
        // Editing existing account
        form.reset({
          code: editingAccount.code ?? "",
          name: editingAccount.name ?? "",
          description: editingAccount.description ?? "",
          accountType: editingAccount.accountType ?? "asset",
          normalBalance: editingAccount.normalBalance ?? "debit",
          parentId: editingAccount.parentId,
          sstTaxCode: editingAccount.sstTaxCode ?? "none",
          isHeader: editingAccount.isHeader || false,
          openingBalance: editingAccount.openingBalance ?? "0",
        });
      } else if (editingAccount.parentId) {
        // Adding child account
        form.reset({
          code: "",
          name: "",
          description: "",
          accountType: editingAccount.accountType ?? "asset",
          normalBalance: editingAccount.normalBalance ?? "debit",
          parentId: editingAccount.parentId,
          sstTaxCode: "none",
          isHeader: false,
          openingBalance: "0",
        });
      }
    } else if (isOpen) {
      form.reset({
        code: "",
        name: "",
        description: "",
        accountType: "asset",
        normalBalance: "debit",
        parentId: null,
        sstTaxCode: "none",
        isHeader: false,
        openingBalance: "0",
      });
    }
  }, [isOpen, editingAccount, form]);

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const handleAccountTypeChange = (type: AccountType) => {
    form.setValue("accountType", type);
    form.setValue("normalBalance", getDefaultNormalBalance(type));
  };

  const onSubmit = (data: CreateAccountSchema) => {
    // Convert null to undefined for parentId
    const submitData = {
      ...data,
      parentId: data.parentId ?? undefined,
    };

    if (isEditing) {
      updateMutation.mutate({
        id: editingAccount.id!,
        ...submitData,
      });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const watchAccountType = form.watch("accountType");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeaderContainer>
          <DialogIcon>
            <BookOpen className="size-5" />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Account" : "Create Account"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the account details below."
                : editingAccount?.parentName
                  ? `Add a child account under "${editingAccount.parentName}".`
                  : "Add a new account to your chart of accounts."}
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogContentContainer>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Code and Name */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input
                  id="code"
                  placeholder="1010"
                  {...form.register("code")}
                  disabled={editingAccount?.isSystemAccount}
                />
                {form.formState.errors.code && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.code.message}
                  </p>
                )}
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Petty Cash"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
            </div>

            {/* Account Type and Normal Balance */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Type *</Label>
                <Select
                  value={watchAccountType}
                  onValueChange={(v) => handleAccountTypeChange(v as AccountType)}
                  disabled={editingAccount?.isSystemAccount}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(accountTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Normal Balance</Label>
                <Select
                  value={form.watch("normalBalance")}
                  onValueChange={(v) =>
                    form.setValue("normalBalance", v as NormalBalance)
                  }
                  disabled={editingAccount?.isSystemAccount}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(normalBalanceLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SST Tax Code */}
            <div className="space-y-2">
              <Label>SST Tax Code</Label>
              <Select
                value={form.watch("sstTaxCode") ?? "none"}
                onValueChange={(v) => form.setValue("sstTaxCode", v as SstTaxCode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sstTaxCodeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional description for this account..."
                rows={2}
                {...form.register("description")}
              />
            </div>

            {/* Opening Balance */}
            {!form.watch("isHeader") && (
              <div className="space-y-2">
                <Label htmlFor="openingBalance">Opening Balance</Label>
                <Input
                  id="openingBalance"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...form.register("openingBalance")}
                />
              </div>
            )}

            {/* Is Header Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="isHeader">Header Account</Label>
                <div className="text-xs text-muted-foreground">
                  Header accounts cannot have transactions posted to them
                </div>
              </div>
              <Switch
                id="isHeader"
                checked={form.watch("isHeader")}
                onCheckedChange={(checked) => form.setValue("isHeader", checked)}
                disabled={editingAccount?.isSystemAccount}
              />
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
            onClick={form.handleSubmit(onSubmit)}
            disabled={isPending}
          >
            {isPending
              ? isEditing
                ? "Updating..."
                : "Creating..."
              : isEditing
                ? "Update Account"
                : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
