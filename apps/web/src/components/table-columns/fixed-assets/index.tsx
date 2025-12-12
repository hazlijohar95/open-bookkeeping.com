import { WarehouseIcon } from "@/assets/icons";
import {
  Hash,
  CurrencyDollarIcon,
  CalendarIcon,
  Building2,
  Eye,
  Edit,
  PlayIcon,
  Trash2Icon,
  MoreHorizontalIcon,
} from "@/components/ui/icons";
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
import { type FixedAsset, type FixedAssetStatus } from "@/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

const columnHelper = createColumnHelper<FixedAsset>();
const columnConfigHelper = createColumnConfigHelper<FixedAsset>();

interface FixedAssetColumnsProps {
  onView: (asset: FixedAsset) => void;
  onEdit: (asset: FixedAsset) => void;
  onActivate: (asset: FixedAsset) => void;
  onDelete: (asset: FixedAsset) => void;
}

const statusVariants: Record<FixedAssetStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  fully_depreciated: { label: "Fully Depreciated", variant: "outline" },
  disposed: { label: "Disposed", variant: "destructive" },
};

export const createFixedAssetColumns = ({
  onView,
  onEdit,
  onActivate,
  onDelete,
}: FixedAssetColumnsProps) => [
  columnHelper.accessor((row) => row.assetCode, {
    id: "assetCode",
    header: ({ column }) => <HeaderColumnButton column={column}>Code</HeaderColumnButton>,
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.original.assetCode}</span>
    ),
  }),

  columnHelper.accessor((row) => row.name, {
    id: "name",
    header: ({ column }) => <HeaderColumnButton column={column}>Name</HeaderColumnButton>,
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.name}</div>
        {row.original.category && (
          <div className="text-xs text-muted-foreground">
            {row.original.category.name}
          </div>
        )}
      </div>
    ),
  }),

  columnHelper.accessor((row) => row.acquisitionCost, {
    id: "acquisitionCost",
    header: ({ column }) => <HeaderColumnButton column={column}>Cost</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-sm font-medium">
        {formatCurrency(parseFloat(row.original.acquisitionCost))}
      </div>
    ),
  }),

  columnHelper.accessor((row) => row.netBookValue, {
    id: "netBookValue",
    header: ({ column }) => <HeaderColumnButton column={column}>Net Book Value</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-sm font-medium">
        {formatCurrency(parseFloat(row.original.netBookValue))}
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
        <Badge variant={variant.variant}>
          {variant.label}
        </Badge>
      );
    },
  }),

  columnHelper.accessor((row) => row.acquisitionDate, {
    id: "acquisitionDate",
    header: ({ column }) => <HeaderColumnButton column={column}>Acquired</HeaderColumnButton>,
    cell: ({ row }) => (
      <FormatTableDateObject date={new Date(row.original.acquisitionDate)} />
    ),
  }),

  columnHelper.accessor(() => "actions", {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => {
      const asset = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(asset)}>
              <Eye className="size-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {asset.status === "draft" && (
              <>
                <DropdownMenuItem onClick={() => onEdit(asset)}>
                  <Edit className="size-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onActivate(asset)}>
                  <PlayIcon className="size-4 mr-2" />
                  Activate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(asset)}
                  className="text-destructive"
                >
                  <Trash2Icon className="size-4 mr-2" />
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

export const fixedAssetColumnConfig = [
  columnConfigHelper
    .text()
    .id("assetCode")
    .displayName("Asset Code")
    .accessor((row) => row.assetCode)
    .icon(Hash)
    .build(),

  columnConfigHelper
    .text()
    .id("name")
    .displayName("Name")
    .accessor((row) => row.name)
    .icon(WarehouseIcon)
    .build(),

  columnConfigHelper
    .text()
    .id("category")
    .displayName("Category")
    .accessor((row) => row.category?.name ?? "")
    .icon(Building2)
    .build(),

  columnConfigHelper
    .option()
    .id("status")
    .displayName("Status")
    .accessor((row) => row.status)
    .options([
      { value: "draft", label: "Draft" },
      { value: "active", label: "Active" },
      { value: "fully_depreciated", label: "Fully Depreciated" },
      { value: "disposed", label: "Disposed" },
    ])
    .icon(WarehouseIcon)
    .build(),

  columnConfigHelper
    .number()
    .id("acquisitionCost")
    .displayName("Acquisition Cost")
    .accessor((row) => parseFloat(row.acquisitionCost))
    .icon(CurrencyDollarIcon)
    .build(),

  columnConfigHelper
    .number()
    .id("netBookValue")
    .displayName("Net Book Value")
    .accessor((row) => parseFloat(row.netBookValue))
    .icon(CurrencyDollarIcon)
    .build(),

  columnConfigHelper
    .date()
    .id("acquisitionDate")
    .displayName("Acquisition Date")
    .accessor((row) => new Date(row.acquisitionDate))
    .icon(CalendarIcon)
    .build(),
];
