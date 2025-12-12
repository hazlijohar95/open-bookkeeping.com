import { CalendarPenIcon } from "@/assets/icons";
import { UserIcon, MailIcon, Phone, MapPin, Eye, Pencil, Trash2Icon } from "@/components/ui/icons";
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
import type { Customer } from "@/types/common/customer";
import { Button } from "@/components/ui/button";

const columnHelper = createColumnHelper<Customer>();
const columnConfigHelper = createColumnConfigHelper<Customer>();

interface CustomerColumnsProps {
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onView?: (customer: Customer) => void;
}

export const createCustomerColumns = ({ onEdit, onDelete, onView }: CustomerColumnsProps) => [
  columnHelper.accessor((row) => row.name, {
    id: "name",
    header: ({ column }) => <HeaderColumnButton column={column}>Name</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium">{row.original.name}</span>
        {row.original.email && (
          <span className="text-muted-foreground text-xs">{row.original.email}</span>
        )}
      </div>
    ),
  }),

  columnHelper.accessor((row) => row.email, {
    id: "email",
    header: ({ column }) => <HeaderColumnButton column={column}>Email</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-muted-foreground text-xs">
        {row.original.email || <span className="text-muted-foreground/50">-</span>}
      </div>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor((row) => row.phone, {
    id: "phone",
    header: ({ column }) => <HeaderColumnButton column={column}>Phone</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-muted-foreground text-xs">
        {row.original.phone || <span className="text-muted-foreground/50">-</span>}
      </div>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor((row) => row.address, {
    id: "address",
    header: ({ column }) => <HeaderColumnButton column={column}>Address</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-muted-foreground max-w-[200px] truncate text-xs">
        {row.original.address || <span className="text-muted-foreground/50">-</span>}
      </div>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor((row) => row.createdAt, {
    id: "createdAt",
    header: ({ column }) => <HeaderColumnButton column={column}>Created</HeaderColumnButton>,
    cell: ({ row }) => <FormatTableDateObject date={row.original.createdAt} />,
  }),

  columnHelper.accessor(() => "actions", {
    id: "actions",
    header: ({ column }) => <HeaderColumnButton column={column}>Actions</HeaderColumnButton>,
    cell: ({ row }) => {
      const customer = row.original;

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
                <>
                  <DropdownMenuItem onClick={() => onView(customer)}>
                    <Eye className="size-4" />
                    <span>View Details</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => onEdit(customer)}>
                <Pencil className="size-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(customer)}
              >
                <Trash2Icon className="size-4" />
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

export const customerColumnConfig = [
  columnConfigHelper
    .text()
    .id("name")
    .displayName("Name")
    .accessor((row) => row.name)
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
    .id("phone")
    .displayName("Phone")
    .accessor((row) => row.phone ?? "")
    .icon(Phone)
    .build(),

  columnConfigHelper
    .text()
    .id("address")
    .displayName("Address")
    .accessor((row) => row.address ?? "")
    .icon(MapPin)
    .build(),

  columnConfigHelper
    .date()
    .id("createdAt")
    .displayName("Created At")
    .accessor((row) => row.createdAt)
    .icon(CalendarPenIcon)
    .build(),
];
