import { useState, useRef } from "react";
import { Upload, Trash2Icon, Plus } from "@/components/ui/icons";
import { useStorageImages, useUploadImage, useDeleteImage } from "@/api/storage";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/page-loading-spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageSparkleIcon } from "@/assets/icons";
import { toast } from "sonner";

export function Assets() {
  const [activeTab, setActiveTab] = useState<"logos" | "signatures">("logos");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: images, isLoading } = useStorageImages();
  const uploadImage = useUploadImage();
  const deleteImage = useDeleteImage();

  const logos = images?.filter((img) => img.type === "logo") ?? [];
  const signatures = images?.filter((img) => img.type === "signature") ?? [];

  const currentImages = activeTab === "logos" ? logos : signatures;

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(",")[1] ?? "";
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      await uploadImage.mutateAsync({
        type: activeTab === "logos" ? "logo" : "signature",
        base64,
        fileName: file.name,
      });
      toast.success(`${activeTab === "logos" ? "Logo" : "Signature"} uploaded successfully`);
    } catch {
      toast.error("Failed to upload image");
    }

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handle delete
  const handleDelete = async (key: string) => {
    try {
      await deleteImage.mutateAsync(key);
      toast.success("Image deleted successfully");
    } catch {
      toast.error("Failed to delete image");
    }
  };

  return (
    <PageContainer>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      <PageHeader
        icon={ImageSparkleIcon}
        title="Assets"
        description="Manage your logos and signatures"
        action={
          <Button onClick={handleUploadClick} disabled={uploadImage.isPending}>
            <Upload className="size-4" />
            {uploadImage.isPending ? "Uploading..." : "Upload"}
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="logos">Logos ({logos.length})</TabsTrigger>
          <TabsTrigger value="signatures">Signatures ({signatures.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <LoadingSpinner />
          ) : !currentImages.length ? (
            <EmptyState
              icon={ImageSparkleIcon}
              title={`No ${activeTab} uploaded`}
              description={`Upload your ${activeTab === "logos" ? "company logo" : "signature"} to use in your invoices.`}
              action={
                <Button onClick={handleUploadClick} disabled={uploadImage.isPending}>
                  <Plus className="size-4" />
                  {uploadImage.isPending ? "Uploading..." : `Upload ${activeTab === "logos" ? "Logo" : "Signature"}`}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {currentImages.map((image) => (
                <div
                  key={image.key}
                  className="group relative aspect-square rounded-lg border bg-muted/50 overflow-hidden"
                >
                  <img
                    src={image.url}
                    alt=""
                    className="w-full h-full object-contain p-4"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleDelete(image.key)}
                      disabled={deleteImage.isPending}
                      aria-label="Delete image"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <button
                onClick={handleUploadClick}
                disabled={uploadImage.isPending}
                className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors disabled:opacity-50"
              >
                <Plus className="size-8" />
                <span className="text-sm font-medium">
                  {uploadImage.isPending ? "Uploading..." : "Add new"}
                </span>
              </button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
