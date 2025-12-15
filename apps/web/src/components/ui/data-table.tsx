 
"use client";

import type {
  SortingState,
  VisibilityState,
  Column,
  RowSelectionState,
  DisplayColumnDef,
  AccessorFnColumnDef} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel
} from "@tanstack/react-table";
import { createTSTColumns, createTSTFilters } from "@/components/ui/data-table-filter/integrations/tanstack-table";
import type { ColumnConfig, ColumnDataType, FiltersState } from "@/components/ui/data-table-filter/core/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTableFilter, useDataTableFilters } from "@/components/ui/data-table-filter";
import { ArrowDownZaIcon, ArrowUpDownIcon, ArrowUpZaIcon, LayoutGridIcon, LayoutListIcon } from "@/components/ui/icons";
import { MobileList, MobileCardSkeleton } from "@/components/ui/mobile";
import { Button } from "@/components/ui/button";
import { FileAlertIcon } from "@/assets/icons";
import EmptySection from "./icon-placeholder";
import { useMemo, useState, useEffect, useCallback, memo } from "react";
import { Skeleton } from "./skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { mobile } from "@/lib/design-tokens";

// Memoized skeleton components to prevent re-creation on each render
const TABLE_SKELETON_COUNT = 10;
const CARD_SKELETON_COUNT = 5;

// View mode types
type ViewMode = "table" | "card";

// Memoized table row component to prevent unnecessary re-renders
// Using any for row type to maintain compatibility with TanStack Table's Row type
const MemoizedTableRow = memo(function MemoizedTableRow({
  row,
  onRowClick,
}: {
  row: any;
  onRowClick?: (row: any) => void;
}) {
  return (
    <TableRow
      key={row.id}
      data-state={row.getIsSelected() && "selected"}
      className={cn("transition-colors duration-150", onRowClick && "cursor-pointer")}
      onClick={() => onRowClick?.(row.original)}
    >
      {row.getVisibleCells().map((cell: any) => (
        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
      ))}
    </TableRow>
  );
});

// Memoized skeleton row for table loading state
const TableSkeletonRow = memo(function TableSkeletonRow({
  columnCount,
  index
}: {
  columnCount: number;
  index: number;
}) {
  return (
    <TableRow key={index} className="h-[53px]">
      {Array.from({ length: columnCount }).map((_, colIndex) => (
        <TableCell key={colIndex} className="py-3">
          <Skeleton className="h-5 w-full max-w-[200px] rounded-none" />
        </TableCell>
      ))}
    </TableRow>
  );
});

// Memoized card skeleton list
const CardSkeletonList = memo(function CardSkeletonList() {
  return (
    <div className="border rounded-md overflow-hidden">
      {Array.from({ length: CARD_SKELETON_COUNT }).map((_, i) => (
        <MobileCardSkeleton key={i} />
      ))}
    </div>
  );
});

// Memoized empty state component
const EmptyState = memo(function EmptyState() {
  return (
    <EmptySection
      icon={FileAlertIcon}
      title="No Data Found"
      description="No data found for the selected filters. Please try different filters or clear all filters to see all data."
    />
  );
});

interface DataTableProps<TData, TValue> {
  columns: (DisplayColumnDef<TData, any> | AccessorFnColumnDef<TData, TValue>)[];
  data: TData[];
  columnConfig: ColumnConfig<TData, ColumnDataType, any>[];
  isLoading?: boolean;
  defaultSorting?: SortingState;
  onRowClick?: (row: TData) => void;
  // Card view props
  renderCard?: (item: TData, index: number) => React.ReactNode;
  keyExtractor?: (item: TData, index: number) => string;
  defaultViewMode?: ViewMode;
  hideViewToggle?: boolean;
}

