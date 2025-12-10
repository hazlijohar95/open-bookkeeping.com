"use client";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "@/components/ui/form/form";
import { ControllerRenderProps, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { InfoIcon, TriangleAlertIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "../textarea";
import { cn } from "@/lib/utils";
import React from "react";

interface FormTextareaProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: TName;
  label?: string | undefined;
  description?: string | undefined;
  reactform: UseFormReturn<TFieldValues>;
  sublabel?: string | undefined;
  isOptional?: boolean;
}

/**
 * Inner component that uses the useFormField hook.
 * Extracted to comply with React's rules of hooks.
 */
function FormTextareaContent<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  field,
  textareaProps,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  textareaProps: FormTextareaProps<TFieldValues, TName> & { className?: string; isOptional: boolean };
}) {
  const { error } = useFormField();
  const { className, isOptional, ...props } = textareaProps;

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
      <FormControl>
        <Textarea
          className={cn(
            "resize-none",
            className,
            Boolean(error) && "focus-visible:ring-destructive !border-destructive ring-transparent duration-200",
          )}
          {...props}
          id={props.name}
          {...field}
          onChange={(e) => {
            field.onChange(e);
          }}
        />
      </FormControl>
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

export const FormTextarea = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  className,
  isOptional = false,
  ...props
}: FormTextareaProps<TFieldValues, TName>) => {
  return (
    <FormField
      control={props.reactform.control}
      name={props.name}
      render={({ field }) => (
        <FormTextareaContent
          field={field}
          textareaProps={{ className, isOptional, ...props }}
        />
      )}
    />
  );
};
