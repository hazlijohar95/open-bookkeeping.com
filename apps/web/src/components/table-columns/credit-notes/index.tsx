import {
  BoxIcon,
  DatabaseIcon,
  HardDriveIcon,
  HourglassStartIcon,
  IdBadgeIcon,
  PriorityMediumIcon,
  SortNumDescendingIcon,
  FileCheckIcon,
  FileBanIcon,
} from "@/assets/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createColumnConfigHelper } from "@/components/ui/data-table-filter/core/filters";
import { HeaderColumnButton, FormatTableDateObject } from "@/components/ui/data-table";
import type { CreditNoteStatusType, CreditNoteApiResponse, NoteReasonType } from "@/types/common/creditNote";
import { noteReasonLabels } from "@/types/common/creditNote";
import { Badge, BadgeVariants } from "@/components/ui/badge";
import { createColumnHelper } from "@tanstack/react-table";
import getSymbolFromCurrency from "currency-symbol-map";
import { Button } from "@/components/ui/button";
import { CalendarPenIcon } from "@/assets/icons";
import { Trash2 } from "@/components/ui/icons";
import { trpc } from "@/trpc/provider";

const columnHelper = createColumnHelper<CreditNoteApiResponse>();
const columnConfigHelper = createColumnConfigHelper<CreditNoteApiResponse>();

// Helper to calculate total from items
const getTotalValue = (fields: CreditNoteApiResponse["creditNoteFields"]) => {
  if (!fields?.items) return 0;
  return fields.items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unitPrice),
    0
  ).toFixed(2);
};

