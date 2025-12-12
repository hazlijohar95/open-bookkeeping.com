/**
 * Document Preview Component for AI Agent Chat
 * Shows pending files before upload with remove functionality
 */
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { X, FileTextIcon, ImageIcon, Loader2Icon } from "@/components/ui/icons";
import type { PendingFile } from "./document-upload";

interface DocumentPreviewProps {
  files: PendingFile[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  isUploading?: boolean;
  uploadProgress?: number; // 0-100
  className?: string;
}

export function DocumentPreview({
  files,
  onRemove,
  onClearAll,
  isUploading = false,
  className,
}: DocumentPreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className={cn("border-b bg-muted/20 p-2", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {files.length} file{files.length !== 1 ? "s" : ""} attached
        </span>
        {!isUploading && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <FilePreviewItem
            key={file.id}
            file={file}
            onRemove={() => onRemove(file.id)}
            disabled={isUploading}
          />
        ))}
      </div>

      {isUploading && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Loader2Icon className="h-3 w-3 animate-spin" />
          <span>Uploading documents...</span>
        </div>
      )}
    </div>
  );
}

interface FilePreviewItemProps {
  file: PendingFile;
  onRemove: () => void;
  disabled?: boolean;
}

function FilePreviewItem({ file, onRemove, disabled }: FilePreviewItemProps) {
  const isImage = file.file.type.startsWith("image/");
  const isPDF = file.file.type === "application/pdf";

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="group relative flex items-center gap-2 bg-background border rounded-sm px-2 py-1.5 max-w-[200px]">
      {/* Thumbnail or icon */}
      {isImage && file.preview ? (
        <img
          src={file.preview}
          alt={file.file.name}
          className="h-8 w-8 object-cover rounded-sm"
        />
      ) : isPDF ? (
        <div className="h-8 w-8 flex items-center justify-center bg-red-500/10 rounded-sm">
          <FileTextIcon className="h-4 w-4 text-red-500" />
        </div>
      ) : (
        <div className="h-8 w-8 flex items-center justify-center bg-muted rounded-sm">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate" title={file.file.name}>
          {file.file.name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatSize(file.file.size)}
        </p>
      </div>

      {/* Remove button */}
      {!disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1.5 -right-1.5 bg-background border shadow-sm"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

/**
 * Compact preview for when many files are attached (> 5)
 */
interface CompactDocumentPreviewProps {
  files: PendingFile[];
  onClearAll: () => void;
  isUploading?: boolean;
  className?: string;
}

export function CompactDocumentPreview({
  files,
  onClearAll,
  isUploading = false,
  className,
}: CompactDocumentPreviewProps) {
  if (files.length === 0) return null;

  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={cn("border-b bg-muted/20 p-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {files.slice(0, 3).map((file, i) => (
              <div
                key={file.id}
                className="h-6 w-6 rounded-sm border-2 border-background bg-muted flex items-center justify-center"
                style={{ zIndex: 3 - i }}
              >
                <FileTextIcon className="h-3 w-3 text-muted-foreground" />
              </div>
            ))}
            {files.length > 3 && (
              <div className="h-6 w-6 rounded-sm border-2 border-background bg-primary/10 flex items-center justify-center text-[10px] font-medium">
                +{files.length - 3}
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {files.length} files ({formatSize(totalSize)})
          </span>
        </div>

        {isUploading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2Icon className="h-3 w-3 animate-spin" />
            <span>Uploading...</span>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
