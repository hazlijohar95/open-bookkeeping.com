/**
 * Report Date Picker Component
 * Simple date picker with presets - follows design system
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarIcon, ChevronDownIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  className?: string;
}

interface SingleDatePickerProps {
  date: string;
  onDateChange: (date: string) => void;
  label?: string;
  className?: string;
}

// Date presets
function getDatePresets() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  return [
    {
      label: "This Month",
      start: new Date(year, month, 1).toISOString().split("T")[0] ?? "",
      end: now.toISOString().split("T")[0] ?? "",
    },
    {
      label: "Last Month",
      start: new Date(year, month - 1, 1).toISOString().split("T")[0] ?? "",
      end: new Date(year, month, 0).toISOString().split("T")[0] ?? "",
    },
    {
      label: "This Quarter",
      start:
        new Date(year, Math.floor(month / 3) * 3, 1)
          .toISOString()
          .split("T")[0] ?? "",
      end: now.toISOString().split("T")[0] ?? "",
    },
    {
      label: "This Year",
      start: `${year}-01-01`,
      end: now.toISOString().split("T")[0] ?? "",
    },
    {
      label: "Last Year",
      start: `${year - 1}-01-01`,
      end: `${year - 1}-12-31`,
    },
  ];
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
}: DateRangePickerProps) {
  const presets = getDatePresets();

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CalendarIcon className="text-muted-foreground size-4" />
      <Input
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        className="w-36"
      />
      <span className="text-muted-foreground text-sm">to</span>
      <Input
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        className="w-36"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            Presets
            <ChevronDownIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {presets.map((preset) => (
            <DropdownMenuItem
              key={preset.label}
              onClick={() => {
                onStartDateChange(preset.start);
                onEndDateChange(preset.end);
              }}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function SingleDatePicker({
  date,
  onDateChange,
  label = "As of",
  className,
}: SingleDatePickerProps) {
  const now = new Date();
  const year = now.getFullYear();

  const quickDates = [
    { label: "Today", value: now.toISOString().split("T")[0] ?? "" },
    {
      label: "End of Last Month",
      value:
        new Date(year, now.getMonth(), 0).toISOString().split("T")[0] ?? "",
    },
    {
      label: "End of Last Quarter",
      value:
        new Date(year, Math.floor(now.getMonth() / 3) * 3, 0)
          .toISOString()
          .split("T")[0] ?? "",
    },
    { label: "End of Last Year", value: `${year - 1}-12-31` },
  ];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CalendarIcon className="text-muted-foreground size-4" />
      <span className="text-muted-foreground text-sm">{label}:</span>
      <Input
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
        className="w-40"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            Presets
            <ChevronDownIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {quickDates.map((item) => (
            <DropdownMenuItem
              key={item.label}
              onClick={() => onDateChange(item.value)}
            >
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
