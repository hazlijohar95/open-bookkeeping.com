import {
  BoxIcon,
  CalendarCheckIcon,
  DatabaseIcon,
  FilePenIcon,
  HardDriveIcon,
  HourglassStartIcon,
  IdBadgeIcon,
  PriorityMediumIcon,
  SortNumDescendingIcon,
} from "@/assets/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createColumnConfigHelper } from "@/components/ui/data-table-filter/core/filters";
import { HeaderColumnButton, FormatTableDateObject } from "@/components/ui/data-table";
import type { QuotationStatusType } from "@/types/common/quotation";
import { Badge, BadgeVariants } from "@/components/ui/badge";
import { createColumnHelper } from "@tanstack/react-table";
import { getQuotationTotalValue } from "@/constants/quotation-helpers";
import getSymbolFromCurrency from "currency-symbol-map";
import DeleteQuotationModal from "./deleteQuotationModal";
import UpdateStatusModal from "./updateStatusModal";
import ConvertToInvoiceModal from "./convertToInvoiceModal";
import { Quotation } from "@/types/common/quotation";
import { CalendarPenIcon } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Send, Clock, CheckCircle, XCircle, ArrowRightLeft, FileText } from "@/components/ui/icons";

const columnHelper = createColumnHelper<Quotation>();
const columnConfigHelper = createColumnConfigHelper<Quotation>();

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

  columnHelper.accessor((row) => row.id, {
    id: "id",
    header: ({ column }) => <HeaderColumnButton column={column}>ID</HeaderColumnButton>,
    cell: ({ row }) => <div className="text-muted-foreground text-xs">{row.original.id}</div>,
    enableSorting: false,
  }),

  columnHelper.accessor(
    (row) => `${row.quotationFields.quotationDetails.prefix}${row.quotationFields.quotationDetails.serialNumber}`,
    {
      id: "serialNumber",
      header: ({ column }) => <HeaderColumnButton column={column}>Serial No</HeaderColumnButton>,
      cell: ({ row }) => (
        <div className="text-xs">{`${row.original.quotationFields.quotationDetails.prefix}${row.original.quotationFields.quotationDetails.serialNumber}`}</div>
      ),
      enableSorting: false,
    },
  ),

  columnHelper.accessor((row) => row.quotationFields.clientDetails.name, {
    id: "client",
    header: ({ column }) => <HeaderColumnButton column={column}>Client</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-xs max-w-[150px] truncate" title={row.original.quotationFields.clientDetails.name}>
        {row.original.quotationFields.clientDetails.name}
      </div>
    ),
    enableSorting: false,
  }),

  columnHelper.accessor((row) => getQuotationTotalValue(row.quotationFields), {
    id: "total",
    header: ({ column }) => <HeaderColumnButton column={column}>Total</HeaderColumnButton>,
    cell: ({ row }) => (
      <div className="text-xs font-medium">{`${getSymbolFromCurrency(row.original.quotationFields.quotationDetails.currency)}${getQuotationTotalValue(row.original.quotationFields).toLocaleString()}`}</div>
    ),
  }),

  columnHelper.accessor((row) => row.quotationFields.items.length, {
    id: "items",
    header: ({ column }) => <HeaderColumnButton column={column}>Items</HeaderColumnButton>,
    cell: ({ row }) => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary">
              <BoxIcon />
              <span>{row.original.quotationFields.items.length}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{row.original.quotationFields.items.length} items in this quotation</p>
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

  columnHelper.accessor((row) => row.validUntil, {
    id: "validUntil",
    header: ({ column }) => <HeaderColumnButton column={column}>Valid Until</HeaderColumnButton>,
    cell: ({ row }) => {
      if (!row.original.validUntil) {
        return <Badge variant="secondary">No expiry</Badge>;
      }
      const validDate = new Date(row.original.validUntil);
      const isExpired = validDate < new Date();
      return (
        <Badge variant={isExpired ? "destructive" : "outline"}>
          {validDate.toLocaleDateString()}
        </Badge>
      );
    },
  }),

  columnHelper.accessor((row) => row.createdAt, {
    id: "createdAt",
    header: ({ column }) => <HeaderColumnButton column={column}>Created At</HeaderColumnButton>,
    cell: ({ row }) => <FormatTableDateObject date={row.original.createdAt} />,
  }),

  // Actions
  columnHelper.accessor(() => "actions", {
    id: "actions",
    header: ({ column }) => <HeaderColumnButton column={column}>Actions</HeaderColumnButton>,
    cell: ({ row }) => {
      const { id, type, status, convertedInvoiceId } = row.original;

      return (
        <div key={id} className="flex flex-row items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="xs">
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {status !== "converted" && (
                <>
                  <UpdateStatusModal quotationId={id} type={type} currentStatus={status} />
                  <Link to={`/edit/${type}/${id}`}>
                    <DropdownMenuItem>
                      <FilePenIcon />
                      <span>Edit</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <ConvertToInvoiceModal quotationId={id} type={type} currentStatus={status} />
                  <DropdownMenuSeparator />
                </>
              )}
              {status === "converted" && convertedInvoiceId && (
                <>
                  <Link to={`/edit/server/${convertedInvoiceId}`}>
                    <DropdownMenuItem className="text-primary">
                      <FileText className="size-4" />
                      <span>View Invoice</span>
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                </>
              )}
              <DeleteQuotationModal quotationId={id} type={type} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    enableSorting: false,
  }),
];

export const columnConfig = [
  // Storage
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
  // Id
  columnConfigHelper
    .text()
    .id("id")
    .displayName("ID")
    .accessor((row) => row.id)
    .icon(IdBadgeIcon)
    .build(),
  // Created At
  columnConfigHelper
    .date()
    .id("createdAt")
    .displayName("Created At")
    .accessor((row) => row.createdAt)
    .icon(CalendarPenIcon)
    .build(),
  // Valid Until
  columnConfigHelper
    .date()
    .id("validUntil")
    .displayName("Valid Until")
    .accessor((row) => row.validUntil ? new Date(row.validUntil) : null)
    .icon(CalendarCheckIcon)
    .build(),
  // Serial No
  columnConfigHelper
    .text()
    .id("serialNumber")
    .displayName("Serial No")
    .accessor((row) => `${row.quotationFields.quotationDetails.prefix}${row.quotationFields.quotationDetails.serialNumber}`)
    .icon(SortNumDescendingIcon)
    .build(),
  // Status
  columnConfigHelper
    .option()
    .id("status")
    .displayName("Status")
    .accessor((row) => row.status)
    .icon(PriorityMediumIcon)
    .options([
      { label: "", value: "draft", icon: <Badge variant="secondary">Draft</Badge> },
      { label: "", value: "sent", icon: <Badge variant="info">Sent</Badge> },
      { label: "", value: "accepted", icon: <Badge variant="success">Accepted</Badge> },
      { label: "", value: "rejected", icon: <Badge variant="destructive">Rejected</Badge> },
      { label: "", value: "expired", icon: <Badge variant="warning">Expired</Badge> },
      { label: "", value: "converted", icon: <Badge variant="default">Converted</Badge> },
    ])
    .build(),
];

const getStatusBadgeVariant = (status: QuotationStatusType): BadgeVariants => {
  switch (status) {
    case "draft":
      return "secondary";
    case "sent":
      return "info";
    case "accepted":
      return "success";
    case "rejected":
      return "destructive";
    case "expired":
      return "warning";
    case "converted":
      return "default";
    default:
      return "secondary";
  }
};

const getStatusIcon = (status: QuotationStatusType) => {
  switch (status) {
    case "draft":
      return <HourglassStartIcon />;
    case "sent":
      return <Send className="size-3" />;
    case "accepted":
      return <CheckCircle className="size-3" />;
    case "rejected":
      return <XCircle className="size-3" />;
    case "expired":
      return <Clock className="size-3" />;
    case "converted":
      return <ArrowRightLeft className="size-3" />;
    default:
      return <HourglassStartIcon />;
  }
};
