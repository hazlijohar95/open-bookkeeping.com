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
import ImageInput from "../image/image-input";
import { cn } from "@/lib/utils";

interface FormImageInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  className?: string;
  name: TName;
  onBase64Change?: (base64: string | undefined) => void;
  label?: string | undefined;
  description?: string | undefined;
  reactform: UseFormReturn<TFieldValues>;
  sublabel?: string | undefined;
  isOptional?: boolean;
  maxSizeMB?: number;
}

/**
 * Inner component that uses the useFormField hook.
 * Extracted to comply with React's rules of hooks.
 */
function FormImageInputContent<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  field,
  imageInputProps,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  imageInputProps: FormImageInputProps<TFieldValues, TName> & { className?: string; isOptional: boolean; maxSizeMB: number };
}) {
  const { error } = useFormField();
  const { className, isOptional, maxSizeMB, ...props } = imageInputProps;

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
        <ImageInput
          className={cn(
            className,
            Boolean(error) && "focus-visible:ring-destructive !border-destructive ring-transparent duration-200",
          )}
          onFileUpload={(file) => {
            field.onChange(file);
          }}
          defaultUrl={field.value}
          onBase64Change={(base64) => {
            if (props.onBase64Change) {
              props.onBase64Change(base64);
            }
          }}
          onFileRemove={() => {
            // remove the file from the field
            field.onChange("");
          }}
          maxSizeMB={maxSizeMB}
          {...props}
          {...field}
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

export const FormImageInput = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  className,
  isOptional = false,
  maxSizeMB = 5,
  ...props
}: FormImageInputProps<TFieldValues, TName>) => {
  return (
    <FormField
      control={props.reactform.control}
      name={props.name}
      render={({ field }) => (
        <FormImageInputContent
          field={field}
          imageInputProps={{ className, isOptional, maxSizeMB, ...props }}
        />
      )}
    />
  );
};