export const columns = [
  columnHelper.accessor((row) => row.type, {
    id: "type",
    header: ({ column }) => <HeaderColumnButton column={column}>Storage</HeaderColumnButton>,
    cell: ({ row }) => (
      <Badge variant={row.original.type === "local" ? "default" : "info"}>
        {row.original.type === "local" ? <HardDriveIcon /> : <DatabaseIcon />}
        {row.original.type === "local" ? "Local" : "Server"}
      </Badge>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor(
    (row) => `${row.creditNoteFields?.creditNoteDetails?.prefix || "CN-"}${row.creditNoteFields?.creditNoteDetails?.serialNumber || ""}`,
    {
      id: "serialNumber",
      header: ({ column }) => <HeaderColumnButton column={column}>Serial No</HeaderColumnButton>,
      cell: ({ row }) => (
        <div className="text-xs font-medium">
          {`${row.original.creditNoteFields?.creditNoteDetails?.prefix || "CN-"}${row.original.creditNoteFields?.creditNoteDetails?.serialNumber || ""}`}
        </div>
      ),
      enableSorting: false,
    },
  ),

  columnHelper.accessor((row) => row.reason, {
    id: "reason",
    header: ({ column }) => <HeaderColumnButton column={column}>Reason</HeaderColumnButton>,
    cell: ({ row }) => (
      <Badge variant="warning" className="capitalize">
        {noteReasonLabels[row.original.reason as NoteReasonType] || row.original.reason}
      </Badge>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor((row) => row.creditNoteFields?.clientDetails?.name, {
    id: "client",
    header: ({ column }) => <HeaderColumnButton column={column}>Client</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-xs">{row.original.creditNoteFields?.clientDetails?.name || "-"}</div>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor((row) => getTotalValue(row.creditNoteFields), {
    id: "total",
    header: ({ column }) => <HeaderColumnButton column={column}>Total</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-xs font-medium">{`${getSymbolFromCurrency(row.original.creditNoteFields?.creditNoteDetails?.currency || "MYR")}${getTotalValue(row.original.creditNoteFields)}`}</div>
    ),
  }),

  columnHelper.accessor((row) => row.creditNoteFields?.items?.length || 0, {
    id: "items",
    header: ({ column }) => <HeaderColumnButton column={column}>Items</HeaderColumnButton>,
    cell: ({ row }) => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary">
              <BoxIcon />
              <span>{row.original.creditNoteFields?.items?.length || 0}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{row.original.creditNoteFields?.items?.length || 0} items in this credit note</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
  }),

  columnHelper.accessor((row) => row.status, {
    id: "status",
    header: ({ column }) => <HeaderColumnButton column={column}>Status</HeaderColumnButton>,
    cell: ({ row }) => (
      <Badge className="capitalize" variant={getStatusBadgeVariant(row.original.status)}>
        {getStatusIcon(row.original.status)}
        {row.original.status}
      </Badge>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor((row) => row.createdAt, {
    id: "createdAt",
    header: ({ column }) => <HeaderColumnButton column={column}>Created At</HeaderColumnButton>,
    cell: ({ row }) => <FormatTableDateObject date={row.original.createdAt} />,
  }),

  columnHelper.accessor((row) => row.issuedAt, {
    id: "issuedAt",
    header: ({ column }) => <HeaderColumnButton column={column}>Issued At</HeaderColumnButton>,
    cell: ({ row }) =>
      row.original.issuedAt ? <FormatTableDateObject date={row.original.issuedAt} /> : <Badge variant="secondary">Not Issued</Badge>,
  }),

  // Actions
  columnHelper.accessor(() => "actions", {
    id: "actions",
    header: ({ column }) => <HeaderColumnButton column={column}>Actions</HeaderColumnButton>,
    cell: ({ row }) => {
      const { id, status } = row.original;
      const utils = trpc.useUtils();
      const updateStatusMutation = trpc.creditNote.updateStatus.useMutation({
        onSuccess: () => utils.creditNote.list.invalidate(),
      });
      const deleteMutation = trpc.creditNote.delete.useMutation({
        onSuccess: () => utils.creditNote.list.invalidate(),
      });

      return (
        <div key={id} className="flex flex-row items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="xs">
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {status === "draft" && (
                <DropdownMenuItem
                  onClick={() => updateStatusMutation.mutate({ id, status: "issued" })}
                >
                  <FileCheckIcon />
                  <span>Issue</span>
                </DropdownMenuItem>
              )}
              {status === "issued" && (
                <DropdownMenuItem
                  onClick={() => updateStatusMutation.mutate({ id, status: "applied" })}
                >
                  <FileCheckIcon />
                  <span>Mark as Applied</span>
                </DropdownMenuItem>
              )}
              {status === "draft" && (
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate({ id })}
                  className="text-destructive"
                >
                  <Trash2 className="size-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
              {(status === "issued" || status === "applied") && (
                <DropdownMenuItem
                  onClick={() => updateStatusMutation.mutate({ id, status: "cancelled" })}
                  className="text-destructive"
                >
                  <FileBanIcon />
                  <span>Cancel</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    enableSorting: false,
  }),
];

export const columnConfig = [
  columnConfigHelper
    .option()
    .id("type")
    .displayName("Storage")
    .accessor((row) => row.type)
    .icon(DatabaseIcon)
    .options([
      { label: "", value: "local", icon: <Badge variant="default">Local</Badge> },
      { label: "", value: "server", icon: <Badge variant="info">Server</Badge> },
    ])
    .build(),
  columnConfigHelper
    .text()
    .id("id")
    .displayName("ID")
    .accessor((row) => row.id)
    .icon(IdBadgeIcon)
    .build(),
  columnConfigHelper
    .date()
    .id("createdAt")
    .displayName("Created At")
    .accessor((row) => row.createdAt)
    .icon(CalendarPenIcon)
    .build(),
  columnConfigHelper
    .text()
    .id("serialNumber")
    .displayName("Serial No")
    .accessor((row) => `${row.creditNoteFields?.creditNoteDetails?.prefix || "CN-"}${row.creditNoteFields?.creditNoteDetails?.serialNumber || ""}`)
    .icon(SortNumDescendingIcon)
    .build(),
  columnConfigHelper
    .option()
    .id("status")
    .displayName("Status")
    .accessor((row) => row.status)
    .icon(PriorityMediumIcon)
    .options([
      { label: "", value: "draft", icon: <Badge variant="secondary">Draft</Badge> },
      { label: "", value: "issued", icon: <Badge variant="info">Issued</Badge> },
      { label: "", value: "applied", icon: <Badge variant="success">Applied</Badge> },
      { label: "", value: "cancelled", icon: <Badge variant="destructive">Cancelled</Badge> },
    ])
    .build(),
];

const getStatusBadgeVariant = (status: CreditNoteStatusType): BadgeVariants => {
  switch (status) {
    case "draft":
      return "secondary";
    case "issued":
      return "info";
    case "applied":
      return "success";
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
};

const getStatusIcon = (status: CreditNoteStatusType) => {
  switch (status) {
    case "draft":
      return <HourglassStartIcon />;
    case "issued":
      return <FileCheckIcon />;
    case "applied":
      return <FileCheckIcon />;
    case "cancelled":
      return <FileBanIcon />;
    default:
      return <HourglassStartIcon />;
  }
};
