import DebitNoteFieldKeyStringValuesSection from "./helpers/debit-note-field-key-string-value-section";
import DebitNoteFieldKeyNumberValuesSection from "./helpers/debit-note-field-key-number-value-section";
import { Accordion, AccordionItem, AccordionContent, AccordionTrigger } from "@/components/ui/accordion";
import SheetImageSelectorTrigger from "@/components/ui/image/sheet-image-selector-trigger";
import { DebitNoteImageSelectorSheet } from "./helpers/debit-note-image-selector-sheet";
import { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";
import { FormCustomerSelector } from "@/components/ui/form/form-customer-selector";
import { DebitNoteTemplateSelector } from "./helpers/debit-note-templates";
import { FormColorPicker } from "@/components/ui/form/form-color-picker";
import DebitNoteItemsSection from "./helpers/debit-note-items-section";
import { FormDatePicker } from "@/components/ui/form/form-date-picker";
import { getAllImages } from "@/lib/indexdb-queries/getAllImages";
import { FormTextarea } from "@/components/ui/form/form-textarea";
import { FormSelect } from "@/components/ui/form/form-select";
import { currenciesWithSymbols } from "@/constants/currency";
import { FormInput } from "@/components/ui/form/form-input";
import FormRow from "@/components/ui/form/form-row";
import { SelectItem } from "@/components/ui/select";
import { Form } from "@/components/ui/form/form";
import { useQuery } from "@tanstack/react-query";
import { UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers";
import { cn } from "@/lib/utils";
import React, { useRef, useState, useEffect, useCallback } from "react";

interface DebitNoteFormProps {
  form: UseFormReturn<ZodCreateDebitNoteSchema>;
}

const DebitNoteForm: React.FC<DebitNoteFormProps> = ({ form }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const { user } = useAuth();

  // Track container width for responsive layout
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // fetching images from indexedDB
  const idbImages = useQuery({
    queryKey: ["idb-images"],
    queryFn: () => getAllImages(),
  });

  // For now, server images will be empty - can be integrated with tRPC later
  const serverImages: string[] = [];

  // Handle customer selection - auto-fill client details
  const handleCustomerSelect = useCallback(
    (customer: { id: string; name: string; email: string | null; phone: string | null; address: string | null } | null) => {
      if (customer) {
        form.setValue("clientDetails.name", customer.name);
        form.setValue("clientDetails.address", customer.address || "");
        // Build metadata from customer info
        const metadata: { label: string; value: string }[] = [];
        if (customer.email) {
          metadata.push({ label: "Email", value: customer.email });
        }
        if (customer.phone) {
          metadata.push({ label: "Phone", value: customer.phone });
        }
        form.setValue("clientDetails.metadata", metadata);
      }
    },
    [form]
  );

  return (
    <div className="scroll-bar-hidden flex h-full flex-col overflow-y-scroll">
      <Form {...form}>
        <form>
          <div className="flex h-14 flex-row items-center justify-between border-b px-4">
            <span className="text-sm font-medium">Debit Note Template</span>
            <div className="">
              <DebitNoteTemplateSelector form={form} />
            </div>
          </div>
          <Accordion type="single" collapsible defaultValue="company-details" className="w-full divide-y border-b">
            {/* Company Details */}
            <AccordionItem value="company-details">
              <AccordionTrigger>Company Details</AccordionTrigger>
              <AccordionContent ref={containerRef} className={cn(containerWidth > 1200 ? "flex-row gap-4" : "flex-col")}>
                <div className={cn(containerWidth > 1200 ? "w-fit" : "w-full [&>*]:w-full", "flex flex-row gap-4")}>
                  <DebitNoteImageSelectorSheet
                    type="logo"
                    isLoading={idbImages.isLoading}
                    idbImages={idbImages.data || []}
                    serverImages={serverImages}
                    user={user}
                    onUrlChange={(url) => {
                      form.setValue("companyDetails.logo", url);
                    }}
                    onBase64Change={(base64) => {
                      form.setValue("companyDetails.logoBase64", base64);
                    }}
                  >
                    <SheetImageSelectorTrigger
                      type="logo"
                      previewUrl={form.watch("companyDetails.logo") ?? undefined}
                      onRemove={() => {
                        form.setValue("companyDetails.logo", "");
                        form.setValue("companyDetails.logoBase64", undefined);
                      }}
                      label="Company Logo"
                    />
                  </DebitNoteImageSelectorSheet>
                  <DebitNoteImageSelectorSheet
                    type="signature"
                    isLoading={idbImages.isLoading}
                    idbImages={idbImages.data || []}
                    serverImages={serverImages}
                    user={user}
                    onUrlChange={(url) => {
                      form.setValue("companyDetails.signature", url);
                    }}
                    onBase64Change={(base64) => {
                      form.setValue("companyDetails.signatureBase64", base64);
                    }}
                  >
                    <SheetImageSelectorTrigger
                      type="signature"
                      previewUrl={form.watch("companyDetails.signature") ?? undefined}
                      onRemove={() => {
                        form.setValue("companyDetails.signature", "");
                        form.setValue("companyDetails.signatureBase64", undefined);
                      }}
                      label="Company Signature"
                    />
                  </DebitNoteImageSelectorSheet>
                </div>
                <div className="flex w-full flex-col gap-2">
                  <FormInput
                    name="companyDetails.name"
                    label="Company Name"
                    reactform={form}
                    placeholder="Your Company Sdn Bhd"
                    description="Your business or company name"
                  />
                  <FormTextarea
                    className="h-20"
                    name="companyDetails.address"
                    label="Company Address"
                    reactform={form}
                    placeholder="No. 123, Jalan Bukit Bintang&#10;55100 Kuala Lumpur, Malaysia"
                  />
                  <DebitNoteFieldKeyStringValuesSection
                    reactform={form}
                    name="companyDetails.metadata"
                    label="Additional Details"
                    description="Add extra info like SSM No., phone, email"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
            {/* Client Details */}
            <AccordionItem value="client-details">
              <AccordionTrigger>Debit To</AccordionTrigger>
              <AccordionContent>
                <FormCustomerSelector
                  name="customerId"
                  label="Select Customer"
                  placeholder="Search and select a customer..."
                  reactform={form}
                  description="Link this debit note to an existing customer"
                  onCustomerSelect={handleCustomerSelect}
                  isOptional
                />
                <FormInput
                  name="clientDetails.name"
                  label="Client / Customer Name"
                  reactform={form}
                  placeholder="Client Company Sdn Bhd"
                  description="Who is this debit note for?"
                />
                <FormTextarea
                  className="h-20"
                  name="clientDetails.address"
                  label="Client Address"
                  reactform={form}
                  placeholder="No. 456, Jalan Sultan Ismail&#10;50250 Kuala Lumpur, Malaysia"
                />
                <DebitNoteFieldKeyStringValuesSection
                  reactform={form}
                  name="clientDetails.metadata"
                  label="Additional Details"
                  description="Add extra info like SSM No., contact person"
                />
              </AccordionContent>
            </AccordionItem>
            {/* Debit Note Details */}
            <AccordionItem value="debit-note-details">
              <AccordionTrigger>Debit Note Details</AccordionTrigger>
              <AccordionContent>
                <FormRow>
                  <FormSelect
                    name="debitNoteDetails.currency"
                    description="Select your currency"
                    defaultValue="MYR"
                    label="Currency"
                    reactform={form}
                  >
                    {Object.entries(currenciesWithSymbols).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        <span>{key}</span>
                        <Badge className="bg-primary/15 text-primary rounded" variant="default">
                          {value}
                        </Badge>
                      </SelectItem>
                    ))}
                  </FormSelect>
                  {form.watch("debitNoteDetails.theme.template") !== "cynco" && (
                    <>
                      <FormSelect
                        name="debitNoteDetails.theme.mode"
                        description="Light or dark background"
                        defaultValue="light"
                        label="Theme Style"
                        reactform={form}
                      >
                        <SelectItem value="light">
                          <span>Light</span>
                        </SelectItem>
                        <SelectItem value="dark">
                          <span>Dark</span>
                        </SelectItem>
                      </FormSelect>
                      <FormColorPicker
                        name="debitNoteDetails.theme.baseColor"
                        label="Accent Color"
                        reactform={form}
                        description="Brand color for your debit note"
                      />
                    </>
                  )}
                </FormRow>
                <FormRow>
                  <FormInput
                    name="debitNoteDetails.prefix"
                    label="Debit Note Prefix"
                    reactform={form}
                    placeholder="DN-"
                    description="Text before debit note number"
                    isOptional={true}
                  />
                  <FormInput
                    name="debitNoteDetails.serialNumber"
                    label="Debit Note Number"
                    reactform={form}
                    placeholder="0001"
                    description="Unique debit note number"
                  />
                </FormRow>
                <FormRow>
                  <FormDatePicker
                    name="debitNoteDetails.date"
                    label="Debit Note Date"
                    reactform={form}
                    description="When was this debit note issued?"
                  />
                  <FormInput
                    name="debitNoteDetails.originalInvoiceNumber"
                    label="Original Invoice Number"
                    reactform={form}
                    placeholder="e.g. INV-0001"
                    description="Reference to the original invoice"
                    isOptional={true}
                  />
                </FormRow>
                <DebitNoteFieldKeyNumberValuesSection
                  reactform={form}
                  name="debitNoteDetails.billingDetails"
                  label="Taxes & Adjustments"
                  description="Add SST, adjustments, etc."
                />
              </AccordionContent>
            </AccordionItem>
            {/* Debit Note Items */}
            <AccordionItem value="debit-note-items">
              <AccordionTrigger>Debit Items</AccordionTrigger>
              <AccordionContent>
                <DebitNoteItemsSection form={form} />
              </AccordionContent>
            </AccordionItem>
            {/* Additional Information */}
            <AccordionItem value="additional-info">
              <AccordionTrigger>Notes & Terms</AccordionTrigger>
              <AccordionContent>
                <FormTextarea
                  name="metadata.notes"
                  label="Notes"
                  reactform={form}
                  placeholder="Reason for debit: Additional charges / Price adjustment"
                  description="Any message for your client"
                  isOptional={true}
                />
                <FormTextarea
                  name="metadata.terms"
                  label="Terms & Conditions"
                  reactform={form}
                  placeholder="e.g. Payment is due within 30 days of debit note date."
                  description="Your debit note terms"
                  isOptional={true}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>
      </Form>
    </div>
  );
};

export default DebitNoteForm;
