import { Check, ChevronsUpDown, UsersIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

interface Customer {
  id: string;
  name: string;
  email?: string | null;
}

interface CustomerSelectorProps {
  customers: Customer[];
  selectedId: string | null;
  onSelect: (customerId: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function CustomerSelector({
  customers,
  selectedId,
  onSelect,
  isLoading = false,
  placeholder = "Select customer...",
}: CustomerSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedCustomer = customers.find((c) => c.id === selectedId);

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedCustomer ? (
            <div className="flex items-center gap-2">
              <UsersIcon className="size-4 text-muted-foreground" />
              <span className="truncate">{selectedCustomer.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="SearchIcon customers..." />
          <CommandList>
            <CommandEmpty>No customer found.</CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.name}
                  onSelect={() => {
                    onSelect(customer.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      selectedId === customer.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{customer.name}</span>
                    {customer.email && (
                      <span className="text-xs text-muted-foreground">
                        {customer.email}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
