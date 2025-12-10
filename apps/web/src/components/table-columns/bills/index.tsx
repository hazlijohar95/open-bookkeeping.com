import { CalendarPenIcon } from "@/assets/icons";
import { FileText, Hash, DollarSign, Calendar, Building2, Eye } from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createColumnConfigHelper } from "@/components/ui/data-table-filter/core/filters";
import { HeaderColumnButton, FormatTableDateObject } from "@/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";
import { Bill, BillStatus } from "@/types/common/bill";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Decimal from "decimal.js";

const columnHelper = createColumnHelper<Bill>();
const columnConfigHelper = createColumnConfigHelper<Bill>();

interface BillColumnsProps {
  onEdit: (bill: Bill) => void;
  onDelete: (bill: Bill) => void;
  onView?: (bill: Bill) => void;
}

const statusVariants: Record<BillStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  pending: { label: "Pending", className: "bg-warning/10 text-warning-foreground dark:text-warning" },
  paid: { label: "Paid", className: "bg-success/10 text-success" },
  overdue: { label: "Overdue", className: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelled", className: "bg-secondary text-muted-foreground" },
};

function calculateTotal(items: Bill["items"]): string {
  if (!items?.length) return "0.00";
  const total = items.reduce((sum, item) => {
    const qty = new Decimal(item.quantity || "0");
    const price = new Decimal(item.unitPrice || "0");
    return sum.plus(qty.times(price));
  }, new Decimal(0));
  return total.toFixed(2);
}

export const createBillColumns = ({ onEdit, onDelete, onView }: BillColumnsProps) => [
  columnHelper.accessor((row) => row.billNumber, {
    id: "billNumber",
    header: ({ column }) => <HeaderColumnButton column={column}>Bill #</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium">{row.original.billNumber}</span>
        {row.original.description && (
          <span className="text-muted-foreground max-w-[200px] truncate text-xs">
            {row.original.description}
          </span>
        )}
      </div>
    ),
  }),

  columnHelper.accessor((row) => row.vendor?.name, {
    id: "vendor",
    header: ({ column }) => <HeaderColumnButton column={column}>Vendor</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-sm">
        {row.original.vendor?.name || (
          <span className="text-muted-foreground/50">No vendor</span>
        )}
      </div>
    ),
  }),

  columnHelper.accessor((row) => row.status, {
    id: "status",
    header: ({ column }) => <HeaderColumnButton column={column}>Status</HeaderColumnButton>,
    cell: ({ row }) => {
      const status = row.original.status;
      const variant = statusVariants[status];
      return (
        <Badge variant="outline" className={cn("text-xs font-medium", variant.className)}>
          {variant.label}
        </Badge>
      );
    },
  }),

  columnHelper.accessor((row) => calculateTotal(row.items), {
    id: "amount",
    header: ({ column }) => <HeaderColumnButton column={column}>Amount</HeaderColumnButton>,
    cell: ({ row }) => {
      const total = calculateTotal(row.original.items);
      return (
        <div className="text-sm font-medium">
          {row.original.currency} {parseFloat(total).toLocaleString("en-MY", { minimumFractionDigits: 2 })}
        </div>
      );
    },
  }),

  columnHelper.accessor((row) => row.billDate, {
    id: "billDate",
    header: ({ column }) => <HeaderColumnButton column={column}>Bill Date</HeaderColumnButton>,
    cell: ({ row }) => <FormatTableDateObject date={row.original.billDate} />,
  }),

  columnHelper.accessor((row) => row.dueDate, {
    id: "dueDate",
    header: ({ column }) => <HeaderColumnButton column={column}>Due Date</HeaderColumnButton>,
    cell: ({ row }) => {
      if (!row.original.dueDate) {
        return <span className="text-muted-foreground/50">-</span>;
      }
      const isOverdue = new Date(row.original.dueDate) < new Date() && row.original.status !== "paid";
      return (
        <span className={cn(isOverdue && "text-destructive font-medium")}>
          <FormatTableDateObject date={row.original.dueDate} />
        </span>
      );
    },
  }),

  columnHelper.accessor(() => "actions", {
    id: "actions",
    header: ({ column }) => <HeaderColumnButton column={column}>Actions</HeaderColumnButton>,
    cell: ({ row }) => {
      const bill = row.original;

      return (
        <div className="flex flex-row items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="xs">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={() => onView(bill)}>
                  <Eye className="size-4" />
                  <span>View</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onEdit(bill)}>
                <Pencil className="size-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(bill)}
              >
                <Trash2 className="size-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    enableSorting: false,
  }),
];

export const billColumnConfig = [
  columnConfigHelper
    .text()
    .id("billNumber")
    .displayName("Bill Number")
    .accessor((row) => row.billNumber)
    .icon(Hash)
    .build(),

  columnConfigHelper
    .text()
    .id("vendor")
    .displayName("Vendor")
    .accessor((row) => row.vendor?.name ?? "")
    .icon(Building2)
    .build(),

  columnConfigHelper
    .option()
    .id("status")
    .displayName("Status")
    .accessor((row) => row.status)
    .options([
      { value: "draft", label: "Draft" },
      { value: "pending", label: "Pending" },
      { value: "paid", label: "Paid" },
      { value: "overdue", label: "Overdue" },
      { value: "cancelled", label: "Cancelled" },
    ])
    .icon(FileText)
    .build(),

  columnConfigHelper
    .number()
    .id("amount")
    .displayName("Amount")
    .accessor((row) => parseFloat(calculateTotal(row.items)))
    .icon(DollarSign)
    .build(),

  columnConfigHelper
    .date()
    .id("billDate")
    .displayName("Bill Date")
    .accessor((row) => row.billDate)
    .icon(Calendar)
    .build(),

  columnConfigHelper
    .date()
    .id("dueDate")
    .displayName("Due Date")
    .accessor((row) => row.dueDate ?? new Date())
    .icon(Calendar)
    .build(),

  columnConfigHelper
    .date()
    .id("createdAt")
    .displayName("Created At")
    .accessor((row) => row.createdAt)
    .icon(CalendarPenIcon)
    .build(),
];
