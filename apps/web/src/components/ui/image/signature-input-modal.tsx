import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CreatePngFromBase64 } from "@/lib/invoice/create-png-from-base64";
import { AlertCircleIcon, LoaderCircleIcon, XIcon, MoonIcon, SunIcon, Undo2Icon } from "@/components/ui/icons";
import { ImageSparkleIcon, SignatureIcon } from "@/assets/icons";
import { createBlobUrl } from "@/lib/invoice/create-blob-url";
import { useFileUpload } from "@/hooks/use-file-upload";
import SignatureCanvas from "react-signature-canvas";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "../button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SignatureInputModalProps {
  title?: string;
  className?: string;
  defaultUrl?: string;
  isDarkMode?: boolean;
  maxSizeMB?: number;
  allowPreview?: boolean;
  isLoading?: boolean;
  disableIcon?: boolean;
  onBase64Change?: (base64: string | undefined) => void;
  onFileRemove?: () => void;
  onSignatureChange?: (signature: string) => void;
}

export default function SignatureInputModal({
  title = "Click here to draw your signature",
  //   className,
  defaultUrl,
  isDarkMode = false,
  maxSizeMB = 5,
  allowPreview = true,
  isLoading = false,
  disableIcon = false,
  onSignatureChange,
  onBase64Change,
  onFileRemove,
}: SignatureInputModalProps) {
  const [darkMode, setDarkMode] = useState<boolean>(isDarkMode);
  const [type, setType] = useState<"signature" | "upload" | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const signaturePadRef = useRef<SignatureCanvas>(null);
  const [isSignatureEmpty, setIsSignatureEmpty] = useState<boolean>(true);

  const maxSize = maxSizeMB * 1024 * 1024; // 5MB default

  const [
    { files, isDragging, errors },
    { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, removeFile, getInputProps },
  ] = useFileUpload({
    accept: "image/png, image/jpeg, image/jpg",
    maxSize,
    onFilesAdded: (files) => {
      // if no file is added, return
      if (!files[0]) return;

      // if signature change is not provided, return
      if (onSignatureChange) {
        onSignatureChange(files[0].preview ?? "");
      }

      // if base64 change is not provided, return
      if (onBase64Change) {
        // converting the file to base64
        const reader = new FileReader();
        reader.onload = () => {
          onBase64Change(reader.result as string);
        };
        reader.readAsDataURL(files[0].file as File);
      }
    },
  });

  const previewUrl = defaultUrl ?? "";

  // Handle Clear signature
  const handleClear = () => {
    signaturePadRef.current?.clear();
  };

  // Handle and SaveIcon signature
  const handleSave = () => {
    if (type !== "signature") return;
    //   get the signature canvas
    const signatureCanvasUri = signaturePadRef.current?.toDataURL("image/png");

    if (!signatureCanvasUri) {
      toast.error("No signature found", {
        description: "Please draw your signature and try again",
      });
      return;
    }

    // set it to onBase64Change
    if (onBase64Change && signatureCanvasUri) {
      onBase64Change(signatureCanvasUri);
    }

    // Convert to blob
    const signatureBlob = CreatePngFromBase64(signatureCanvasUri);

    if (!signatureBlob) {
      toast.error("No signature found", {
        description: "Please draw your signature and try again",
      });
      return;
    }

    const signatureBlobUrl = createBlobUrl({ blob: signatureBlob });

    // set it to onSignatureChange
    if (onSignatureChange && signatureBlob) {
      onSignatureChange(signatureBlobUrl);
    }

    // set modal to close
    setIsModalOpen(false);
    // reset signature
    signaturePadRef.current?.clear();
    setIsSignatureEmpty(true);
  };

  // Handle and Reset states when modal is closed
  const handleModalChange = (open: boolean) => {
    setIsModalOpen(open);

    if (!open) {
      //   reset signature
      signaturePadRef.current?.clear();
      setIsSignatureEmpty(true);
    }
  };

  return (
    <>
      <div className="relative">
        {/* Drop area */}
        <div className="border-input relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-none border border-dashed transition-colors has-disabled:pointer-events-none has-disabled:opacity-50 has-[img]:border-none">
          {previewUrl && allowPreview && !isLoading ? (
            <div className="absolute inset-0">
              <img src={previewUrl} alt="user signature" className="size-full object-cover" />
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2">
              <LoaderCircleIcon size={20} className={cn("animate-spin")} />
              <span className="text-muted-foreground text-xs">Uploading...</span>
            </div>
          ) : (
            <div className="flex h-full w-full flex-col">
              {/* Custom Signature */}
              <div
                role="button"
                onClick={() => {
                  setType("signature");
                  setIsModalOpen(true);
                }}
                className="hover:bg-accent/50 flex h-full flex-col items-center justify-center border-b border-dashed text-center"
              >
                {!disableIcon && (
                  <div
                    className="bg-muted mb-2 flex size-7 shrink-0 items-center justify-center rounded-none sm:size-9"
                    aria-hidden="true"
                  >
                    <SignatureIcon className="size-4 rotate-12" />
                  </div>
                )}
                <p className="text-[10px] font-medium sm:mb-1.5 sm:text-xs">{title}</p>
                <p className="text-muted-foreground text-[10px]">Canvas size: 330x330px</p>
              </div>
              {/* Image Input for signature */}
              <div
                role="button"
                onClick={() => {
                  setType("upload");
                  openFileDialog();
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                data-dragging={isDragging ?? undefined}
                className="hover:bg-accent/50 data-[dragging=true]:bg-accent/50 flex h-full flex-col items-center justify-center text-center"
              >
                <input {...getInputProps()} className="sr-only" aria-label="Upload file" />
                {!disableIcon && (
                  <div
                    className="bg-muted mb-2 flex size-7 shrink-0 items-center justify-center rounded-none sm:size-9"
                    aria-hidden="true"
                  >
                    <ImageSparkleIcon className="size-4" />
                  </div>
                )}
                <p className="text-[10px] font-medium sm:mb-1.5 sm:text-xs">Upload Signature</p>
                {errors.length > 0 ? (
                  <div className="flex items-center gap-1 text-[10px] text-destructive" role="alert">
                    {!disableIcon && <AlertCircleIcon className="size-3 shrink-0" />}
                    <span>{errors[0]}</span>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-[10px]">Max size: {maxSizeMB * 1000}Kb (PNG, JPG)</p>
                )}
              </div>
            </div>
          )}
        </div>
        {previewUrl && allowPreview && !isLoading && (
          <div className="absolute top-4 right-4">
            <button
              type="button"
              className="focus-visible:border-ring focus-visible:ring-ring/50 z-50 flex size-5 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white transition-[color,box-shadow] outline-none hover:bg-black/80 focus-visible:ring-[3px]"
              onClick={(e) => {
                e.preventDefault();

                const fileId = files[0]?.id;
                if (fileId) {
                  removeFile(fileId);
                }

                if (onFileRemove) {
                  onFileRemove();
                }
                if (onBase64Change) {
                  onBase64Change(undefined);
                }
              }}
              aria-label="Remove image"
            >
              <XIcon className="size-3" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {/* Signature Input Modal */}
      <Dialog open={isModalOpen} onOpenChange={handleModalChange}>
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-none bg-primary/10">
                <SignatureIcon className="size-4 rotate-12 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Draw Signature</h2>
                <p className="text-xs text-muted-foreground">Sign in the canvas below</p>
              </div>
            </div>
            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className={cn(
                "flex size-8 items-center justify-center rounded-none transition-all",
                darkMode
                  ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              )}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={darkMode ? "moon" : "sun"}
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ duration: 0.15 }}
                >
                  {darkMode ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
                </motion.div>
              </AnimatePresence>
            </button>
          </div>

          {/* Canvas Area */}
          <div className="relative p-5">
            {/* Signature canvas container */}
            <div
              className={cn(
                "relative overflow-hidden rounded-none border-2 border-dashed transition-colors",
                darkMode
                  ? "border-zinc-700 bg-zinc-900"
                  : "border-zinc-200 bg-zinc-50"
              )}
            >
              {/* Clear button - appears when drawing */}
              <AnimatePresence>
                {!isSignatureEmpty && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.8, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    onClick={handleClear}
                    className={cn(
                      "absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-none px-3 py-1.5 text-xs font-medium transition-colors",
                      darkMode
                        ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                        : "bg-white text-zinc-600 hover:bg-zinc-50"
                    )}
                  >
                    <Undo2Icon className="size-3" />
                    Clear
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Hint text - fades when drawing */}
              <AnimatePresence>
                {isSignatureEmpty && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  >
                    <p className={cn(
                      "text-sm select-none",
                      darkMode ? "text-zinc-600" : "text-zinc-300"
                    )}>
                      Sign here
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <SignatureCanvas
                key={`signature-canvas-${darkMode}`}
                ref={signaturePadRef}
                onBegin={() => setIsSignatureEmpty(false)}
                penColor={darkMode ? "#ffffff" : "#18181b"}
                backgroundColor={darkMode ? "#18181b" : "#fafafa"}
                canvasProps={{
                  className: "signature-canvas w-full h-full max-w-[400px] max-h-[250px] min-w-[300px] min-h-[200px]",
                  style: { touchAction: "none" }
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleModalChange(false)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSignatureEmpty}
              className="min-w-[80px]"
            >
              SaveIcon
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
