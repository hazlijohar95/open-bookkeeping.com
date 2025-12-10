import { useCheckHasAccounts, useAccountTree, useAccountSummary, useDeleteAccount } from "@/api/chart-of-accounts";
import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  FileSpreadsheet,
  Search,
  BookOpen,
  Wallet,
  Scale,
  TrendingUp,
  Receipt,
  Sparkles,
} from "@/components/ui/icons";
import { useState } from "react";
import { AccountTree, type AccountTreeNode } from "@/components/chart-of-accounts/account-tree";
import { AccountFormModal } from "@/components/chart-of-accounts/account-form-modal";
import { JournalEntryModal } from "@/components/chart-of-accounts/journal-entry-modal";
import { InitializeDefaultsModal } from "@/components/chart-of-accounts/initialize-defaults-modal";
import { cn } from "@/lib/utils";
import type { AccountType } from "@/zod-schemas/chart-of-accounts";

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color?: string;
}

function SummaryCard({ label, value, icon, color }: SummaryCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground mb-1">{label}</div>
          <div className={cn("text-xl font-semibold", color)}>{value}</div>
        </div>
        <div className="text-muted-foreground/50">{icon}</div>
      </div>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ChartOfAccounts() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isJournalEntryModalOpen, setIsJournalEntryModalOpen] = useState(false);
  const [isInitializeModalOpen, setIsInitializeModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [selectedType, setSelectedType] = useState<AccountType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [accountToDelete, setAccountToDelete] = useState<any | null>(null);

  const deleteAccount = useDeleteAccount();

  const { data: hasAccounts, isLoading: checkLoading } = useCheckHasAccounts({
    enabled: !!user && !isAuthLoading,
  });

  const { data: accountTree, isLoading: treeLoading } = useAccountTree(
    selectedType !== "all" ? selectedType : undefined,
    { enabled: !!user && !isAuthLoading && hasAccounts?.hasAccounts }
  );

  const { data: summary } = useAccountSummary({
    enabled: !!user && !isAuthLoading && hasAccounts?.hasAccounts,
  });

  const handleEditAccount = (account: any) => {
    setEditingAccount(account);
    setIsAccountModalOpen(true);
  };

  const handleAddChildAccount = (parentAccount: any) => {
    setEditingAccount({
      parentId: parentAccount.id,
      parentName: parentAccount.name,
      accountType: parentAccount.accountType,
      normalBalance: parentAccount.normalBalance,
    });
    setIsAccountModalOpen(true);
  };

  const handleCloseAccountModal = () => {
    setIsAccountModalOpen(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = (account: any) => {
    setAccountToDelete(account);
  };

  const confirmDeleteAccount = async () => {
    if (!accountToDelete) return;

    try {
      await deleteAccount.mutateAsync(accountToDelete.id);
      toast.success(`Account "${accountToDelete.name}" deleted successfully`);
      setAccountToDelete(null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete account");
    }
  };

  if (checkLoading || isAuthLoading) {
    return (
      <PageSkeleton
        title="Chart of Accounts"
        description="Manage your chart of accounts and track balances"
      />
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Chart of Accounts"
        description="Manage your chart of accounts and track balances"
        action={
          <div className="flex gap-2">
            {hasAccounts?.hasAccounts ? (
              <>
                <Button variant="outline" onClick={() => setIsAccountModalOpen(true)}>
                  <Plus className="size-4" />
                  Add Account
                </Button>
                <Button onClick={() => setIsJournalEntryModalOpen(true)}>
                  <FileSpreadsheet className="size-4" />
                  Journal Entry
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {!hasAccounts?.hasAccounts ? (
        <EmptyState
          icon={BookOpen}
          title="No chart of accounts yet"
          description="Initialize your chart of accounts with Malaysian SME defaults to get started with double-entry bookkeeping."
          action={
            <Button onClick={() => setIsInitializeModalOpen(true)}>
              <Sparkles className="size-4" />
              Load Malaysian SME Defaults
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <SummaryCard
              label="Assets"
              value={formatCurrency(summary?.assets.total || 0)}
              icon={<Wallet className="size-5" />}
              color="text-success"
            />
            <SummaryCard
              label="Liabilities"
              value={formatCurrency(summary?.liabilities.total || 0)}
              icon={<Receipt className="size-5" />}
              color="text-destructive"
            />
            <SummaryCard
              label="Equity"
              value={formatCurrency(summary?.equity.total || 0)}
              icon={<Scale className="size-5" />}
              color="text-info"
            />
            <SummaryCard
              label="Revenue"
              value={formatCurrency(summary?.revenue.total || 0)}
              icon={<TrendingUp className="size-5" />}
              color="text-primary"
            />
            <SummaryCard
              label="Expenses"
              value={formatCurrency(summary?.expenses.total || 0)}
              icon={<Receipt className="size-5" />}
              color="text-warning"
            />
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Account Type Tabs */}
          <Tabs
            value={selectedType}
            onValueChange={(v) => setSelectedType(v as AccountType | "all")}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="all">All Accounts</TabsTrigger>
              <TabsTrigger value="asset">Assets</TabsTrigger>
              <TabsTrigger value="liability">Liabilities</TabsTrigger>
              <TabsTrigger value="equity">Equity</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="expense">Expenses</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedType} className="mt-4">
              {treeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : accountTree && accountTree.length > 0 ? (
                <AccountTree
                  accounts={accountTree as unknown as AccountTreeNode[]}
                  searchQuery={searchQuery}
                  onEditAccount={handleEditAccount}
                  onAddChildAccount={handleAddChildAccount}
                  onDeleteAccount={handleDeleteAccount}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border bg-muted/30">
                  <div className="text-muted-foreground text-sm">
                    No accounts found
                  </div>
                  <div className="text-muted-foreground/70 text-xs mt-1">
                    {searchQuery
                      ? "Try adjusting your search"
                      : "Add an account to get started"}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Modals */}
      <AccountFormModal
        isOpen={isAccountModalOpen}
        onClose={handleCloseAccountModal}
        editingAccount={editingAccount}
      />

      <JournalEntryModal
        isOpen={isJournalEntryModalOpen}
        onClose={() => setIsJournalEntryModalOpen(false)}
      />

      <InitializeDefaultsModal
        isOpen={isInitializeModalOpen}
        onClose={() => setIsInitializeModalOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!accountToDelete} onOpenChange={(open: boolean) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the account "{accountToDelete?.name}" ({accountToDelete?.code})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteAccount}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
