"use client";

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField } from "./form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ControllerRenderProps, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { Check, ChevronsUpDown, InfoIcon, Loader2, Plus, TriangleAlertIcon, User } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCustomers } from "@/api/customers";
import { CustomerFormModal } from "@/components/customers/customer-form-modal";
import { cn } from "@/lib/utils";
import React, { useState, useCallback } from "react";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

interface FormCustomerSelectorProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
  label?: string;
  placeholder?: string;
  reactform: UseFormReturn<TFieldValues>;
  description?: string;
  isOptional?: boolean;
  onCustomerSelect?: (customer: Customer | null) => void;
}

/**
 * Inner component that uses the useFormField hook.
 * Extracted to comply with React's rules of hooks.
 */
function FormCustomerSelectorContent<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  field,
  selectorProps,
  customers,
  isLoading,
  filteredCustomers,
  open,
  setOpen,
  searchQuery,
  setSearchQuery,
  handleOpenCreateModal,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  selectorProps: FormCustomerSelectorProps<TFieldValues, TName> & { isOptional: boolean };
  customers: Customer[] | undefined;
  isLoading: boolean;
  filteredCustomers: Customer[];
  open: boolean;
  setOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleOpenCreateModal: () => void;
}) {
  const { error } = useFormField();
  const { isOptional, onCustomerSelect, ...props } = selectorProps;

  const selectedCustomer = customers?.find((c) => c.id === field.value);

  return (
    <FormItem className="w-full">
      {props.label && (
        <FormLabel className="flex items-center">
          <span className="text-xs capitalize">{props.label}</span>
          {isOptional && (
            <Badge size="xs" variant={error ? "destructive" : "secondary"}>
              Optional
            </Badge>
          )}
        </FormLabel>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between font-normal",
                !field.value && "text-muted-foreground",
                error && "border-red-500"
              )}
            >
              {selectedCustomer ? (
                <div className="flex items-center gap-2 truncate">
                  <User className="size-4 shrink-0" />
                  <span className="truncate">{selectedCustomer.name}</span>
                </div>
              ) : (
                <span>{props.placeholder || "Select a customer..."}</span>
              )}
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search customers..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              {/* Create New Customer Option - Always visible at top */}
              <CommandGroup>
                <CommandItem
                  value="__create_new__"
                  onSelect={handleOpenCreateModal}
                  className="text-primary"
                >
                  <Plus className="mr-2 size-4" />
                  <span className="font-medium">Create New Customer</span>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <CommandEmpty>
                  <div className="flex flex-col items-center gap-2 py-2">
                    <span>No customers found</span>
                    <span className="text-muted-foreground text-xs">
                      Try a different search or create a new customer above
                    </span>
                  </div>
                </CommandEmpty>
              ) : (
                <CommandGroup heading="Existing Customers">
                  {field.value && (
                    <CommandItem
                      value="__clear__"
                      onSelect={() => {
                        field.onChange(undefined);
                        onCustomerSelect?.(null);
                        setOpen(false);
                        setSearchQuery("");
                      }}
                      className="text-muted-foreground"
                    >
                      Clear selection
                    </CommandItem>
                  )}
                  {filteredCustomers.map((customer) => (
                    <CommandItem
                      key={customer.id}
                      value={customer.id}
                      onSelect={() => {
                        field.onChange(customer.id);
                        onCustomerSelect?.(customer);
                        setOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{customer.name}</span>
                        {customer.email && (
                          <span className="text-muted-foreground text-xs">
                            {customer.email}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-auto size-4",
                          field.value === customer.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {(error || props.description) && (
        <div className="-mt-0.5">
          {error ? (
            <div className="flex items-center gap-1">
              <TriangleAlertIcon className="text-destructive size-2.5" />
              <FormMessage />
            </div>
          ) : props.description ? (
            <div className="flex items-center gap-1">
              <InfoIcon className="text-muted-foreground size-2.5" />
              <FormDescription>{props.description}</FormDescription>
            </div>
          ) : null}
        </div>
      )}
    </FormItem>
  );
}

export const FormCustomerSelector = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  isOptional = false,
  onCustomerSelect,
  ...props
}: FormCustomerSelectorProps<TFieldValues, TName>) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch customers
  const { data: customers, isLoading, refetch } = useCustomers({ limit: 100 });

  // Filter customers based on search query
  const filteredCustomers = React.useMemo(() => {
    if (!customers) return [];
    if (!searchQuery) return customers;

    const query = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  // Handle opening the create modal
  const handleOpenCreateModal = useCallback(() => {
    setOpen(false); // Close the dropdown
    setIsCreateModalOpen(true);
  }, []);

  // Handle closing the create modal - refetch customers to include the new one
  const handleCloseCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
    // Refetch customers to include the newly created one
    refetch();
  }, [refetch]);

  return (
    <>
      <FormField
        control={props.reactform.control}
        name={props.name}
        render={({ field }) => (
          <FormCustomerSelectorContent
            field={field}
            selectorProps={{ isOptional, onCustomerSelect, ...props }}
            customers={customers}
            isLoading={isLoading}
            filteredCustomers={filteredCustomers}
            open={open}
            setOpen={setOpen}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            handleOpenCreateModal={handleOpenCreateModal}
          />
        )}
      />

      {/* Inline Customer Creation Modal */}
      <CustomerFormModal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
      />
    </>
  );
};
