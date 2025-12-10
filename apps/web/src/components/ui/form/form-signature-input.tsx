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
import SignatureInputModal from "../image/signature-input-modal";
import { InfoIcon, TriangleAlertIcon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface FormSignatureInputProps<
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
  isDarkMode?: boolean;
  maxSizeMB?: number;
}

/**
 * Inner component that uses the useFormField hook.
 * Extracted to comply with React's rules of hooks.
 */
function FormSignatureInputContent<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  field,
  signatureInputProps,
}: {
  field: ControllerRenderProps<TFieldValues, TName>;
  signatureInputProps: FormSignatureInputProps<TFieldValues, TName> & { className?: string; isOptional: boolean; maxSizeMB?: number };
}) {
  const { error } = useFormField();
  const { className, isOptional, maxSizeMB, ...props } = signatureInputProps;

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
        <SignatureInputModal
          isDarkMode={props.isDarkMode}
          className={cn(
            className,
            Boolean(error) && "focus-visible:ring-destructive !border-destructive ring-transparent duration-200",
          )}
          onSignatureChange={(signatureUrl) => {
            field.onChange(signatureUrl);
          }}
          defaultUrl={field.value}
          onBase64Change={(base64) => {
            if (props.onBase64Change) {
              props.onBase64Change(base64);
            }
          }}
          onFileRemove={() => {
            // reset field value
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

export const FormSignatureInput = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  className,
  isOptional = false,
  maxSizeMB,
  ...props
}: FormSignatureInputProps<TFieldValues, TName>) => {
  return (
    <FormField
      control={props.reactform.control}
      name={props.name}
      render={({ field }) => (
        <FormSignatureInputContent
          field={field}
          signatureInputProps={{ className, isOptional, maxSizeMB, ...props }}
        />
      )}
    />
  );
};
