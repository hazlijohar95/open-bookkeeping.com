import { CalendarPenIcon } from "@/assets/icons";
import { Eye, Pencil, Trash2Icon, MoreHorizontalIcon, PlayIcon, CheckCircleIcon, XCircleIcon } from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createColumnConfigHelper } from "@/components/ui/data-table-filter/core/filters";
import { HeaderColumnButton, FormatTableDateObject } from "@/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";
import type { PayrollRun, PayrollRunStatus } from "@/api/payroll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

const columnHelper = createColumnHelper<PayrollRun>();
const columnConfigHelper = createColumnConfigHelper<PayrollRun>();

// Status badge colors
const statusColors: Record<PayrollRunStatus, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  calculating: "bg-primary/10 text-primary",
  pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  finalized: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusLabels: Record<PayrollRunStatus, string> = {
  draft: "Draft",
  calculating: "Calculating",
  pending_review: "Pending Review",
  approved: "Approved",
  finalized: "Finalized",
  paid: "Paid",
  cancelled: "Cancelled",
};

// Month names for display
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface PayrollRunColumnsProps {
  onView: (run: PayrollRun) => void;
  onEdit: (run: PayrollRun) => void;
  onDelete: (run: PayrollRun) => void;
  onCalculate?: (run: PayrollRun) => void;
  onApprove?: (run: PayrollRun) => void;
  onCancel?: (run: PayrollRun) => void;
}

export const createPayrollRunColumns = ({
  onView,
  onEdit,
  onDelete,
  onCalculate,
  onApprove,
  onCancel,
}: PayrollRunColumnsProps) => [
  columnHelper.accessor((row) => row.runNumber, {
    id: "runNumber",
    header: ({ column }) => <HeaderColumnButton column={column}>Run #</HeaderColumnButton>,
    cell: ({ row }) => (
      <span className="font-mono text-sm font-medium">{row.original.runNumber}</span>
    ),
  }),

  columnHelper.accessor((row) => `${monthNames[row.periodMonth - 1]} ${row.periodYear}`, {
    id: "period",
    header: ({ column }) => <HeaderColumnButton column={column}>Period</HeaderColumnButton>,
    cell: ({ row }) => (
      <div>
        <div className="font-medium">
          {monthNames[row.original.periodMonth - 1]} {row.original.periodYear}
        </div>
        {row.original.name && (
          <div className="text-sm text-muted-foreground">{row.original.name}</div>
        )}
      </div>
    ),
  }),

  columnHelper.accessor((row) => row.payDate, {
    id: "payDate",
    header: ({ column }) => <HeaderColumnButton column={column}>Pay Date</HeaderColumnButton>,
    cell: ({ row }) => {
      const date = row.original.payDate ? new Date(row.original.payDate) : null;
      return <FormatTableDateObject date={date} />;
    },
  }),

  columnHelper.accessor((row) => row.totalEmployees, {
    id: "totalEmployees",
    header: ({ column }) => <HeaderColumnButton column={column}>Employees</HeaderColumnButton>,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.totalEmployees ?? 0}
      </span>
    ),
  }),

  columnHelper.accessor((row) => row.totalGrossSalary, {
    id: "totalGrossSalary",
    header: ({ column }) => <HeaderColumnButton column={column}>Gross</HeaderColumnButton>,
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.totalGrossSalary
          ? formatCurrency(parseFloat(row.original.totalGrossSalary))
          : "-"}
      </span>
    ),
  }),

  columnHelper.accessor((row) => row.totalNetSalary, {
    id: "totalNetSalary",
    header: ({ column }) => <HeaderColumnButton column={column}>Net Pay</HeaderColumnButton>,
    cell: ({ row }) => (
      <span className="font-medium text-primary">
        {row.original.totalNetSalary
          ? formatCurrency(parseFloat(row.original.totalNetSalary))
          : "-"}
      </span>
    ),
  }),

  columnHelper.accessor((row) => row.status, {
    id: "status",
    header: ({ column }) => <HeaderColumnButton column={column}>Status</HeaderColumnButton>,
    cell: ({ row }) => (
      <Badge variant="outline" className={statusColors[row.original.status]}>
        {statusLabels[row.original.status]}
      </Badge>
    ),
  }),

  columnHelper.accessor(() => "actions", {
    id: "actions",
    header: () => null,
    cell: ({ row }) => {
      const run = row.original;
      const canEdit = run.status === "draft";
      const canCalculate = run.status === "draft";
      const canApprove = run.status === "pending_review";
      const canCancel = !["cancelled", "paid"].includes(run.status);
      const canDelete = run.status === "draft";

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(run)}>
              <Eye className="mr-2 size-4" />
              View
            </DropdownMenuItem>
            {canEdit && (
              <DropdownMenuItem onClick={() => onEdit(run)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
            )}
            {canCalculate && onCalculate && (
              <DropdownMenuItem onClick={() => onCalculate(run)}>
                <PlayIcon className="mr-2 size-4" />
                Calculate
              </DropdownMenuItem>
            )}
            {canApprove && onApprove && (
              <DropdownMenuItem onClick={() => onApprove(run)}>
                <CheckCircleIcon className="mr-2 size-4" />
                Approve
              </DropdownMenuItem>
            )}
            {canCancel && onCancel && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-orange-600"
                  onClick={() => onCancel(run)}
                >
                  <XCircleIcon className="mr-2 size-4" />
                  Cancel
                </DropdownMenuItem>
              </>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(run)}
                >
                  <Trash2Icon className="mr-2 size-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
  }),
];

export const payrollRunColumnConfig = [
  columnConfigHelper
    .text()
    .id("runNumber")
    .displayName("Run #")
    .accessor((row) => row.runNumber)
    .icon(CalendarPenIcon)
    .build(),

  columnConfigHelper
    .text()
    .id("period")
    .displayName("Period")
    .accessor((row) => `${monthNames[row.periodMonth - 1]} ${row.periodYear}`)
    .icon(CalendarPenIcon)
    .build(),

  columnConfigHelper
    .option()
    .id("status")
    .displayName("Status")
    .accessor((row) => row.status)
    .icon(CalendarPenIcon)
    .options([
      { label: "Draft", value: "draft", icon: <Badge variant="outline" className={statusColors.draft}>draft</Badge> },
      { label: "Calculating", value: "calculating", icon: <Badge variant="outline" className={statusColors.calculating}>calculating</Badge> },
      { label: "Pending Review", value: "pending_review", icon: <Badge variant="outline" className={statusColors.pending_review}>pending_review</Badge> },
      { label: "Approved", value: "approved", icon: <Badge variant="outline" className={statusColors.approved}>approved</Badge> },
      { label: "Finalized", value: "finalized", icon: <Badge variant="outline" className={statusColors.finalized}>finalized</Badge> },
      { label: "Paid", value: "paid", icon: <Badge variant="outline" className={statusColors.paid}>paid</Badge> },
      { label: "Cancelled", value: "cancelled", icon: <Badge variant="outline" className={statusColors.cancelled}>cancelled</Badge> },
    ])
    .build(),

  columnConfigHelper
    .number()
    .id("totalEmployees")
    .displayName("Employees")
    .accessor((row) => row.totalEmployees ?? 0)
    .icon(CalendarPenIcon)
    .build(),

  columnConfigHelper
    .date()
    .id("payDate")
    .displayName("Pay Date")
    .accessor((row) => row.payDate ?? "")
    .icon(CalendarPenIcon)
    .build(),
];
