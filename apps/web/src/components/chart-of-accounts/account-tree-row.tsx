import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  MoreHorizontalIcon,
  Pencil,
  Plus,
  Lock,
  Eye,
  Trash2Icon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  accountTypeLabels,
  accountTypeColors,
} from "@/zod-schemas/chart-of-accounts";
import type { AccountTreeNode } from "./account-tree";

interface AccountTreeRowProps {
  account: AccountTreeNode;
  level: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
}

function formatBalance(balance: string): string {
  const value = parseFloat(balance);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(Math.abs(value));
}

export function AccountTreeRow({
  account,
  level,
  isExpanded,
  onToggleExpand,
  onEdit,
  onAddChild,
  onDelete,
}: AccountTreeRowProps) {
  const hasChildren = account.children.length > 0;
  const balance = parseFloat(account.balance);
  const indentStyle = { paddingLeft: `${level * 24 + 12}px` };

  return (
    <div
      className={cn(
        "flex items-center py-2.5 pr-3 hover:bg-muted/30 transition-colors group",
        account.isHeader && "bg-muted/20",
        !account.isActive && "opacity-50"
      )}
      style={indentStyle}
    >
      {/* Expand/Collapse Button */}
      <button
        onClick={onToggleExpand}
        className={cn(
          "size-6 flex items-center justify-center rounded hover:bg-muted mr-1",
          !hasChildren && "invisible"
        )}
        disabled={!hasChildren}
      >
        {hasChildren &&
          (isExpanded ? (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          ))}
      </button>

      {/* Account Code */}
      <div className="w-20 shrink-0">
        <span
          className={cn(
            "font-mono text-sm",
            account.isHeader ? "font-semibold" : "text-muted-foreground"
          )}
        >
          {account.code}
        </span>
      </div>

      {/* Account Name */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={cn(
            "truncate",
            account.isHeader && "font-medium"
          )}
        >
          {account.name}
        </span>
        {account.isSystemAccount && (
          <Lock className="size-3 text-muted-foreground shrink-0" />
        )}
      </div>

      {/* Type Badge */}
      <div className="w-24 shrink-0 hidden sm:block">
        <Badge
          variant="outline"
          className={cn("text-xs", accountTypeColors[account.accountType])}
        >
          {accountTypeLabels[account.accountType]}
        </Badge>
      </div>

      {/* Tax Code */}
      <div className="w-16 shrink-0 hidden md:block text-center">
        {account.sstTaxCode && account.sstTaxCode !== "none" && (
          <span className="text-xs text-muted-foreground uppercase">
            {account.sstTaxCode}
          </span>
        )}
      </div>

      {/* Balance */}
      <div className="w-32 shrink-0 text-right">
        {!account.isHeader && (
          <span
            className={cn(
              "font-medium tabular-nums",
              balance > 0
                ? account.normalBalance === "debit"
                  ? "text-foreground"
                  : "text-foreground"
                : balance < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
            )}
          >
            {formatBalance(account.balance)}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="w-8 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4" />
              <span>Edit Account</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddChild}>
              <Plus className="size-4" />
              <span>Add Child Account</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Eye className="size-4" />
              <span>View Transactions</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              disabled={account.isSystemAccount || hasChildren}
              className="text-destructive focus:text-destructive"
            >
              <Trash2Icon className="size-4" />
              <span>Delete Account</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
