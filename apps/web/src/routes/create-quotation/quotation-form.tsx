import QuotationFieldKeyStringValuesSection from "./helpers/quotation-field-key-string-value-section";
import QuotationFieldKeyNumberValuesSection from "./helpers/quotation-field-key-number-value-section";
import { Accordion, AccordionItem, AccordionContent, AccordionTrigger } from "@/components/ui/accordion";
import SheetImageSelectorTrigger from "@/components/ui/image/sheet-image-selector-trigger";
import { QuotationImageSelectorSheet } from "./helpers/quotation-image-selector-sheet";
import { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";
import { FormCustomerSelector } from "@/components/ui/form/form-customer-selector";
import { QuotationTemplateSelector } from "./helpers/quotation-templates";
import { FormColorPicker } from "@/components/ui/form/form-color-picker";
import QuotationItemsSection from "./helpers/quotation-items-section";
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
import React, { useCallback } from "react";
import { useContainerWidth } from "@/hooks/use-container-width";

interface QuotationFormProps {
  form: UseFormReturn<ZodCreateQuotationSchema>;
}

const QuotationForm: React.FC<QuotationFormProps> = ({ form }) => {
  const { ref: containerRef, width: containerWidth } = useContainerWidth<HTMLDivElement>();
  const { user } = useAuth();

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
            <span className="text-sm font-medium">Quotation Template</span>
            <div className="">
              <QuotationTemplateSelector form={form} />
            </div>
          </div>
          <Accordion type="single" collapsible defaultValue="company-details" className="w-full divide-y border-b">
            {/* Company Details */}
            <AccordionItem value="company-details">
              <AccordionTrigger>Company Details</AccordionTrigger>
              <AccordionContent ref={containerRef} className={cn(containerWidth > 1200 ? "flex-row gap-4" : "flex-col")}>
                <div className={cn(containerWidth > 1200 ? "w-fit" : "w-full [&>*]:w-full", "flex flex-row gap-4")}>
                  <QuotationImageSelectorSheet
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
                  </QuotationImageSelectorSheet>
                  <QuotationImageSelectorSheet
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
                  </QuotationImageSelectorSheet>
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
                  <QuotationFieldKeyStringValuesSection
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
              <AccordionTrigger>Quote To</AccordionTrigger>
              <AccordionContent>
                <FormCustomerSelector
                  name="customerId"
                  label="Select Customer"
                  placeholder="Search and select a customer..."
                  reactform={form}
                  description="Link this quotation to an existing customer"
                  onCustomerSelect={handleCustomerSelect}
                  isOptional
                />
                <FormInput
                  name="clientDetails.name"
                  label="Client / Customer Name"
                  reactform={form}
                  placeholder="Client Company Sdn Bhd"
                  description="Who is this quotation for?"
                />
                <FormTextarea
                  className="h-20"
                  name="clientDetails.address"
                  label="Client Address"
                  reactform={form}
                  placeholder="No. 456, Jalan Sultan Ismail&#10;50250 Kuala Lumpur, Malaysia"
                />
                <QuotationFieldKeyStringValuesSection
                  reactform={form}
                  name="clientDetails.metadata"
                  label="Additional Details"
                  description="Add extra info like SSM No., contact person"
                />
              </AccordionContent>
            </AccordionItem>
            {/* Quotation Details */}
            <AccordionItem value="quotation-details">
              <AccordionTrigger>Quotation Details</AccordionTrigger>
              <AccordionContent>
                <FormRow>
                  <FormSelect
                    name="quotationDetails.currency"
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
                  {form.watch("quotationDetails.theme.template") !== "cynco" && (
                    <>
                      <FormSelect
                        name="quotationDetails.theme.mode"
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
                        name="quotationDetails.theme.baseColor"
                        label="Accent Color"
                        reactform={form}
                        description="Brand color for your quotation"
                      />
                    </>
                  )}
                </FormRow>
                <FormRow>
                  <FormInput
                    name="quotationDetails.prefix"
                    label="Quotation Prefix"
                    reactform={form}
                    placeholder="QUO-"
                    description="Text before quotation number"
                    isOptional={true}
                  />
                  <FormInput
                    name="quotationDetails.serialNumber"
                    label="Quotation Number"
                    reactform={form}
                    placeholder="0001"
                    description="Unique quotation number"
                  />
                </FormRow>
                <FormRow>
                  <FormDatePicker
                    name="quotationDetails.date"
                    label="Quotation Date"
                    reactform={form}
                    description="When was this quotation issued?"
                  />
                  <FormDatePicker
                    name="quotationDetails.validUntil"
                    label="Valid Until"
                    reactform={form}
                    description="When does this quotation expire?"
                    isOptional={true}
                  />
                </FormRow>
                <FormInput
                  name="quotationDetails.paymentTerms"
                  label="Payment Terms"
                  reactform={form}
                  placeholder="e.g. 50% upfront, balance upon completion"
                  description="Any special payment conditions"
                  isOptional={true}
                />
                <QuotationFieldKeyNumberValuesSection
                  reactform={form}
                  name="quotationDetails.billingDetails"
                  label="Taxes & Discounts"
                  description="Add SST, service tax, discounts, etc."
                />
              </AccordionContent>
            </AccordionItem>
            {/* Quotation Items */}
            <AccordionItem value="quotation-items">
              <AccordionTrigger>Products & Services</AccordionTrigger>
              <AccordionContent>
                <QuotationItemsSection form={form} />
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
                  placeholder="Thank you for considering our services!"
                  description="Any message for your client"
                  isOptional={true}
                />
                <FormTextarea
                  name="metadata.terms"
                  label="Terms & Conditions"
                  reactform={form}
                  placeholder="e.g. This quotation is valid for 30 days. Prices may change after validity period."
                  description="Your quotation terms"
                  isOptional={true}
                />
                <QuotationFieldKeyStringValuesSection
                  reactform={form}
                  name="metadata.paymentInformation"
                  label="Bank Details"
                  description="Add your bank account info for payment"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </form>
      </Form>
    </div>
  );
};

export default QuotationForm;
