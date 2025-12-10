import { InvoiceImageType } from "@/types/common/invoice";
import { XIcon, ImageIcon, PenTool } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { Label } from "../label";
import React, { forwardRef } from "react";

interface SheetImageSelectorTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  previewUrl?: string;
  type: InvoiceImageType;
  onRemove: () => void;
  label: string;
}

const SheetImageSelectorTrigger = forwardRef<HTMLDivElement, SheetImageSelectorTriggerProps>(
  ({ className, previewUrl, type, onRemove, label, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex w-full flex-col gap-2.5 cursor-pointer", className)} {...props}>
        <Label htmlFor="image-selector-trigger">{label}</Label>
        <div className="relative">
          {/* Drop area */}
          <div
            className="border-input hover:bg-accent/50 data-[dragging=true]:bg-accent/50 has-[input:focus]:border-ring has-[input:focus]:ring-ring/50 relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-none border border-dashed p-4 transition-colors has-disabled:pointer-events-none has-disabled:opacity-50 has-[img]:border-none has-[input:focus]:ring-[3px] sm:min-h-52"
          >
            {previewUrl ? (
              <div className="absolute inset-0">
                <img
                  src={previewUrl}
                  alt="Uploaded image"
                  className="size-full object-cover"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
                <div
                  className="bg-muted mb-2 flex size-7 shrink-0 items-center justify-center rounded-none sm:size-9"
                  aria-hidden="true"
                >
                  {type === "logo" ? <ImageIcon className="size-4" /> : <PenTool className="size-4" />}
                </div>
                <p className="text-[10px] font-medium sm:mb-1.5 sm:text-xs">Select Image From Assets</p>

                <p className="text-muted-foreground text-[10px]">Type: {type}</p>
              </div>
            )}
          </div>
          {previewUrl && (
            <div className="absolute top-4 right-4">
              <div
                className="focus-visible:border-ring focus-visible:ring-ring/50 z-50 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-[color,box-shadow] outline-none hover:bg-black/80 focus-visible:ring-[3px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                aria-label="Remove image"
              >
                <XIcon className="size-3" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

SheetImageSelectorTrigger.displayName = "SheetImageSelectorTrigger";

export default SheetImageSelectorTrigger;
