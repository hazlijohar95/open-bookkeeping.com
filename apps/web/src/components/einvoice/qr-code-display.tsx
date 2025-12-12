import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "@/components/ui/icons";
import { toast } from "sonner";

interface QRCodeDisplayProps {
  longId: string | null | undefined;
  invoiceNumber?: string;
  className?: string;
}

export function QRCodeDisplay({
  longId,
  invoiceNumber,
  className,
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (longId && canvasRef.current) {
      const qrUrl = `https://myinvois.hasil.gov.my/${longId}`;

      void QRCode.toCanvas(canvasRef.current, qrUrl, {
        width: 150,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    }
  }, [longId]);

  if (!longId) {
    return null;
  }

  const qrUrl = `https://myinvois.hasil.gov.my/${longId}`;

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const link = document.createElement("a");
    link.download = `einvoice-qr-${invoiceNumber ?? "code"}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
    toast.success("QR code downloaded");
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">MyInvois QR Code</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="rounded-lg border bg-white p-2">
          <canvas ref={canvasRef} />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-muted-foreground max-w-[200px]">
            Scan to verify this e-invoice on MyInvois portal
          </p>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 size-4" />
              Download
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={qrUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 size-4" />
                Verify
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Simplified version for embedding in PDFs
export function QRCodeCanvas({
  longId,
  size = 100,
}: {
  longId: string;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const qrUrl = `https://myinvois.hasil.gov.my/${longId}`;

      void QRCode.toCanvas(canvasRef.current, qrUrl, {
        width: size,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    }
  }, [longId, size]);

  return <canvas ref={canvasRef} />;
}

// Get QR code as data URL for PDF generation
export async function getQRCodeDataURL(
  longId: string,
  size = 100
): Promise<string> {
  const qrUrl = `https://myinvois.hasil.gov.my/${longId}`;
  return QRCode.toDataURL(qrUrl, {
    width: size,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}
