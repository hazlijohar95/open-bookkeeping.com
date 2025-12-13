import { CalendarPenIcon } from "@/assets/icons";
import { UserIcon, MailIcon, Eye, Pencil, Trash2Icon, MoreHorizontalIcon } from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createColumnConfigHelper } from "@/components/ui/data-table-filter/core/filters";
import { HeaderColumnButton, FormatTableDateObject } from "@/components/ui/data-table";
import { createColumnHelper } from "@tanstack/react-table";
import type { Employee, EmployeeStatus } from "@/api/payroll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const columnHelper = createColumnHelper<Employee>();
const columnConfigHelper = createColumnConfigHelper<Employee>();

// Status badge colors
const statusColors: Record<EmployeeStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  probation: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  resigned: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  retired: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

interface EmployeeColumnsProps {
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

export const createEmployeeColumns = ({ onView, onEdit, onDelete }: EmployeeColumnsProps) => [
  columnHelper.accessor((row) => row.employeeCode, {
    id: "employeeCode",
    header: ({ column }) => <HeaderColumnButton column={column}>Code</HeaderColumnButton>,
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.employeeCode}</span>
    ),
  }),

  columnHelper.accessor((row) => `${row.firstName} ${row.lastName || ""}`.trim(), {
    id: "name",
    header: ({ column }) => <HeaderColumnButton column={column}>Name</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <UserIcon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <div className="font-medium">
            {row.original.firstName} {row.original.lastName}
          </div>
          {row.original.email && (
            <div className="text-sm text-muted-foreground">
              {row.original.email}
            </div>
          )}
        </div>
      </div>
    ),
  }),

  columnHelper.accessor((row) => row.department, {
    id: "department",
    header: ({ column }) => <HeaderColumnButton column={column}>Department</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-muted-foreground text-xs">
        {row.original.department || <span className="text-muted-foreground/50">-</span>}
      </div>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor((row) => row.position, {
    id: "position",
    header: ({ column }) => <HeaderColumnButton column={column}>Position</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-muted-foreground text-xs">
        {row.original.position || <span className="text-muted-foreground/50">-</span>}
      </div>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor((row) => row.status, {
    id: "status",
    header: ({ column }) => <HeaderColumnButton column={column}>Status</HeaderColumnButton>,
    cell: ({ row }) => (
      <Badge variant="outline" className={statusColors[row.original.status]}>
        {row.original.status.replace("_", " ")}
      </Badge>
    ),
  }),

  columnHelper.accessor((row) => row.dateJoined, {
    id: "dateJoined",
    header: ({ column }) => <HeaderColumnButton column={column}>Joined</HeaderColumnButton>,
    cell: ({ row }) => {
      const date = new Date(row.original.dateJoined);
      return <FormatTableDateObject date={date} />;
    },
  }),

  columnHelper.accessor(() => "actions", {
    id: "actions",
    header: () => null,
    cell: ({ row }) => {
      const employee = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontalIcon className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(employee)}>
              <Eye className="mr-2 size-4" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(employee)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(employee)}
            >
              <Trash2Icon className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
  }),
];

export const employeeColumnConfig = [
  columnConfigHelper
    .text()
    .id("employeeCode")
    .displayName("Code")
    .accessor((row) => row.employeeCode)
    .icon(UserIcon)
    .build(),

  columnConfigHelper
    .text()
    .id("name")
    .displayName("Name")
    .accessor((row) => `${row.firstName} ${row.lastName || ""}`.trim())
    .icon(UserIcon)
    .build(),

  columnConfigHelper
    .text()
    .id("email")
    .displayName("Email")
    .accessor((row) => row.email ?? "")
    .icon(MailIcon)
    .build(),

  columnConfigHelper
    .text()
    .id("department")
    .displayName("Department")
    .accessor((row) => row.department ?? "")
    .icon(UserIcon)
    .build(),

  columnConfigHelper
    .text()
    .id("position")
    .displayName("Position")
    .accessor((row) => row.position ?? "")
    .icon(UserIcon)
    .build(),

  columnConfigHelper
    .option()
    .id("status")
    .displayName("Status")
    .accessor((row) => row.status)
    .icon(UserIcon)
    .options([
      { label: "Active", value: "active", icon: <Badge variant="outline" className={statusColors.active}>active</Badge> },
      { label: "Probation", value: "probation", icon: <Badge variant="outline" className={statusColors.probation}>probation</Badge> },
      { label: "Terminated", value: "terminated", icon: <Badge variant="outline" className={statusColors.terminated}>terminated</Badge> },
      { label: "Resigned", value: "resigned", icon: <Badge variant="outline" className={statusColors.resigned}>resigned</Badge> },
      { label: "Retired", value: "retired", icon: <Badge variant="outline" className={statusColors.retired}>retired</Badge> },
    ])
    .build(),

  columnConfigHelper
    .date()
    .id("dateJoined")
    .displayName("Joined")
    .accessor((row) => row.dateJoined)
    .icon(CalendarPenIcon)
    .build(),
];
