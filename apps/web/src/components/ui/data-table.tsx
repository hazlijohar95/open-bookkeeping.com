/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { useMemo, useState, useEffect, useCallback } from "react";
import { Skeleton } from "./skeleton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { mobile } from "@/lib/design-tokens";

// View mode types
type ViewMode = "table" | "card";

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

  const tstColumns = useMemo(
    () =>
      createTSTColumns({
        columns: columns, // own columns
        configs: TableFilterColumns, // advanced columns by bazza-ui
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [TableFilterColumns],
  );

  const tstFilters = useMemo(() => createTSTFilters(filters), [filters]);

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

  // Get filtered/sorted rows for card view
  const filteredRows = table.getRowModel().rows;

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
            <div className="border rounded-md overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <MobileCardSkeleton key={i} />
              ))}
            </div>
          ) : filteredRows.length > 0 ? (
            <MobileList
              items={filteredRows.map((row) => row.original)}
              renderItem={(item, index) => renderCard(item, index)}
              keyExtractor={keyExtractor || ((_, index) => String(index))}
              emptyState={
                <EmptySection
                  icon={FileAlertIcon}
                  title="No Data Found"
                  description="No data found for the selected filters."
                />
              }
            />
          ) : (
            <div className="border rounded-md p-8">
              <EmptySection
                icon={FileAlertIcon}
                title="No Data Found"
                description="No data found for the selected filters. Please try different filters or clear all filters to see all data."
              />
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
                Array.from({ length: 10 }).map((_, index) => (
                  <TableRow key={index} className="h-[53px]">
                    {columns.map((column) => (
                      <TableCell key={column.id} className="py-3">
                        <Skeleton className="h-5 w-full max-w-[200px] rounded-none" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn("transition-colors duration-150", onRowClick && "cursor-pointer")}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-background">
                  <TableCell colSpan={columns.length} className="text-muted-foreground/70 h-[400px] text-center">
                    <EmptySection
                      icon={FileAlertIcon}
                      title="No Data Found"
                      description="No data found for the selected filters. Please try different filters or clear all filters to see all data."
                    />
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

export function HeaderColumnButton<TData>({
  column,
  children,
  disableChevron = true,
}: {
  column: Column<TData>;
  children: React.ReactNode;
  disableChevron?: boolean;
}) {
  const isSorted = column.getIsSorted();

  // Disable chevron if sorting is not enabled
  disableChevron = !column.getCanSort();

  return (
    <button
      className={cn(
        disableChevron && "pr-0",
        "text-secondary-foreground -mx-2 my-auto inline-flex h-fit cursor-pointer items-center gap-2 rounded-none px-2 py-1.5 text-xs font-medium whitespace-nowrap select-none",
      )}
      onClick={() => column.toggleSorting(isSorted === "asc")}
    >
      {children}
      <div className={cn(disableChevron && "!hidden", "text-secondary-foreground/50 hidden sm:inline-block")}>
        {isSorted === false && <ArrowUpDownIcon size={12} />}
        {isSorted === "asc" && <ArrowUpZaIcon size={12} />}
        {isSorted === "desc" && <ArrowDownZaIcon size={12} />}
      </div>
    </button>
  );
}

export const FormatTableDate = ({ date }: { date: number }) => {
  return (
    <div className="text-muted-foreground text-xs whitespace-nowrap">
      {format(new Date(date * 1000), "dd/MM/yyyy - hh:mm a")}
    </div>
  );
};

export const FormatTableDateString = ({ date }: { date: string }) => {
  return (
    <div className="text-muted-foreground text-xs whitespace-nowrap">
      {format(new Date(date), "dd/MM/yyyy - hh:mm a")}
    </div>
  );
};

export const FormatTableDateObject = ({ date }: { date: Date | null }) => {
  if (!date) return null;

  return <div className="text-muted-foreground text-xs whitespace-nowrap">{format(date, "dd/MM/yyyy - hh:mm a")}</div>;
};
