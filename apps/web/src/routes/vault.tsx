import { useState, useCallback, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/ui/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeletons";
import { useQuery } from "@tanstack/react-query";
import {
  vaultKeys,
  useDocumentCounts,
  useProcessingAvailable,
  useProcessingResult,
  useUploadDocument,
  useRenameDocument,
  useDeleteDocument,
  useProcessDocument,
  useCreateBillFromDocument,
  type VaultDocument,
} from "@/api/vault";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import {
  FolderFeatherIcon,
  FileFeatherIcon,
  ReceiptIcon,
  ImageSparkleIcon,
  BoxIcon,
  FileDownloadIcon,
  TrashIcon,
  FilePenIcon,
  InboxArrowDownIcon,
} from "@/assets/icons";
import {
  MoreVertical,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  FileText,
  Building2,
  ArrowRight,
  Zap,
  Eye,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle2,
  Clock,
  Brain,
  ChevronRight,
} from "@/components/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VaultCategory, ProcessingStatus } from "@/types/common/vault";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: VaultCategory | "all"; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <FolderFeatherIcon className="size-4" /> },
  { value: "invoices", label: "Invoices", icon: <ReceiptIcon className="size-4" /> },
  { value: "bills", label: "Bills", icon: <FileText className="size-4" /> },
  { value: "statements", label: "Statements", icon: <Building2 className="size-4" /> },
  { value: "receipts", label: "Receipts", icon: <ReceiptIcon className="size-4" /> },
  { value: "contracts", label: "Contracts", icon: <FileFeatherIcon className="size-4" /> },
  { value: "tax_documents", label: "Tax Docs", icon: <FileFeatherIcon className="size-4" /> },
  { value: "images", label: "Images", icon: <ImageSparkleIcon className="size-4" /> },
  { value: "other", label: "Other", icon: <BoxIcon className="size-4" /> },
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(mimeType: string, className = "size-8") {
  if (mimeType.startsWith("image/")) return <ImageSparkleIcon className={cn(className, "text-info")} />;
  if (mimeType === "application/pdf") return <FileFeatherIcon className={cn(className, "text-destructive")} />;
  if (mimeType.includes("word")) return <FileFeatherIcon className={cn(className, "text-primary")} />;
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
    return <ReceiptIcon className={cn(className, "text-success")} />;
  return <BoxIcon className={cn(className, "text-muted-foreground")} />;
}

function getDocumentTypeLabel(type: string) {
  switch (type) {
    case "bank_statement":
      return "Bank Statement";
    case "receipt":
      return "Receipt";
    case "invoice":
      return "Invoice";
    case "bill":
      return "Bill";
    default:
      return "Document";
  }
}

function ConfidenceRing({ confidence, size = 48 }: { confidence: number; size?: number }) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (confidence * circumference);

  const getColor = () => {
    if (confidence >= 0.9) return "stroke-success";
    if (confidence >= 0.7) return "stroke-warning";
    return "stroke-destructive";
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className="stroke-muted"
          strokeWidth={strokeWidth}
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={cn("transition-all duration-1000 ease-out", getColor())}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-semibold tabular-nums">{Math.round(confidence * 100)}%</span>
      </div>
    </div>
  );
}

function ProcessingStatusIndicator({ status, className }: { status: ProcessingStatus; className?: string }) {
  switch (status) {
    case "unprocessed":
      return (
        <div className={cn("flex items-center gap-1.5 text-muted-foreground", className)}>
          <div className="size-2 rounded-full bg-muted-foreground/50" />
          <span className="text-xs">Not processed</span>
        </div>
      );
    case "queued":
      return (
        <div className={cn("flex items-center gap-1.5 text-warning", className)}>
          <Clock className="size-3.5 animate-pulse" />
          <span className="text-xs font-medium">Queued</span>
        </div>
      );
    case "processing":
      return (
        <div className={cn("flex items-center gap-1.5 text-primary", className)}>
          <div className="relative">
            <Brain className="size-3.5 animate-pulse" />
            <span className="absolute -top-0.5 -right-0.5 size-1.5 bg-primary rounded-full animate-ping" />
          </div>
          <span className="text-xs font-medium">AI Processing...</span>
        </div>
      );
    case "processed":
      return (
        <div className={cn("flex items-center gap-1.5 text-success", className)}>
          <CheckCircle2 className="size-3.5" />
          <span className="text-xs font-medium">Processed</span>
        </div>
      );
    case "failed":
      return (
        <div className={cn("flex items-center gap-1.5 text-destructive", className)}>
          <AlertCircle className="size-3.5" />
          <span className="text-xs font-medium">Failed</span>
        </div>
      );
  }
}

