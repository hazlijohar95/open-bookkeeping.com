"use client";

import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckIcon, SearchIcon, ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";

// ============================================================================
// TYPES
// ============================================================================

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface BottomSheetSelectProps {
  options: SelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  title?: string;
  trigger?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BottomSheetSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  title = "Select",
  trigger,
  className,
  disabled,
}: BottomSheetSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  // Filter options
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        opt.description?.toLowerCase().includes(lower)
    );
  }, [options, search]);

  // Virtual list for performance
  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 56, // Option height
    overscan: 5,
  });

  // Selected option
  const selectedOption = options.find((opt) => opt.value === value);

  // Handle selection
  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setOpen(false);
    setSearch("");
  };

  // Reset search on close
  React.useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild disabled={disabled}>
        {trigger || (
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              "w-full justify-between h-12 text-left font-normal",
              !value && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">{selectedOption?.label || placeholder}</span>
            <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )}
      </DrawerTrigger>

      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>

        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-12 text-base"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>

        {/* Options List */}
        <div
          ref={listRef}
          className="overflow-auto"
          style={{ height: Math.min(filteredOptions.length * 56, 400) }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const option = filteredOptions[virtualRow.index];
              if (!option) return null;
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  disabled={option.disabled}
                  className={cn(
                    "absolute top-0 left-0 w-full flex items-center gap-3 px-4 py-3",
                    "transition-colors active:bg-accent",
                    isSelected && "bg-accent/50",
                    option.disabled && "opacity-50 cursor-not-allowed"
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {option.icon && (
                    <option.icon className="size-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{option.label}</p>
                    {option.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {option.description}
                      </p>
                    )}
                  </div>
                  {isSelected && <CheckIcon className="size-5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty State */}
        {filteredOptions.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No options found for "{search}"
          </div>
        )}

        {/* Safe area padding */}
        <div className="safe-bottom" />
      </DrawerContent>
    </Drawer>
  );
}

// ============================================================================
// MULTI SELECT VARIANT
// ============================================================================

export interface BottomSheetMultiSelectProps
  extends Omit<BottomSheetSelectProps, "value" | "onValueChange"> {
  value?: string[];
  onValueChange: (value: string[]) => void;
  maxSelections?: number;
}

export function BottomSheetMultiSelect({
  options,
  value = [],
  onValueChange,
  placeholder = "Select options",
  searchPlaceholder = "Search...",
  title = "Select",
  trigger,
  className,
  disabled,
  maxSelections,
}: BottomSheetMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const listRef = React.useRef<HTMLDivElement>(null);

  // Filter options
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const lower = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        opt.description?.toLowerCase().includes(lower)
    );
  }, [options, search]);

  // Virtual list for performance
  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  // Get selected labels
  const selectedLabels = options
    .filter((opt) => value.includes(opt.value))
    .map((opt) => opt.label);

  // Handle selection toggle
  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onValueChange(value.filter((v) => v !== optionValue));
    } else if (!maxSelections || value.length < maxSelections) {
      onValueChange([...value, optionValue]);
    }
  };

  // Reset search on close
  React.useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild disabled={disabled}>
        {trigger || (
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              "w-full justify-between h-12 text-left font-normal",
              value.length === 0 && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">
              {selectedLabels.length > 0
                ? selectedLabels.length > 2
                  ? `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`
                  : selectedLabels.join(", ")
                : placeholder}
            </span>
            <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        )}
      </DrawerTrigger>

      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <DrawerTitle>
            {title}
            {value.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({value.length} selected)
              </span>
            )}
          </DrawerTitle>
        </DrawerHeader>

        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-12 text-base"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>
        </div>

        {/* Options List */}
        <div
          ref={listRef}
          className="overflow-auto"
          style={{ height: Math.min(filteredOptions.length * 56, 400) }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const option = filteredOptions[virtualRow.index];
              if (!option) return null;
              const isSelected = value.includes(option.value);
              const isDisabledByMax = Boolean(
                maxSelections && !isSelected && value.length >= maxSelections
              );

              return (
                <button
                  key={option.value}
                  onClick={() =>
                    !option.disabled && !isDisabledByMax && handleToggle(option.value)
                  }
                  disabled={option.disabled || isDisabledByMax}
                  className={cn(
                    "absolute top-0 left-0 w-full flex items-center gap-3 px-4 py-3",
                    "transition-colors active:bg-accent",
                    isSelected && "bg-accent/50",
                    (option.disabled || isDisabledByMax) && "opacity-50 cursor-not-allowed"
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    className={cn(
                      "size-5 rounded border-2 flex items-center justify-center shrink-0",
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isSelected && <CheckIcon className="size-3 text-primary-foreground" />}
                  </div>
                  {option.icon && (
                    <option.icon className="size-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{option.label}</p>
                    {option.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {option.description}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Empty State */}
        {filteredOptions.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No options found for "{search}"
          </div>
        )}

        {/* Done Button */}
        <div className="p-4 border-t">
          <Button onClick={() => setOpen(false)} className="w-full h-12">
            Done
          </Button>
        </div>

        {/* Safe area padding */}
        <div className="safe-bottom" />
      </DrawerContent>
    </Drawer>
  );
}
