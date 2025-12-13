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
import { MatchingRulesSheet } from "@/components/bank-feeds/matching-rules-sheet";
import { useBankAccounts, useBankFeedStats, useAutoMatch, useReconcileMatched, useAcceptAllSuggestions } from "@/api/bank-feed";
import { CheckIcon, Sparkles } from "@/components/ui/icons";

export function BankFeeds() {
  const { isLoading: isAuthLoading } = useAuth();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const { data: accounts, isLoading: accountsLoading } = useBankAccounts();

  const { data: stats } = useBankFeedStats(selectedAccountId ?? undefined);

  // Set first account as selected when accounts load
  useEffect(() => {
    if (accounts?.length && accounts[0] && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const autoMatchMutation = useAutoMatch();
  const reconcileMatchedMutation = useReconcileMatched();
  const acceptAllSuggestionsMutation = useAcceptAllSuggestions();

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

  const handleAcceptAllSuggestions = () => {
    acceptAllSuggestionsMutation.mutate(
      selectedAccountId ? { bankAccountId: selectedAccountId } : undefined,
      {
        onSuccess: (result) => {
          toast.success(`Accepted ${result.acceptedCount} suggestions`);
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
            <MatchingRulesSheet />
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
            <Card className="border-warning/30 bg-warning/5">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between">
                  <span>Unmatched</span>
                  <Badge variant="warning" className="text-xs">{stats?.unmatched ?? 0}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-warning">{stats?.unmatched ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats?.depositCount ?? 0} deposits · {stats?.withdrawalCount ?? 0} withdrawals
                </div>
              </CardContent>
            </Card>
            <Card className="border-info/30 bg-info/5">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between">
                  <span>AI Suggested</span>
                  <Badge variant="info" className="text-xs">{stats?.suggested ?? 0}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-info">{stats?.suggested ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Ready for review
                </div>
              </CardContent>
            </Card>
            <Card className="border-success/30 bg-success/5">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between">
                  <span>Matched</span>
                  <Badge variant="success" className="text-xs">{stats?.matched ?? 0}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-success">{stats?.matched ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Ready to reconcile
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center justify-between">
                  <span>Reconciled</span>
                  <Badge variant="default" className="text-xs">{stats?.reconciled ?? 0}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-primary">{stats?.reconciled ?? 0}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Completed
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Actions - Workflow Steps */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-4">
                <Sparkles className="size-5 text-primary" />
                <div>
                  <CardTitle className="text-base">AI Reconciliation Workflow</CardTitle>
                  <CardDescription>
                    Follow these steps to reconcile your bank transactions
                  </CardDescription>
                </div>
              </div>

              {/* Workflow Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Step 1: Auto Match */}
                <div className="rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        1
                      </div>
                      <span className="font-medium text-sm">Auto Match</span>
                    </div>
                    {stats?.unmatched === 0 && (
                      <CheckIcon className="size-4 text-success" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    AI finds matching invoices, bills, and customers
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleAutoMatch}
                    disabled={autoMatchMutation.isPending || !stats?.unmatched}
                  >
                    {autoMatchMutation.isPending ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <SyncIcon className="size-4" />
                    )}
                    {autoMatchMutation.isPending ? "Matching..." : `Match ${stats?.unmatched ?? 0} Transactions`}
                  </Button>
                </div>

                {/* Step 2: Review & Accept */}
                <div className="rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-info/10 text-info flex items-center justify-center text-xs font-bold">
                        2
                      </div>
                      <span className="font-medium text-sm">Review Matches</span>
                    </div>
                    {stats?.suggested === 0 && stats?.matched && stats.matched > 0 && (
                      <CheckIcon className="size-4 text-success" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Review AI suggestions and accept or reject
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleAcceptAllSuggestions}
                    disabled={acceptAllSuggestionsMutation.isPending || !stats?.suggested}
                  >
                    {acceptAllSuggestionsMutation.isPending ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <CheckIcon className="size-4" />
                    )}
                    {acceptAllSuggestionsMutation.isPending ? "Accepting..." : `Accept ${stats?.suggested ?? 0} Suggestions`}
                  </Button>
                </div>

                {/* Step 3: Reconcile */}
                <div className="rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-success/10 text-success flex items-center justify-center text-xs font-bold">
                        3
                      </div>
                      <span className="font-medium text-sm">Reconcile</span>
                    </div>
                    {stats?.matched === 0 && stats?.reconciled && stats.reconciled > 0 && (
                      <CheckIcon className="size-4 text-success" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Post matched transactions to your accounts
                  </p>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleReconcileMatched}
                    disabled={reconcileMatchedMutation.isPending || !stats?.matched}
                  >
                    {reconcileMatchedMutation.isPending ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : null}
                    {reconcileMatchedMutation.isPending ? "Reconciling..." : `Reconcile ${stats?.matched ?? 0} Matched`}
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
        accounts={(accounts ?? []).map((a) => ({
          id: a.id,
          accountName: a.accountName,
          bankName: a.bankName ?? null,
        }))}
        preselectedAccountId={selectedAccountId}
      />
    </PageContainer>
  );
}