function DataCard({ label, value, icon, trend }: { label: string; value: string; icon?: React.ReactNode; trend?: "up" | "down" }) {
  return (
    <div className="bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl p-4 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-lg font-semibold">{value}</p>
        {trend && (
          trend === "up"
            ? <TrendingUp className="size-4 text-success" />
            : <TrendingDown className="size-4 text-destructive" />
        )}
      </div>
    </div>
  );
}

function ActionButton({ onClick, icon, label, variant = "default", disabled, loading }: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "primary" | "success";
  disabled?: boolean;
  loading?: boolean;
}) {
  const variants = {
    default: "bg-muted hover:bg-muted/80 text-foreground",
    primary: "bg-primary hover:bg-primary/90 text-primary-foreground",
    success: "bg-success hover:bg-success/90 text-success-foreground",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:scale-[0.98]",
        variants[variant]
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      <span>{label}</span>
      {!loading && <ChevronRight className="size-4 opacity-50" />}
    </button>
  );
}

export function Vault() {
  const [activeCategory, setActiveCategory] = useState<VaultCategory | "all">("all");
  const [renameModal, setRenameModal] = useState<{ open: boolean; document: VaultDocument | null }>({
    open: false,
    document: null,
  });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; document: VaultDocument | null }>({
    open: false,
    document: null,
  });
  const [detailModal, setDetailModal] = useState<{ open: boolean; document: VaultDocument | null }>({
    open: false,
    document: null,
  });
  const [newName, setNewName] = useState("");
  const [showExtractionAnimation, setShowExtractionAnimation] = useState(false);
  const processingDocRef = useRef<string | null>(null);

  // Use useQuery directly to add refetchInterval option
  const { data: documents, isLoading } = useQuery({
    queryKey: vaultKeys.list(activeCategory === "all" ? undefined : activeCategory),
    queryFn: () => api.get<VaultDocument[]>("/vault", {
      category: activeCategory === "all" ? undefined : activeCategory
    }),
    refetchInterval: 3000,
  });

  const { data: counts } = useDocumentCounts();

  const { data: processingAvailable } = useProcessingAvailable();

  const { data: rawProcessingResult, isLoading: isLoadingResult } = useProcessingResult(
    detailModal.document?.id || ""
  );

  // Normalize extracted data
  const processingResult = rawProcessingResult
    ? {
        ...rawProcessingResult,
        extractedData: Array.isArray(rawProcessingResult.extractedData)
          ? rawProcessingResult.extractedData[0]
          : rawProcessingResult.extractedData,
      }
    : null;

  // Auto-open modal when processing completes
  useEffect(() => {
    if (processingDocRef.current && documents) {
      const doc = documents.find(d => d.id === processingDocRef.current);
      if (doc && doc.processingStatus === "processed") {
        setDetailModal({ open: true, document: doc });
        setShowExtractionAnimation(true);
        processingDocRef.current = null;
        setTimeout(() => setShowExtractionAnimation(false), 1500);
      }
    }
  }, [documents]);

  const uploadMutation = useUploadDocument();

  const renameMutation = useRenameDocument();

  const deleteMutation = useDeleteDocument();

  const processMutation = useProcessDocument();

  const createBillMutation = useCreateBillFromDocument();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      for (const file of acceptedFiles) {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];
          if (!base64) return;
          await uploadMutation.mutateAsync({
            fileName: file.name,
            mimeType: file.type,
            base64,
          }, {
            onSuccess: () => {
              toast.success("Document uploaded successfully");
            },
            onError: (error) => {
              toast.error(error.message);
            },
          });
        };
        reader.readAsDataURL(file);
      }
    },
    [uploadMutation]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 10 * 1024 * 1024,
  });

  const handleRename = () => {
    if (renameModal.document && newName.trim()) {
      renameMutation.mutate({
        id: renameModal.document.id,
        displayName: newName.trim(),
      }, {
        onSuccess: () => {
          toast.success("Document renamed successfully");
          setRenameModal({ open: false, document: null });
        },
        onError: (error) => {
          toast.error(error.message);
        },
      });
    }
  };

  const handleDelete = () => {
    if (deleteModal.document) {
      deleteMutation.mutate(deleteModal.document.id, {
        onSuccess: () => {
          toast.success("Document deleted successfully");
          setDeleteModal({ open: false, document: null });
        },
        onError: (error) => {
          toast.error(error.message);
        },
      });
    }
  };

  const handleProcess = (doc: VaultDocument) => {
    processingDocRef.current = doc.id;
    processMutation.mutate(doc.id, {
      onError: (error) => {
        processingDocRef.current = null;
        toast.error(error.message);
      },
    });
    toast.info("AI is analyzing your document...", { duration: 3000 });
  };

  const handleCreateBill = () => {
    if (detailModal.document) {
      createBillMutation.mutate({
        documentId: detailModal.document.id,
        createVendorIfNotFound: true,
      }, {
        onSuccess: (result) => {
          toast.success(`Bill created! Bill ID: ${result.billId}`);
          setDetailModal({ open: false, document: null });
        },
        onError: (error) => {
          toast.error(error.message);
        },
      });
    }
  };

  const openRenameModal = (doc: VaultDocument) => {
    setNewName(doc.displayName);
    setRenameModal({ open: true, document: doc });
  };

  if (isLoading) {
    return <PageSkeleton title="Document Vault" description="Your intelligent document hub" />;
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <FolderFeatherIcon className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="instrument-serif text-3xl font-semibold">Document Vault</h1>
            <p className="text-muted-foreground text-sm">Upload, process, and extract insights with AI</p>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative overflow-hidden rounded-2xl p-8 text-center cursor-pointer transition-all duration-300",
          "border-2 border-dashed",
          "bg-gradient-to-br from-muted/30 via-background to-muted/20",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/10"
        )}
      >
        <input {...getInputProps()} />
        <div className="relative z-10">
          <div className={cn(
            "mx-auto size-16 rounded-2xl flex items-center justify-center mb-4 transition-all",
            "bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20",
            isDragActive && "scale-110"
          )}>
            <InboxArrowDownIcon className={cn(
              "size-8 transition-transform",
              isDragActive ? "text-primary scale-110" : "text-muted-foreground"
            )} />
          </div>
          <p className="font-medium text-lg mb-1">
            {isDragActive ? "Drop to upload" : "Drop files here"}
          </p>
          <p className="text-muted-foreground text-sm">
            or <span className="text-primary font-medium">browse</span> to select files
          </p>
          <p className="text-muted-foreground/60 text-xs mt-2">
            PDF, Images, Documents • Max 10MB
          </p>
        </div>
        {uploadMutation.isPending && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="font-medium">Uploading...</span>
            </div>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="mt-8">
        <Tabs
          value={activeCategory}
          onValueChange={(v) => setActiveCategory(v as VaultCategory | "all")}
        >
          <ScrollArea className="w-full pb-2">
            <TabsList className="w-full justify-start bg-transparent p-0 gap-1">
              {CATEGORIES.map((cat) => (
                <TabsTrigger
                  key={cat.value}
                  value={cat.value}
                  className={cn(
                    "gap-2 px-4 py-2 rounded-lg transition-all data-[state=active]:shadow-none",
                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground",
                    "data-[state=inactive]:bg-muted/50 data-[state=inactive]:hover:bg-muted"
                  )}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  {counts && (counts[cat.value] ?? 0) > 0 && (
                    <span className={cn(
                      "ml-1 text-xs px-1.5 py-0.5 rounded-full tabular-nums",
                      "bg-background/20"
                    )}>
                      {counts[cat.value]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <TabsContent value={activeCategory} className="mt-6">
            {!documents?.length ? (
              <EmptyState
                icon={FolderFeatherIcon}
                title="No documents yet"
                description={
                  activeCategory === "all"
                    ? "Upload your first document to get started."
                    : `No ${activeCategory.replace("_", " ")} documents found.`
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => setDetailModal({ open: true, document: doc })}
                    className={cn(
                      "group relative bg-card rounded-xl border overflow-hidden cursor-pointer transition-all duration-200",
                      "hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-0.5",
                      doc.processingStatus === "processing" && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
                    )}
                  >
                    {/* Preview */}
                    <div className="relative aspect-[4/3] bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center overflow-hidden">
                      {doc.mimeType.startsWith("image/") && doc.publicUrl ? (
                        <img
                          src={doc.publicUrl}
                          alt={doc.displayName}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          {getFileIcon(doc.mimeType, "size-12")}
                        </div>
                      )}

                      {/* Processing Overlay */}
                      {doc.processingStatus === "processing" && (
                        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                          <div className="relative">
                            <Brain className="size-8 text-primary animate-pulse" />
                            <span className="absolute -top-1 -right-1 size-3 bg-primary rounded-full animate-ping" />
                          </div>
                          <div className="text-center">
                            <p className="font-medium text-sm">AI Processing</p>
                            <p className="text-xs text-muted-foreground">Extracting data...</p>
                          </div>
                        </div>
                      )}

                      {/* Quick Process Button */}
                      {processingAvailable?.available && doc.processingStatus === "unprocessed" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProcess(doc);
                          }}
                          className={cn(
                            "absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                            "bg-primary text-primary-foreground text-xs font-medium",
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                            "hover:bg-primary/90 active:scale-95"
                          )}
                        >
                          <Zap className="size-3" />
                          Process
                        </button>
                      )}

                      {/* Processed Badge */}
                      {doc.processingStatus === "processed" && (
                        <div className="absolute top-3 right-3">
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-success text-success-foreground text-xs font-medium backdrop-blur-sm">
                            <CheckCircle2 className="size-3" />
                            <span>AI Ready</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate" title={doc.displayName}>
                            {doc.displayName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{formatFileSize(doc.size)}</span>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="text-xs text-muted-foreground capitalize">{doc.category.replace("_", " ")}</span>
                          </div>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => setDetailModal({ open: true, document: doc })}>
                              <Eye className="size-4" />
                              <span>View Details</span>
                            </DropdownMenuItem>
                            {doc.publicUrl && (
                              <DropdownMenuItem asChild>
                                <a href={doc.publicUrl} target="_blank" rel="noopener noreferrer">
                                  <FileDownloadIcon className="size-4" />
                                  <span>Download</span>
                                </a>
                              </DropdownMenuItem>
                            )}
                            {processingAvailable?.available && doc.processingStatus !== "processing" && (
                              <DropdownMenuItem onClick={() => handleProcess(doc)}>
                                {doc.processingStatus === "processed" ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
                                <span>{doc.processingStatus === "processed" ? "Reprocess" : "Process with AI"}</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openRenameModal(doc)}>
                              <FilePenIcon className="size-4" />
                              <span>Rename</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteModal({ open: true, document: doc })}
                            >
                              <TrashIcon className="size-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Rename Modal */}
      <Dialog
        open={renameModal.open}
        onOpenChange={(open) => !open && setRenameModal({ open: false, document: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="instrument-serif text-2xl font-semibold">Rename Document</DialogTitle>
            <DialogDescription>Enter a new name for this document.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Document name"
              autoFocus
              className="h-11"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameModal({ open: false, document: null })} disabled={renameMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={renameMutation.isPending || !newName.trim()}>
              {renameMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog
        open={deleteModal.open}
        onOpenChange={(open) => !open && setDeleteModal({ open: false, document: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="instrument-serif text-2xl font-semibold">Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteModal.document?.displayName}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteModal({ open: false, document: null })} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Detail Modal - Redesigned */}
      <Dialog
        open={detailModal.open}
        onOpenChange={(open) => !open && setDetailModal({ open: false, document: null })}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {detailModal.document && (
            <>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-muted/30 to-transparent">
                <div className="flex items-start gap-4">
                  <div className="size-14 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center flex-shrink-0 border">
                    {getFileIcon(detailModal.document.mimeType, "size-7")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="instrument-serif text-xl font-semibold truncate pr-8">
                      {detailModal.document.displayName}
                    </h2>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="capitalize font-normal">
                        {detailModal.document.category.replace("_", " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatFileSize(detailModal.document.size)}</span>
                      <ProcessingStatusIndicator status={detailModal.document.processingStatus} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <ScrollArea className="flex-1 px-6">
                <div className="py-6 space-y-6">
                  {/* Document Preview */}
                  {detailModal.document.mimeType === "application/pdf" && detailModal.document.publicUrl && (
                    <a
                      href={detailModal.document.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-dashed p-8 text-center hover:border-primary/50 transition-colors"
                    >
                      <FileFeatherIcon className="size-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="font-medium">View PDF Document</p>
                      <p className="text-sm text-muted-foreground mt-1">Click to open in new tab</p>
                    </a>
                  )}

                  {/* Not Processed State */}
                  {detailModal.document.processingStatus === "unprocessed" && processingAvailable?.available && (
                    <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
                      <div className="flex items-start gap-4">
                        <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="size-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">Extract Data with AI</h3>
                          <p className="text-muted-foreground text-sm mt-1">
                            Let AI analyze this document to automatically extract vendor info, amounts, dates, and line items.
                          </p>
                          <Button
                            onClick={() => handleProcess(detailModal.document!)}
                            disabled={processMutation.isPending}
                            className="mt-4"
                            size="lg"
                          >
                            {processMutation.isPending ? (
                              <>
                                <Loader2 className="size-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Zap className="size-4 mr-2" />
                                Process with AI
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Processing State */}
                  {detailModal.document.processingStatus === "processing" && (
                    <div className="rounded-xl bg-gradient-to-br from-primary/10 to-transparent border p-8 text-center">
                      <div className="relative inline-block mb-4">
                        <Brain className="size-12 text-primary animate-pulse" />
                        <span className="absolute -top-1 -right-1 size-4 bg-primary rounded-full animate-ping" />
                      </div>
                      <h3 className="font-semibold text-lg">AI is analyzing your document</h3>
                      <p className="text-muted-foreground text-sm mt-1">This usually takes 10-30 seconds...</p>
                      <div className="mt-4 flex justify-center">
                        <div className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="size-2 rounded-full bg-primary animate-bounce"
                              style={{ animationDelay: `${i * 150}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loading Result */}
                  {isLoadingResult && detailModal.document.processingStatus === "processed" && (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {/* Processed Results */}
                  {processingResult?.status === "completed" && processingResult.extractedData && (
                    <div className={cn(
                      "space-y-6",
                      showExtractionAnimation && "animate-in fade-in slide-in-from-bottom-4 duration-500"
                    )}>
                      {/* AI Summary Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-success/10 flex items-center justify-center">
                            <CheckCircle2 className="size-5 text-success" />
                          </div>
                          <div>
                            <h3 className="font-semibold">AI Extraction Complete</h3>
                            <p className="text-xs text-muted-foreground">
                              {getDocumentTypeLabel(processingResult.extractedData.documentType || "document")} detected
                            </p>
                          </div>
                        </div>
                        {processingResult.confidenceScore && (
                          <ConfidenceRing confidence={typeof processingResult.confidenceScore === 'string'
                            ? parseFloat(processingResult.confidenceScore)
                            : processingResult.confidenceScore} />
                        )}
                      </div>

                      {/* Bank Statement Data */}
                      {processingResult.extractedData.documentType === "bank_statement" && (
                        <div className="space-y-4">
                          <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border p-5">
                            <div className="flex items-center gap-3 mb-4">
                              <Building2 className="size-5 text-muted-foreground" />
                              <div>
                                <p className="font-semibold">{processingResult.extractedData.bankName}</p>
                                {processingResult.extractedData.accountNumber && (
                                  <p className="text-sm text-muted-foreground">Account: {processingResult.extractedData.accountNumber}</p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {processingResult.extractedData.statementPeriod && (
                                <DataCard
                                  label="Period"
                                  value={`${processingResult.extractedData.statementPeriod.startDate || "?"} - ${processingResult.extractedData.statementPeriod.endDate || "?"}`}
                                />
                              )}
                              {processingResult.extractedData.openingBalance !== undefined && (
                                <DataCard
                                  label="Opening"
                                  value={`${processingResult.extractedData.currency || "MYR"} ${processingResult.extractedData.openingBalance.toLocaleString()}`}
                                />
                              )}
                              {processingResult.extractedData.closingBalance !== undefined && (
                                <DataCard
                                  label="Closing"
                                  value={`${processingResult.extractedData.currency || "MYR"} ${processingResult.extractedData.closingBalance.toLocaleString()}`}
                                  trend={processingResult.extractedData.closingBalance >= (processingResult.extractedData.openingBalance || 0) ? "up" : "down"}
                                />
                              )}
                            </div>
                          </div>

                          {/* Transactions */}
                          {processingResult.extractedData.transactions?.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium">Transactions</h4>
                                <Badge variant="secondary">{processingResult.extractedData.transactions.length} found</Badge>
                              </div>
                              <div className="rounded-xl border overflow-hidden">
                                <div className="max-h-64 overflow-y-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-muted/80 sticky top-0">
                                      <tr>
                                        <th className="text-left p-3 font-medium">Date</th>
                                        <th className="text-left p-3 font-medium">Description</th>
                                        <th className="text-right p-3 font-medium">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {processingResult.extractedData.transactions.map((tx: { date: string; description: string; debit?: number; credit?: number }, i: number) => (
                                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                                          <td className="p-3 whitespace-nowrap font-mono text-xs">{tx.date}</td>
                                          <td className="p-3">{tx.description}</td>
                                          <td className={cn(
                                            "p-3 text-right font-medium tabular-nums",
                                            tx.debit ? "text-destructive" : "text-success"
                                          )}>
                                            {tx.debit ? `-${tx.debit.toLocaleString()}` : `+${(tx.credit || 0).toLocaleString()}`}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Receipt Data */}
                      {processingResult.extractedData.documentType === "receipt" && (
                        <div className="space-y-4">
                          {processingResult.extractedData.vendor && (
                            <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border p-5">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Merchant</p>
                              <p className="font-semibold text-lg">{processingResult.extractedData.vendor.name}</p>
                              {processingResult.extractedData.vendor.address && (
                                <p className="text-sm text-muted-foreground mt-1">{processingResult.extractedData.vendor.address}</p>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {processingResult.extractedData.receiptNumber && (
                              <DataCard label="Receipt #" value={processingResult.extractedData.receiptNumber} />
                            )}
                            {processingResult.extractedData.date && (
                              <DataCard label="Date" value={processingResult.extractedData.date} />
                            )}
                            {processingResult.extractedData.paymentMethod && (
                              <DataCard label="Payment" value={processingResult.extractedData.paymentMethod} />
                            )}
                            {processingResult.extractedData.total !== undefined && (
                              <DataCard
                                label="Total"
                                value={`${processingResult.extractedData.currency || "MYR"} ${processingResult.extractedData.total.toLocaleString()}`}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Invoice/Bill Data */}
                      {(!processingResult.extractedData.documentType || processingResult.extractedData.documentType === "invoice" || processingResult.extractedData.documentType === "bill") && (
                        <div className="space-y-4">
                          {processingResult.extractedData.vendor && (
                            <div className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border p-5">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Vendor</p>
                                  <p className="font-semibold text-lg">{processingResult.extractedData.vendor.name}</p>
                                  {processingResult.extractedData.vendor.address && (
                                    <p className="text-sm text-muted-foreground mt-1">{processingResult.extractedData.vendor.address}</p>
                                  )}
                                  {processingResult.extractedData.vendor.taxId && (
                                    <p className="text-sm mt-2">
                                      <span className="text-muted-foreground">Tax ID:</span> {processingResult.extractedData.vendor.taxId}
                                    </p>
                                  )}
                                </div>
                                {processingResult.matchedVendor && (
                                  <Badge className="bg-success/10 text-success border-success/20">
                                    <Check className="size-3 mr-1" />
                                    Matched
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {processingResult.extractedData.invoiceNumber && (
                              <DataCard label="Invoice #" value={processingResult.extractedData.invoiceNumber} />
                            )}
                            {processingResult.extractedData.invoiceDate && (
                              <DataCard label="Date" value={processingResult.extractedData.invoiceDate} />
                            )}
                            {processingResult.extractedData.dueDate && (
                              <DataCard label="Due Date" value={processingResult.extractedData.dueDate} />
                            )}
                            {processingResult.extractedData.total !== undefined && (
                              <DataCard
                                label="Total"
                                value={`${processingResult.extractedData.currency || "MYR"} ${processingResult.extractedData.total.toLocaleString()}`}
                              />
                            )}
                          </div>

                          {/* Line Items */}
                          {processingResult.extractedData.lineItems?.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium">Line Items</h4>
                                <Badge variant="secondary">{processingResult.extractedData.lineItems.length} items</Badge>
                              </div>
                              <div className="rounded-xl border overflow-hidden">
                                <table className="w-full text-sm">
                                  <thead className="bg-muted/80">
                                    <tr>
                                      <th className="text-left p-3 font-medium">Description</th>
                                      <th className="text-right p-3 font-medium">Qty</th>
                                      <th className="text-right p-3 font-medium">Price</th>
                                      <th className="text-right p-3 font-medium">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {processingResult.extractedData.lineItems.map((item: { description: string; quantity: number; unitPrice: number; amount: number }, i: number) => (
                                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                                        <td className="p-3">{item.description}</td>
                                        <td className="p-3 text-right tabular-nums">{item.quantity}</td>
                                        <td className="p-3 text-right tabular-nums">{item.unitPrice?.toLocaleString()}</td>
                                        <td className="p-3 text-right font-medium tabular-nums">{item.amount?.toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      {!processingResult.linkedBillId && (
                        <div className="rounded-xl bg-gradient-to-r from-success/10 via-success/5 to-transparent border border-success/20 p-5">
                          <h4 className="font-semibold mb-1">Ready to create a bill?</h4>
                          <p className="text-sm text-muted-foreground mb-4">
                            All extracted data will be automatically filled in.
                          </p>
                          <ActionButton
                            onClick={handleCreateBill}
                            icon={<FileText className="size-4" />}
                            label="Create Bill"
                            variant="success"
                            loading={createBillMutation.isPending}
                          />
                        </div>
                      )}

                      {processingResult.linkedBillId && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/20">
                          <CheckCircle2 className="size-5 text-success" />
                          <div>
                            <p className="font-medium text-success">Bill Created</p>
                            <p className="text-sm text-muted-foreground">This document has been converted to a bill.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error State */}
                  {processingResult?.status === "failed" && (
                    <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-5">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-destructive">Processing Failed</h4>
                          <p className="text-sm text-muted-foreground mt-1">{processingResult.errorMessage}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => handleProcess(detailModal.document!)}
                            disabled={processMutation.isPending}
                          >
                            <RefreshCw className="size-3 mr-2" />
                            Try Again
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
                <div className="flex gap-2">
                  {detailModal.document.publicUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={detailModal.document.publicUrl} target="_blank" rel="noopener noreferrer">
                        <FileDownloadIcon className="size-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  )}
                </div>
                {processingAvailable?.available && detailModal.document.processingStatus === "processed" && !processingResult?.linkedBillId && (
                  <Button
                    onClick={handleCreateBill}
                    disabled={createBillMutation.isPending}
                  >
                    {createBillMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="size-4 mr-2" />
                        Create Bill
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
