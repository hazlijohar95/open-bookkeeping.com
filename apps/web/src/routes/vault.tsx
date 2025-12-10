import { useState, useCallback, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
  Sparkles,
  FileText,
  Building2,
  Zap,
  Eye,
  RefreshCw,
  CheckCircle2,
  Brain,
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
import { VaultCategory } from "@/types/common/vault";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Import extracted components
import { formatFileSize, getFileIcon } from "@/components/vault/utils";
import { DocumentDetailModal } from "@/components/vault/document-detail-modal";

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
              <DocumentGrid
                documents={documents}
                processingAvailable={processingAvailable?.available || false}
                onDocumentClick={(doc) => setDetailModal({ open: true, document: doc })}
                onProcess={handleProcess}
                onRename={openRenameModal}
                onDelete={(doc) => setDeleteModal({ open: true, document: doc })}
              />
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

      {/* Document Detail Modal */}
      <DocumentDetailModal
        open={detailModal.open}
        onOpenChange={(open) => !open && setDetailModal({ open: false, document: null })}
        document={detailModal.document}
        processingResult={processingResult}
        isLoadingResult={isLoadingResult}
        showExtractionAnimation={showExtractionAnimation}
        processingAvailable={processingAvailable?.available || false}
        onProcess={() => detailModal.document && handleProcess(detailModal.document)}
        onCreateBill={handleCreateBill}
        isProcessing={processMutation.isPending}
        isCreatingBill={createBillMutation.isPending}
      />
    </PageContainer>
  );
}

// Document Grid component
interface DocumentGridProps {
  documents: VaultDocument[];
  processingAvailable: boolean;
  onDocumentClick: (doc: VaultDocument) => void;
  onProcess: (doc: VaultDocument) => void;
  onRename: (doc: VaultDocument) => void;
  onDelete: (doc: VaultDocument) => void;
}

function DocumentGrid({
  documents,
  processingAvailable,
  onDocumentClick,
  onProcess,
  onRename,
  onDelete,
}: DocumentGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          processingAvailable={processingAvailable}
          onClick={() => onDocumentClick(doc)}
          onProcess={() => onProcess(doc)}
          onRename={() => onRename(doc)}
          onDelete={() => onDelete(doc)}
          onView={() => onDocumentClick(doc)}
        />
      ))}
    </div>
  );
}

// Document Card component
interface DocumentCardProps {
  document: VaultDocument;
  processingAvailable: boolean;
  onClick: () => void;
  onProcess: () => void;
  onRename: () => void;
  onDelete: () => void;
  onView: () => void;
}

function DocumentCard({
  document: doc,
  processingAvailable,
  onClick,
  onProcess,
  onRename,
  onDelete,
  onView,
}: DocumentCardProps) {
  return (
    <div
      onClick={onClick}
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
        {processingAvailable && doc.processingStatus === "unprocessed" && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onProcess();
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
              <DropdownMenuItem onClick={onView}>
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
              {processingAvailable && doc.processingStatus !== "processing" && (
                <DropdownMenuItem onClick={onProcess}>
                  {doc.processingStatus === "processed" ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
                  <span>{doc.processingStatus === "processed" ? "Reprocess" : "Process with AI"}</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onRename}>
                <FilePenIcon className="size-4" />
                <span>Rename</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onDelete}
              >
                <TrashIcon className="size-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
