import { CalendarPenIcon } from "@/assets/icons";
import { UserIcon, MailIcon, Phone, MapPin, Globe, Building2, Eye, Pencil, Trash2Icon } from "@/components/ui/icons";
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
import type { Vendor } from "@/types/common/vendor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const columnHelper = createColumnHelper<Vendor>();
const columnConfigHelper = createColumnConfigHelper<Vendor>();

interface VendorColumnsProps {
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
  onView?: (vendor: Vendor) => void;
}

export const createVendorColumns = ({ onEdit, onDelete, onView }: VendorColumnsProps) => [
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

  columnHelper.accessor((row) => row.paymentTermsDays, {
    id: "paymentTerms",
    header: ({ column }) => <HeaderColumnButton column={column}>Payment Terms</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-muted-foreground text-xs">
        {row.original.paymentTermsDays ? (
          <Badge variant="secondary" className="text-xs">
            Net {row.original.paymentTermsDays}
          </Badge>
        ) : (
          <span className="text-muted-foreground/50">-</span>
        )}
      </div>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor((row) => row.bankName, {
    id: "bank",
    header: ({ column }) => <HeaderColumnButton column={column}>Bank</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-muted-foreground max-w-[150px] truncate text-xs">
        {row.original.bankName || <span className="text-muted-foreground/50">-</span>}
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
      const vendor = row.original;

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
                  <DropdownMenuItem onClick={() => onView(vendor)}>
                    <Eye className="size-4" />
                    <span>View Details</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => onEdit(vendor)}>
                <Pencil className="size-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(vendor)}
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

export const vendorColumnConfig = [
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
    .text()
    .id("website")
    .displayName("Website")
    .accessor((row) => row.website ?? "")
    .icon(Globe)
    .build(),

  columnConfigHelper
    .text()
    .id("bankName")
    .displayName("Bank")
    .accessor((row) => row.bankName ?? "")
    .icon(Building2)
    .build(),

  columnConfigHelper
    .date()
    .id("createdAt")
    .displayName("Created At")
    .accessor((row) => row.createdAt)
    .icon(CalendarPenIcon)
    .build(),
];