// Hook to detect mobile breakpoint
function useIsMobile(breakpoint: number = mobile.breakpoint.tablet) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  columnConfig,
  isLoading = false,
  defaultSorting = [],
  onRowClick,
  renderCard,
  keyExtractor,
  defaultViewMode = "table",
  hideViewToggle = false,
}: DataTableProps<TData, TValue>) {
  const isMobile = useIsMobile();
  const [filtersState, setFiltersState] = useState<FiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>(defaultSorting);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // View mode: auto-switch to card on mobile if renderCard is provided
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);

  // Auto-switch view mode based on screen size
  useEffect(() => {
    if (renderCard) {
      setViewMode(isMobile ? "card" : defaultViewMode);
    }
  }, [isMobile, renderCard, defaultViewMode]);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === "table" ? "card" : "table"));
  }, []);

  // Check if card view is active
  const isCardView = viewMode === "card" && renderCard;

  const {
    columns: TableFilterColumns,
    filters,
    actions,
    strategy,
  } = useDataTableFilters({
    strategy: "client",
    data: data,
    columnsConfig: columnConfig,
    filters: filtersState,
    onFiltersChange: setFiltersState,
  });

  // Memoize column definitions - include both deps to prevent stale columns
  const tstColumns = useMemo(
    () =>
      createTSTColumns({
        columns: columns,
        configs: TableFilterColumns,
      }),
    [columns, TableFilterColumns],
  );

  // Memoize filters transformation
  const tstFilters = useMemo(() => createTSTFilters(filters), [filters]);

  // Memoize column count for skeleton rendering
  const columnCount = useMemo(() => columns.length, [columns]);

  const table = useReactTable({
    data,
    columns: tstColumns,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters: tstFilters,
      columnVisibility,
      rowSelection,
    },
  });

  // Memoize filtered/sorted rows for card view to prevent recalculation
  // Note: We use data and sorting as deps since table.getRowModel() changes on each render
  const filteredRows = useMemo(
    () => table.getRowModel().rows,
     
    [data, sorting, tstFilters, columnVisibility]
  );

  // Memoize card items to prevent array recreation
  const cardItems = useMemo(
    () => filteredRows.map((row) => row.original),
    [filteredRows]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar with View Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <DataTableFilter filters={filters} columns={TableFilterColumns} actions={actions} strategy={strategy} />
        </div>
        {/* View Toggle Button - only show if renderCard is provided */}
        {renderCard && !hideViewToggle && (
          <Button
            variant="outline"
            size="sm"
            onClick={toggleViewMode}
            className="shrink-0 h-9"
            aria-label={viewMode === "table" ? "Switch to card view" : "Switch to table view"}
          >
            {viewMode === "table" ? (
              <LayoutGridIcon className="size-4" />
            ) : (
              <LayoutListIcon className="size-4" />
            )}
          </Button>
        )}
      </div>

      {/* Card View */}
      {isCardView ? (
        <div className="flex flex-col">
          {isLoading ? (
            <CardSkeletonList />
          ) : cardItems.length > 0 ? (
            <MobileList
              items={cardItems}
              renderItem={(item, index) => renderCard(item, index)}
              keyExtractor={keyExtractor || ((_, index) => String(index))}
              emptyState={<EmptyState />}
            />
          ) : (
            <div className="border rounded-md p-8">
              <EmptyState />
            </div>
          )}
        </div>
      ) : (
        /* Table View */
        <div className="max-w-[calc(100svw-2rem)] overflow-hidden rounded-none border md:max-w-full">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow className="bg-sidebar hover:!bg-sidebar" key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: TABLE_SKELETON_COUNT }).map((_, index) => (
                  <TableSkeletonRow key={index} columnCount={columnCount} index={index} />
                ))
              ) : filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <MemoizedTableRow key={row.id} row={row} onRowClick={onRowClick} />
                ))
              ) : (
                <TableRow className="hover:bg-background">
                  <TableCell colSpan={columnCount} className="text-muted-foreground/70 h-[400px] text-center">
                    <EmptyState />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex flex-row items-center justify-between gap-4">
        <div className="text-muted-foreground text-xs">
          Page <span className="text-secondary-foreground">{table.getState().pagination.pageIndex + 1}</span> of{" "}
          <span className="text-secondary-foreground">{table.getPageCount()}</span> Page
        </div>
        <div className="flex items-center justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export const HeaderColumnButton = memo(function HeaderColumnButton<TData>({
  column,
  children,
  disableChevron: initialDisableChevron = true,
}: {
  column: Column<TData>;
  children: React.ReactNode;
  disableChevron?: boolean;
}) {
  const isSorted = column.getIsSorted();

  // Disable chevron if sorting is not enabled
  const disableChevron = !column.getCanSort() || initialDisableChevron;

  // Memoize click handler
  const handleClick = useCallback(() => {
    column.toggleSorting(isSorted === "asc");
  }, [column, isSorted]);

  return (
    <button
      className={cn(
        disableChevron && "pr-0",
        "text-secondary-foreground -mx-2 my-auto inline-flex h-fit cursor-pointer items-center gap-2 rounded-none px-2 py-1.5 text-xs font-medium whitespace-nowrap select-none",
      )}
      onClick={handleClick}
    >
      {children}
      <div className={cn(disableChevron && "!hidden", "text-secondary-foreground/50 hidden sm:inline-block")}>
        {isSorted === false && <ArrowUpDownIcon size={12} />}
        {isSorted === "asc" && <ArrowUpZaIcon size={12} />}
        {isSorted === "desc" && <ArrowDownZaIcon size={12} />}
      </div>
    </button>
  );
}) as <TData>(props: { column: Column<TData>; children: React.ReactNode; disableChevron?: boolean }) => React.ReactElement;

// Memoized date formatting components to prevent unnecessary re-renders
export const FormatTableDate = memo(function FormatTableDate({ date }: { date: number }) {
  const formattedDate = useMemo(
    () => format(new Date(date * 1000), "dd/MM/yyyy - hh:mm a"),
    [date]
  );

  return (
    <div className="text-muted-foreground text-xs whitespace-nowrap">
      {formattedDate}
    </div>
  );
});

export const FormatTableDateString = memo(function FormatTableDateString({ date }: { date: string }) {
  const formattedDate = useMemo(
    () => format(new Date(date), "dd/MM/yyyy - hh:mm a"),
    [date]
  );

  return (
    <div className="text-muted-foreground text-xs whitespace-nowrap">
      {formattedDate}
    </div>
  );
});

export const FormatTableDateObject = memo(function FormatTableDateObject({ date }: { date: Date | null }) {
  const formattedDate = useMemo(
    () => (date ? format(date, "dd/MM/yyyy - hh:mm a") : null),
    [date]
  );

  if (!formattedDate) return null;

  return (
    <div className="text-muted-foreground text-xs whitespace-nowrap">
      {formattedDate}
    </div>
  );
});
