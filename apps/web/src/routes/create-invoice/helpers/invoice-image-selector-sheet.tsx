import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { createBlobFromBase64 } from "@/lib/invoice/create-blob-from-base64";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getImagesWithKey } from "@/lib/manage-assets/getImagesWithKey";
import SignatureInputModal from "@/components/ui/image/signature-input-modal";
import { uploadImage } from "@/lib/indexdb-queries/uploadImage";
import ImageInput from "@/components/ui/image/image-input";
import type { InvoiceImageType } from "@/types/common/invoice";
import type { IDBImage } from "@/types/indexdb/invoice";
import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { R2_PUBLIC_URL } from "@/constants";
import type { User } from "@supabase/supabase-js";
import { useState } from "react";
import { toast } from "sonner";

interface InvoiceImageSelectorSheetProps {
  children: React.ReactNode;
  type: InvoiceImageType;
  isLoading?: boolean;
  idbImages: IDBImage[];
  serverImages: string[];
  user: User | null;
  onUrlChange: (url: string) => void;
  onBase64Change: (base64?: string) => void;
}

export const InvoiceImageSelectorSheet = ({
  children,
  type,
  isLoading = false,
  idbImages,
  serverImages,
  user,
  onUrlChange,
  onBase64Change,
}: InvoiceImageSelectorSheetProps) => {
  const params = useParams();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageSelect = (image: string, imageType: "server" | "local") => {
    if (imageType === "server") {
      onUrlChange(`${R2_PUBLIC_URL}/${image}`);
      setSheetOpen(false);
    } else {
      onBase64Change(image);
      // convert base64 to url
      const blob = createBlobFromBase64(image);
      if (!blob) return;
      onUrlChange(URL.createObjectURL(blob));
      setSheetOpen(false);
    }
  };

  // Handle new file upload (for logo)
  const handleLogoUpload = async (base64: string | undefined) => {
    if (!base64) return;

    setIsUploading(true);
    try {
      // SaveIcon to IndexedDB
      await uploadImage(base64, "logo");

      // Invalidate the query to refresh the images list
      await queryClient.invalidateQueries({ queryKey: ["idb-images"] });

      // Auto-select the newly uploaded image
      onBase64Change(base64);
      const blob = createBlobFromBase64(base64);
      if (blob) {
        onUrlChange(URL.createObjectURL(blob));
      }

      toast.success("Logo uploaded successfully!");
      setSheetOpen(false);
    } catch (error) {
      console.error("Failed to upload logo:", error);
      toast.error("Failed to upload logo");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle signature upload/draw
  const handleSignatureUpload = async (base64: string | undefined) => {
    if (!base64) return;

    setIsUploading(true);
    try {
      // SaveIcon to IndexedDB
      await uploadImage(base64, "signature");

      // Invalidate the query to refresh the images list
      await queryClient.invalidateQueries({ queryKey: ["idb-images"] });

      // Auto-select the newly uploaded/drawn signature
      onBase64Change(base64);
      const blob = createBlobFromBase64(base64);
      if (blob) {
        onUrlChange(URL.createObjectURL(blob));
      }

      toast.success("Signature saved successfully!");
      setSheetOpen(false);
    } catch (error) {
      console.error("Failed to save signature:", error);
      toast.error("Failed to save signature");
    } finally {
      setIsUploading(false);
    }
  };

  const filteredServerImages = getImagesWithKey(serverImages, type);
  const filteredLocalImages = idbImages.filter((img) => img.type === type);

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="scroll-bar-hidden w-[90%] !max-w-lg overflow-y-scroll">
        <SheetHeader className="hidden flex-col gap-0">
          <SheetTitle>Select {type}</SheetTitle>
          <SheetDescription>Select an image from your assets</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Loading images...</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {/* Server Images Section - Only show if user is logged in */}
            {user && filteredServerImages.length > 0 && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="instrument-serif text-xl font-bold">Server {type}</div>
                  <p className="text-muted-foreground text-xs">
                    Click to select the {type}s that are stored on the server.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {filteredServerImages.map((image) => (
                    <div
                      key={image}
                      className="bg-border/30 relative cursor-pointer rounded-md hover:ring-2 hover:ring-primary transition-all"
                      onClick={() => handleImageSelect(image, "server")}
                    >
                      <img
                        src={`${R2_PUBLIC_URL}/${image}`}
                        alt={image}
                        className="aspect-square w-full rounded-md border object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Local Images Section - Only show if not server invoice */}
            {params?.type !== "server" && (
              <div className="flex flex-col gap-4">
                <div>
                  <div className="instrument-serif text-xl font-bold">Local {type}</div>
                  <p className="text-muted-foreground text-xs">
                    Click to select the {type}s that are stored on your device.
                  </p>
                </div>

                {/* Caution Alert */}
                <Alert variant="destructive">
                  <AlertTitle>Caution</AlertTitle>
                  <AlertDescription>
                    Don&apos;t select local {type} if you are using server invoice storage. {type} will not be saved in your invoice.
                  </AlertDescription>
                </Alert>

                {/* Upload/Create Section */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {/* Logo: Simple upload */}
                  {type === "logo" && (
                    <ImageInput
                      isLoading={isUploading}
                      allowPreview={false}
                      onBase64Change={handleLogoUpload}
                      maxSizeMB={0.4}
                      disableIcon={false}
                    />
                  )}

                  {/* Signature: Draw or upload */}
                  {type === "signature" && (
                    <SignatureInputModal
                      isLoading={isUploading}
                      onBase64Change={handleSignatureUpload}
                      maxSizeMB={0.15}
                      disableIcon={false}
                    />
                  )}

                  {/* Existing local images */}
                  {filteredLocalImages.map((image) => (
                    <div
                      key={image.id}
                      className="bg-border/30 relative cursor-pointer rounded-md hover:ring-2 hover:ring-primary transition-all"
                      onClick={() => handleImageSelect(image.base64, "local")}
                    >
                      <img
                        src={image.base64}
                        alt={image.id}
                        className="aspect-square w-full rounded-md object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
