import CreditNoteFieldKeyStringValuesSection from "./helpers/credit-note-field-key-string-value-section";
import CreditNoteFieldKeyNumberValuesSection from "./helpers/credit-note-field-key-number-value-section";
import { Accordion, AccordionItem, AccordionContent, AccordionTrigger } from "@/components/ui/accordion";
import SheetImageSelectorTrigger from "@/components/ui/image/sheet-image-selector-trigger";
import { CreditNoteImageSelectorSheet } from "./helpers/credit-note-image-selector-sheet";
import { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";
import { FormCustomerSelector } from "@/components/ui/form/form-customer-selector";
import { CreditNoteTemplateSelector } from "./helpers/credit-note-templates";
import { FormColorPicker } from "@/components/ui/form/form-color-picker";
import CreditNoteItemsSection from "./helpers/credit-note-items-section";
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

interface CreditNoteFormProps {
  form: UseFormReturn<ZodCreateCreditNoteSchema>;
}

const CreditNoteForm: React.FC<CreditNoteFormProps> = ({ form }) => {
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
            <span className="text-sm font-medium">Credit Note Template</span>
            <div className="">
              <CreditNoteTemplateSelector form={form} />
            </div>
          </div>
          <Accordion type="single" collapsible defaultValue="company-details" className="w-full divide-y border-b">
            {/* Company Details */}
            <AccordionItem value="company-details">
              <AccordionTrigger>Company Details</AccordionTrigger>
              <AccordionContent ref={containerRef} className={cn(containerWidth > 1200 ? "flex-row gap-4" : "flex-col")}>
                <div className={cn(containerWidth > 1200 ? "w-fit" : "w-full [&>*]:w-full", "flex flex-row gap-4")}>
                  <CreditNoteImageSelectorSheet
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
                  </CreditNoteImageSelectorSheet>
                  <CreditNoteImageSelectorSheet
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
                  </CreditNoteImageSelectorSheet>
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
                  <CreditNoteFieldKeyStringValuesSection
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
              <AccordionTrigger>Credit To</AccordionTrigger>
              <AccordionContent>
                <FormCustomerSelector
                  name="customerId"
                  label="Select Customer"
                  placeholder="Search and select a customer..."
                  reactform={form}
                  description="Link this credit note to an existing customer"
                  onCustomerSelect={handleCustomerSelect}
                  isOptional
                />
                <FormInput
                  name="clientDetails.name"
                  label="Client / Customer Name"
                  reactform={form}
                  placeholder="Client Company Sdn Bhd"
                  description="Who is this credit note for?"
                />
                <FormTextarea
                  className="h-20"
                  name="clientDetails.address"
                  label="Client Address"
                  reactform={form}
                  placeholder="No. 456, Jalan Sultan Ismail&#10;50250 Kuala Lumpur, Malaysia"
                />
                <CreditNoteFieldKeyStringValuesSection
                  reactform={form}
                  name="clientDetails.metadata"
                  label="Additional Details"
                  description="Add extra info like SSM No., contact person"
                />
              </AccordionContent>
            </AccordionItem>
            {/* Credit Note Details */}
            <AccordionItem value="credit-note-details">
              <AccordionTrigger>Credit Note Details</AccordionTrigger>
              <AccordionContent>
                <FormRow>
                  <FormSelect
                    name="creditNoteDetails.currency"
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
                  {form.watch("creditNoteDetails.theme.template") !== "cynco" && (
                    <>
                      <FormSelect
                        name="creditNoteDetails.theme.mode"
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
                        name="creditNoteDetails.theme.baseColor"
                        label="Accent Color"
                        reactform={form}
                        description="Brand color for your credit note"
                      />
                    </>
                  )}
                </FormRow>
                <FormRow>
                  <FormInput
                    name="creditNoteDetails.prefix"
                    label="Credit Note Prefix"
                    reactform={form}
                    placeholder="CN-"
                    description="Text before credit note number"
                    isOptional={true}
                  />
                  <FormInput
                    name="creditNoteDetails.serialNumber"
                    label="Credit Note Number"
                    reactform={form}
                    placeholder="0001"
                    description="Unique credit note number"
                  />
                </FormRow>
                <FormRow>
                  <FormDatePicker
                    name="creditNoteDetails.date"
                    label="Credit Note Date"
                    reactform={form}
                    description="When was this credit note issued?"
                  />
                  <FormInput
                    name="creditNoteDetails.originalInvoiceNumber"
                    label="Original Invoice Number"
                    reactform={form}
                    placeholder="e.g. INV-0001"
                    description="Reference to the original invoice"
                    isOptional={true}
                  />
                </FormRow>
                <CreditNoteFieldKeyNumberValuesSection
                  reactform={form}
                  name="creditNoteDetails.billingDetails"
                  label="Taxes & Adjustments"
                  description="Add SST, adjustments, etc."
                />
              </AccordionContent>
            </AccordionItem>
            {/* Credit Note Items */}
            <AccordionItem value="credit-note-items">
              <AccordionTrigger>Credit Items</AccordionTrigger>
              <AccordionContent>
                <CreditNoteItemsSection form={form} />
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
                  placeholder="Reason for credit: Returned goods / Pricing adjustment"
                  description="Any message for your client"
                  isOptional={true}
                />
                <FormTextarea
                  name="metadata.terms"
                  label="Terms & Conditions"
                  reactform={form}
                  placeholder="e.g. This credit note can be applied to future purchases."
                  description="Your credit note terms"
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

export default CreditNoteForm;
