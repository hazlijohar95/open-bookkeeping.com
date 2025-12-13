import { useState, useMemo } from "react";
import { AccountTreeRow } from "./account-tree-row";
import type { Account } from "@/api/chart-of-accounts";

// Re-export Account type as AccountTreeNode for backward compatibility
export type AccountTreeNode = Account;

interface AccountTreeProps {
  accounts: Account[];
  searchQuery?: string;
  onEditAccount: (account: Account) => void;
  onAddChildAccount: (account: Account) => void;
  onDeleteAccount: (account: Account) => void;
}

function filterAccounts(
  accounts: AccountTreeNode[],
  query: string
): AccountTreeNode[] {
  if (!query) return accounts;

  const lowerQuery = query.toLowerCase();

  return accounts
    .map((account) => {
      const matchesSearch =
        account.code.toLowerCase().includes(lowerQuery) ||
        account.name.toLowerCase().includes(lowerQuery);

      const filteredChildren = filterAccounts(account.children, query);

      if (matchesSearch || filteredChildren.length > 0) {
        return {
          ...account,
          children: filteredChildren,
        };
      }

      return null;
    })
    .filter((account): account is AccountTreeNode => account !== null);
}

export function AccountTree({
  accounts,
  searchQuery = "",
  onEditAccount,
  onAddChildAccount,
  onDeleteAccount,
}: AccountTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Initially expand root-level headers
    const initialExpanded = new Set<string>();
    accounts.forEach((account) => {
      if (account.isHeader && account.children.length > 0) {
        initialExpanded.add(account.id);
      }
    });
    return initialExpanded;
  });

  const filteredAccounts = useMemo(
    () => filterAccounts(accounts, searchQuery),
    [accounts, searchQuery]
  );

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: AccountTreeNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          allIds.add(node.id);
          collectIds(node.children);
        }
      });
    };
    collectIds(accounts);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const renderTree = (nodes: AccountTreeNode[], level: number = 0) => {
    return nodes.map((account) => (
      <div key={account.id}>
        <AccountTreeRow
          account={account}
          level={level}
          isExpanded={expandedIds.has(account.id)}
          onToggleExpand={() => toggleExpanded(account.id)}
          onEdit={() => onEditAccount(account)}
          onAddChild={() => onAddChildAccount(account)}
          onDelete={() => onDeleteAccount(account)}
        />
        {account.children.length > 0 && expandedIds.has(account.id) && (
          <div>{renderTree(account.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  if (filteredAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border bg-muted/30">
        <div className="text-muted-foreground text-sm">No accounts found</div>
        {searchQuery && (
          <div className="text-muted-foreground/70 text-xs mt-1">
            Try adjusting your search
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
        <div className="text-sm font-medium text-muted-foreground">
          {filteredAccounts.length} root account
          {filteredAccounts.length !== 1 ? "s" : ""}
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Expand all
          </button>
          <span className="text-muted-foreground/50">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="divide-y">{renderTree(filteredAccounts)}</div>
    </div>
  );
}
