import { useAuth } from "@/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeletons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DatabaseIcon, SyncIcon } from "@/assets/icons";
import { Plus, Upload, Building2, RefreshCw } from "@/components/ui/icons";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BankAccountModal } from "@/components/bank-feeds/bank-account-modal";
import { ImportTransactionsModal } from "@/components/bank-feeds/import-transactions-modal";
import { TransactionList } from "@/components/bank-feeds/transaction-list";
import { useBankAccounts, useBankFeedStats, useAutoMatch, useReconcileMatched } from "@/api/bank-feed";

export function BankFeeds() {
  const { isLoading: isAuthLoading } = useAuth();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { data: accounts, isLoading: accountsLoading } = useBankAccounts();

  const { data: stats } = useBankFeedStats(selectedAccountId || undefined);

  // Set first account as selected when accounts load
  useEffect(() => {
    if (accounts?.length && accounts[0] && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const autoMatchMutation = useAutoMatch();

  const reconcileMatchedMutation = useReconcileMatched();

  const handleImport = (accountId: string) => {
    setSelectedAccountId(accountId);
    setIsImportModalOpen(true);
  };

  const handleAutoMatch = () => {
    autoMatchMutation.mutate(
      selectedAccountId ? { bankAccountId: selectedAccountId } : undefined,
      {
        onSuccess: (result) => {
          toast.success(
            `Auto-matched ${result.matchedCount} transactions, suggested ${result.suggestedCount} matches`
          );
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  const handleReconcileMatched = () => {
    reconcileMatchedMutation.mutate(
      selectedAccountId ? { bankAccountId: selectedAccountId } : undefined,
      {
        onSuccess: (result) => {
          toast.success(`Reconciled ${result.reconciledCount} transactions`);
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  if (accountsLoading || isAuthLoading) {
    return <PageSkeleton title="Bank Feeds" description="Import and reconcile bank transactions" />;
  }

  return (
    <PageContainer>
      <PageHeader
        icon={DatabaseIcon}
        title="Bank Feeds"
        description="Import statements and reconcile transactions"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsAccountModalOpen(true)}>
              <Plus className="size-4" />
              Add Account
            </Button>
            {accounts?.length ? (
              <Button onClick={() => setIsImportModalOpen(true)}>
                <Upload className="size-4" />
                Import Statement
              </Button>
            ) : null}
          </div>
        }
      />

      {!accounts?.length ? (
        <EmptyState
          icon={DatabaseIcon}
          title="No bank accounts yet"
          description="Add a bank account to start importing and reconciling your transactions."
          action={
            <Button onClick={() => setIsAccountModalOpen(true)}>
              <Plus className="size-4" />
              Add Account
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Unmatched</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.unmatched || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>AI Suggested</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.suggested || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Matched</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.matched || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Reconciled</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{stats?.reconciled || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* AI Actions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SyncIcon className="size-5" />
                  <div>
                    <CardTitle className="text-base">AI Reconciliation</CardTitle>
                    <CardDescription>
                      Automatically match transactions with invoices and bills
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoMatch}
                    disabled={autoMatchMutation.isPending || !stats?.unmatched}
                  >
                    {autoMatchMutation.isPending ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <SyncIcon className="size-4" />
                    )}
                    {autoMatchMutation.isPending ? "Matching..." : "Auto Match"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleReconcileMatched}
                    disabled={reconcileMatchedMutation.isPending || !stats?.matched}
                  >
                    {reconcileMatchedMutation.isPending && (
                      <RefreshCw className="size-4 animate-spin" />
                    )}
                    {reconcileMatchedMutation.isPending ? "Reconciling..." : "Reconcile All"}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Account Tabs */}
          <Tabs
            value={selectedAccountId || accounts[0]?.id}
            onValueChange={setSelectedAccountId}
          >
            <TabsList>
              {accounts.map((account) => (
                <TabsTrigger key={account.id} value={account.id} className="gap-2">
                  <Building2 className="size-4" />
                  {account.accountName}
                  <Badge variant="outline" className="ml-1">
                    {account.currency}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {accounts.map((account) => (
              <TabsContent key={account.id} value={account.id} className="mt-6">
                <div className="space-y-4">
                  {/* Account Header */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="size-5 text-muted-foreground" />
                          <div>
                            <CardTitle className="text-base">{account.accountName}</CardTitle>
                            <CardDescription>
                              {account.bankName && `${account.bankName} • `}
                              {account.accountNumber ? `••••${account.accountNumber.slice(-4)}` : "No account number"}
                            </CardDescription>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleImport(account.id)}>
                          <Upload className="size-4" />
                          Import
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Transactions */}
                  <TransactionList bankAccountId={account.id} />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}

      <BankAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
      />

      <ImportTransactionsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        accounts={(accounts || []).map((a) => ({
          id: a.id,
          accountName: a.accountName,
          bankName: a.bankName || null,
        }))}
        preselectedAccountId={selectedAccountId}
      />
    </PageContainer>
  );
}
