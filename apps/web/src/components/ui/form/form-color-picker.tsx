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
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { InfoIcon, TriangleAlertIcon } from "@/components/ui/icons";
import { useResizeObserver } from "@mantine/hooks";
import { HexColorPicker } from "react-colorful";
import { Badge } from "@/components/ui/badge";
import { Button } from "../button";
import { cn } from "@/lib/utils";
import { Input } from "../input";
import React from "react";

interface FormColorPickerProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends React.InputHTMLAttributes<HTMLDivElement> {
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
function FormColorPickerContent<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  field,
  colorPickerProps,
  resizeRef,
  container,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  colorPickerProps: FormColorPickerProps<TFieldValues, TName> & { className?: string; isOptional: boolean };
  resizeRef: React.RefObject<HTMLDivElement>;
  container: { width?: number };
}) {
  const { error } = useFormField();
  const { className, isOptional, ...props } = colorPickerProps;

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
        <div ref={resizeRef} className={cn(className, "flex flex-row items-center gap-1.5")}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                style={{
                  backgroundColor: field.value,
                }}
                className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}
              ></Button>
            </PopoverTrigger>
            <PopoverContent
              className="p-0"
              align="start"
              style={{
                width: container.width ?? "180px",
              }}
            >
              <HexColorPicker
                style={{
                  width: "auto",
                }}
                color={field.value}
                onChange={field.onChange}
              />
            </PopoverContent>
          </Popover>
          <Input type="text" value={field.value} onChange={field.onChange} />
        </div>
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

export const FormColorPicker = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  className,
  isOptional = false,
  ...props
}: FormColorPickerProps<TFieldValues, TName>) => {
  const [resizeRef, container] = useResizeObserver();

  return (
    <FormField
      control={props.reactform.control}
      name={props.name}
      render={({ field }) => (
        <FormColorPickerContent
          field={field}
          colorPickerProps={{ className, isOptional, ...props }}
          resizeRef={resizeRef}
          container={container}
        />
      )}
    />
  );
};
