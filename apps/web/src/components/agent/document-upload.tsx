/**
 * Document Upload Component for AI Agent Chat
 * Provides drag-drop and click-to-upload functionality
 */
import { useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload } from "@/components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface PendingFile {
  id: string;
  file: File;
  preview?: string;
}

interface DocumentUploadProps {
  onFilesAdded: (files: PendingFile[]) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSize?: number; // bytes
  className?: string;
}

const ACCEPTED_FILE_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
};

export function DocumentUpload({
  onFilesAdded,
  disabled = false,
  maxFiles = 20,
  maxSize = 10 * 1024 * 1024, // 10MB
  className,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (acceptedFiles: File[]) => {
      const pendingFiles: PendingFile[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      }));
      onFilesAdded(pendingFiles);
    },
    [onFilesAdded]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: processFiles,
    accept: ACCEPTED_FILE_TYPES,
    maxSize,
    maxFiles,
    disabled,
    noClick: true, // We'll handle click separately with button
    noKeyboard: true,
  });

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    open();
  };

  return (
    <div {...getRootProps()} className={cn("relative", className)}>
      <input {...getInputProps()} ref={inputRef} />

      {/* Upload Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleButtonClick}
            disabled={disabled}
            className="h-[40px] w-[40px] rounded-none shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">Attach documents (PDF, images)</p>
        </TooltipContent>
      </Tooltip>

      {/* Drag overlay - shown when dragging over chat area */}
      {isDragActive && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-card border-2 border-dashed border-primary rounded-lg p-8 text-center">
            <Upload className="h-10 w-10 text-primary mx-auto mb-3" />
            <p className="font-medium text-sm">Drop files to upload</p>
            <p className="text-muted-foreground text-xs mt-1">
              PDF, PNG, JPG up to 10MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper component for chat area that enables drag-drop
 */
interface ChatDropZoneProps {
  children: React.ReactNode;
  onFilesAdded: (files: PendingFile[]) => void;
  disabled?: boolean;
}

export function ChatDropZone({
  children,
  onFilesAdded,
  disabled = false,
}: ChatDropZoneProps) {
  const processFiles = useCallback(
    (acceptedFiles: File[]) => {
      const pendingFiles: PendingFile[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      }));
      onFilesAdded(pendingFiles);
    },
    [onFilesAdded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: processFiles,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: 10 * 1024 * 1024,
    maxFiles: 20,
    disabled,
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div {...getRootProps()} className="relative flex-1 min-h-0 overflow-hidden">
      <input {...getInputProps()} className="hidden" />
      {children}

      {/* Drag overlay */}
      {isDragActive && (
        <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary flex items-center justify-center">
          <div className="text-center">
            <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="font-medium text-sm">Drop documents here</p>
            <p className="text-muted-foreground text-xs mt-1">
              PDF, images up to 10MB each
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
