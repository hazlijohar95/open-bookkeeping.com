import { useSubmissionHistory, type EInvoiceSubmission } from "@/api/einvoice";
import type { EInvoiceStatus } from "./submission-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SubmissionStatusBadge } from "./submission-status-badge";
import { format } from "date-fns";
import {
  CircleCheckIcon,
  CircleXmarkIcon,
  FileCheckIcon,
} from "@/assets/icons";
import { ExternalLink, Copy, Check } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

interface SubmissionHistoryProps {
  invoiceId: string;
}

export function SubmissionHistory({ invoiceId }: SubmissionHistoryProps) {
  const { data: submissions, isLoading } = useSubmissionHistory(invoiceId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheckIcon className="size-4" />
            E-Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No e-invoice submissions yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheckIcon className="size-4" />
          E-Invoice History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {submissions.map((submission, index) => (
            <AccordionItem key={submission.id} value={submission.id}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <SubmissionStatusBadge
                    status={submission.status as EInvoiceStatus}
                    showTooltip={false}
                  />
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(submission.createdAt), "MMM d, yyyy h:mm a")}
                  </span>
                  {index === 0 && (
                    <Badge variant="outline" className="ml-2">
                      Latest
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <SubmissionDetails submission={submission} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

interface SubmissionDetailsProps {
  submission: EInvoiceSubmission;
}

function SubmissionDetails({ submission }: SubmissionDetailsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Status Timeline */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div
            className={`size-2 rounded-full ${
              submission.submittedAt ? "bg-success" : "bg-muted"
            }`}
          />
          <span className="text-muted-foreground">Submitted</span>
          {submission.submittedAt && (
            <span className="text-xs">
              {format(new Date(submission.submittedAt), "MMM d, h:mm a")}
            </span>
          )}
        </div>
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-2">
          <div
            className={`size-2 rounded-full ${
              submission.status === "valid"
                ? "bg-success"
                : submission.status === "invalid"
                ? "bg-destructive"
                : "bg-muted"
            }`}
          />
          <span className="text-muted-foreground">Validated</span>
          {submission.validatedAt && (
            <span className="text-xs">
              {format(new Date(submission.validatedAt), "MMM d, h:mm a")}
            </span>
          )}
        </div>
      </div>

      {/* IDs */}
      <div className="grid gap-3 rounded-lg border p-3">
        {submission.submissionUid && (
          <DetailRow
            label="Submission UID"
            value={submission.submissionUid}
            onCopy={() =>
              copyToClipboard(submission.submissionUid!, "submissionUid")
            }
            copied={copiedField === "submissionUid"}
          />
        )}
        {submission.documentUuid && (
          <DetailRow
            label="Document UUID"
            value={submission.documentUuid}
            onCopy={() =>
              copyToClipboard(submission.documentUuid!, "documentUuid")
            }
            copied={copiedField === "documentUuid"}
          />
        )}
        {submission.longId && (
          <DetailRow
            label="Long ID"
            value={submission.longId}
            onCopy={() => copyToClipboard(submission.longId!, "longId")}
            copied={copiedField === "longId"}
          />
        )}
        <DetailRow
          label="Document Type"
          value={submission.documentType.replace(/_/g, " ").toUpperCase()}
        />
      </div>

      {/* Error Message */}
      {submission.errorMessage && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-start gap-2">
            <CircleXmarkIcon className="size-4 mt-0.5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Validation Error</p>
              {submission.errorCode && (
                <p className="text-xs text-destructive/80">
                  Code: {submission.errorCode}
                </p>
              )}
              <p className="mt-1 text-sm text-destructive/90">
                {submission.errorMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {submission.status === "valid" && submission.longId && (
        <div className="rounded-lg border border-success/50 bg-success/10 p-3">
          <div className="flex items-start gap-2">
            <CircleCheckIcon className="size-4 mt-0.5 text-success" />
            <div>
              <p className="font-medium text-success">E-Invoice Validated</p>
              <p className="mt-1 text-sm text-success/90">
                This document has been validated and accepted by MyInvois. The QR
                code is available for printing on the invoice.
              </p>
              <a
                href={`https://myinvois.hasil.gov.my/${submission.longId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm text-success hover:underline"
              >
                View on MyInvois Portal
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled Message */}
      {submission.cancelledAt && (
        <div className="rounded-lg border p-3">
          <p className="text-sm text-muted-foreground">
            Cancelled on{" "}
            {format(new Date(submission.cancelledAt), "MMM d, yyyy h:mm a")}
          </p>
        </div>
      )}
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}

function DetailRow({ label, value, onCopy, copied }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono">
          {value.length > 30 ? `${value.slice(0, 30)}...` : value}
        </code>
        {onCopy && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onCopy}
          >
            {copied ? (
              <Check className="size-3 text-success" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
