import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { debitNoteErrorAtom } from "@/global/atoms/debit-note-atom";
import { Button } from "@/components/ui/button";
import { FileAlertIcon, CircleXmarkIcon, TriangleWarningIcon } from "@/assets/icons";
import { useAtomValue } from "jotai";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const DebitNoteErrorsModal = () => {
  const debitNoteErrors = useAtomValue(debitNoteErrorAtom);
  const [open, setOpen] = useState(false);
  const [shake, setShake] = useState(false);

  const hasErrors = debitNoteErrors.length > 0;

  // Shake animation every 10 seconds when there are errors
  useEffect(() => {
    if (!hasErrors) return;

    const interval = setInterval(() => {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }, 10000);

    return () => clearInterval(interval);
  }, [hasErrors]);

  if (!hasErrors) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className={cn(
            "gap-2",
            shake && "animate-shake"
          )}
        >
          <TriangleWarningIcon className="size-4" />
          <span className="hidden sm:inline">Errors</span>
          <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/20 text-xs">
            {debitNoteErrors.length}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeaderContainer>
          <DialogIcon>
            <FileAlertIcon />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Validation Errors</DialogTitle>
            <DialogDescription>
              Please fix the following errors to generate the debit note
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <div className="max-h-[400px] overflow-y-auto">
          <div className="flex flex-col gap-3">
            {debitNoteErrors.map((error, index) => (
              <div
                key={index}
                className="rounded-md border border-destructive/20 bg-destructive/5 p-3"
              >
                <div className="flex items-start gap-2">
                  <CircleXmarkIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">
                      {error.message}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Path: {error.path.join(" → ")}
                    </p>
                    {error.code && (
                      <p className="text-xs text-muted-foreground">
                        Code: {error.code}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DebitNoteErrorsModal;
