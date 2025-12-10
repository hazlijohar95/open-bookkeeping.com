"use client";

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, useFormField } from "./form";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ControllerRenderProps, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { InfoIcon, TriangleAlertIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import React from "react";

interface FormSelectProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: TName;
  children: React.ReactNode;
  label?: string | undefined;
  placeholder?: string | undefined;
  reactform: UseFormReturn<TFieldValues>;
  description?: string | undefined;
  isOptional?: boolean;
  sublabel?: string | undefined;
  alingContent?: "center" | "start" | "end" | undefined;
}

/**
 * Inner component that uses the useFormField hook.
 * Extracted to comply with React's rules of hooks.
 */
function FormSelectContent<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  field,
  selectProps,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  selectProps: FormSelectProps<TFieldValues, TName> & { className?: string; isOptional: boolean; alingContent: "center" | "start" | "end" };
}) {
  const { error } = useFormField();
  const { className, isOptional, alingContent, children, ...props } = selectProps;

  return (
    <FormItem className="w-full">
      {props.label ? (
        <FormLabel className="flex items-center">
          <span className="text-xs capitalize">{props.label}</span>
          {isOptional ? (
            <Badge size="xs" variant={Boolean(error) ? "destructive" : "secondary"}>
              {props.sublabel ?? "Optional"}
            </Badge>
          ) : null}
        </FormLabel>
      ) : null}
      <Select onValueChange={field.onChange} value={field.value}>
        <FormControl>
          <SelectTrigger
            className={cn(
              className,
              "w-full",
              // if error
              props.reactform.formState.errors[props.name] &&
                "border-destructive focus-visible:ring-destructive/20",
            )}
            {...props}
          >
            <SelectValue placeholder={props.placeholder} />
          </SelectTrigger>
        </FormControl>
        <SelectContent align={alingContent}>{children}</SelectContent>
      </Select>
      {/* Render form error message or form description. Give priority to error else description */}
      {error || props.description ? (
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
      ) : null}
    </FormItem>
  );
}

export const FormSelect = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  className,
  isOptional = false,
  alingContent = "center",
  ...props
}: FormSelectProps<TFieldValues, TName>) => {
  return (
    <FormField
      control={props.reactform.control}
      name={props.name}
      render={({ field }) => (
        <FormSelectContent
          field={field}
          selectProps={{ className, isOptional, alingContent, ...props }}
        />
      )}
    />
  );
};
