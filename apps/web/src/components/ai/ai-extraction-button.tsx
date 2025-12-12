"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2Icon } from "@/components/ui/icons";
import { useAuth } from "@/providers/auth-provider";

interface ExtractedInvoice {
  vendorName: string;
  vendorAddress?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  currency: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  taxAmount?: number;
  totalAmount: number;
}

interface ExtractedReceipt {
  merchantName: string;
  merchantAddress?: string;
  date: string;
  items: Array<{
    description: string;
    quantity: number;
    price: number;
  }>;
  subtotal?: number;
  tax?: number;
  total: number;
  paymentMethod?: string;
}

type ExtractedData = ExtractedInvoice | ExtractedReceipt;

interface AIExtractionButtonProps<T extends ExtractedData> {
  documentContent: string;
  extractionType: "invoice" | "receipt" | "bank-statement";
  onExtracted: (data: T) => void;
  onError?: (error: Error) => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function AIExtractionButton<T extends ExtractedData>({
  documentContent,
  extractionType,
  onExtracted,
  onError,
  variant = "outline",
  size = "default",
  className,
}: AIExtractionButtonProps<T>) {
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleExtract = async () => {
    if (!documentContent || !session?.access_token) {
      onError?.(new Error("Missing document content or authentication"));
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/api/ai/extract/${extractionType}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ content: documentContent }),
        }
      );

      if (!response.ok) {
        throw new Error(`Extraction failed: ${response.statusText}`);
      }

      const data = await response.json();
      onExtracted(data as T);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error("Extraction failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExtract}
      disabled={isLoading || !documentContent}
      variant={variant}
      size={size}
      className={className}
    >
      {isLoading ? (
        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 h-4 w-4" />
      )}
      Extract with AI
    </Button>
  );
}
