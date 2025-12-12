import InvoiceFieldKeyStringValuesSection from "./helpers/invoice-field-key-string-value-section";
import InvoiceFieldKeyNumberValuesSection from "./helpers/invoice-field-key-number-value-section";
import { Accordion, AccordionItem, AccordionContent, AccordionTrigger } from "@/components/ui/accordion";
import SheetImageSelectorTrigger from "@/components/ui/image/sheet-image-selector-trigger";
import { InvoiceImageSelectorSheet } from "./helpers/invoice-image-selector-sheet";
import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { FormCustomerSelector } from "@/components/ui/form/form-customer-selector";
import { InvoiceTemplateSelector } from "./helpers/invoice-templates";
import { FormColorPicker } from "@/components/ui/form/form-color-picker";
import InvoiceItemsSection from "./helpers/invoice-items-section";
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
import type { UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers";
import { cn } from "@/lib/utils";
import React, { useCallback } from "react";
import { addDays } from "date-fns";
import { useContainerWidth } from "@/hooks/use-container-width";

interface InvoiceFormProps {
  form: UseFormReturn<ZodCreateInvoiceSchema>;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ form }) => {
  const { ref: containerRef, width: containerWidth } = useContainerWidth();
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
        form.setValue("clientDetails.address", customer.address ?? "");
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

  // Calculate and set due date based on payment terms - called via event handler
  const handlePaymentTermsChange = useCallback(
    (value: string | number) => {
      const paymentTerms = String(value);
      const invoiceDate = form.getValues("invoiceDetails.date");

      if (!paymentTerms || !invoiceDate) return;

      // Extract number of days from payment terms
      const lowerTerms = paymentTerms.toLowerCase();
      let days: number | null = null;

      // Match patterns like "net 30", "30 days", "within 14 days"
      const netMatch = lowerTerms.match(/net\s*(\d+)/);
      const daysMatch = lowerTerms.match(/(\d+)\s*days?/);

      if (netMatch?.[1]) {
        days = parseInt(netMatch[1], 10);
      } else if (daysMatch?.[1]) {
        days = parseInt(daysMatch[1], 10);
      }

      // Only auto-set if we found a valid number of days
      if (days !== null && days > 0 && days <= 365) {
        const newDueDate = addDays(invoiceDate, days);
        form.setValue("invoiceDetails.dueDate", newDueDate);
      }
    },
    [form]
  );


  return (
    <div className="scroll-bar-hidden flex h-full flex-col overflow-y-scroll">
      <Form {...form}>
        <form>
          <div className="flex h-14 flex-row items-center justify-between border-b px-4">
            <span className="text-sm font-medium">Invoice Template</span>
            <div className="">
              <InvoiceTemplateSelector form={form} />
            </div>
          </div>
          <Accordion type="single" collapsible defaultValue="company-details" className="w-full divide-y border-b">
            {/* Company Details */}
            <AccordionItem value="company-details">
              <AccordionTrigger>Company Details</AccordionTrigger>
              <AccordionContent ref={containerRef} className={cn(containerWidth > 1200 ? "flex-row gap-4" : "flex-col")}>
                <div className={cn(containerWidth > 1200 ? "w-fit" : "w-full [&>*]:w-full", "flex flex-row gap-4")}>
                  <InvoiceImageSelectorSheet
                    type="logo"
                    isLoading={idbImages.isLoading}
                    idbImages={idbImages.data ?? []}
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
                  </InvoiceImageSelectorSheet>
                  <InvoiceImageSelectorSheet
                    type="signature"
                    isLoading={idbImages.isLoading}
                    idbImages={idbImages.data ?? []}
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
                  </InvoiceImageSelectorSheet>
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
                  <InvoiceFieldKeyStringValuesSection
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
              <AccordionTrigger>Bill To</AccordionTrigger>
              <AccordionContent>
                <FormCustomerSelector
                  name="customerId"
                  label="Select Customer"
                  placeholder="Search and select a customer..."
                  reactform={form}
                  description="Link this invoice to an existing customer"
                  onCustomerSelect={handleCustomerSelect}
                  isOptional
                />
                <FormInput
                  name="clientDetails.name"
                  label="Client / Customer Name"
                  reactform={form}
                  placeholder="Client Company Sdn Bhd"
                  description="Who are you billing?"
                />
                <FormTextarea
                  className="h-20"
                  name="clientDetails.address"
                  label="Client Address"
                  reactform={form}
                  placeholder="No. 456, Jalan Sultan Ismail&#10;50250 Kuala Lumpur, Malaysia"
                />
                <InvoiceFieldKeyStringValuesSection
                  reactform={form}
                  name="clientDetails.metadata"
                  label="Additional Details"
                  description="Add extra info like SSM No., contact person"
                />
              </AccordionContent>
            </AccordionItem>
            {/* Invoice Details */}
            <AccordionItem value="invoice-details">
              <AccordionTrigger>Invoice Details</AccordionTrigger>
              <AccordionContent>
                <FormRow>
                  <FormSelect
                    name="invoiceDetails.currency"
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
                  {form.watch("invoiceDetails.theme.template") !== "cynco" && (
                    <>
                      <FormSelect
                        name="invoiceDetails.theme.mode"
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
                        name="invoiceDetails.theme.baseColor"
                        label="Accent Color"
                        reactform={form}
                        description="Brand color for your invoice"
                      />
                    </>
                  )}
                </FormRow>
                <FormRow>
                  <FormInput
                    name="invoiceDetails.prefix"
                    label="Invoice Prefix"
                    reactform={form}
                    placeholder="INV-"
                    description="Text before invoice number"
                    isOptional={true}
                  />
                  <FormInput
                    name="invoiceDetails.serialNumber"
                    label="Invoice Number"
                    reactform={form}
                    placeholder="0001"
                    description="Unique invoice number"
                  />
                </FormRow>
                <FormRow>
                  <FormInput
                    name="invoiceDetails.poNumber"
                    label="PO Number"
                    reactform={form}
                    placeholder="PO-12345"
                    description="Client's purchase order number"
                    isOptional={true}
                  />
                  <FormInput
                    name="invoiceDetails.referenceNumber"
                    label="Reference Number"
                    reactform={form}
                    placeholder="REF-001"
                    description="Your internal reference"
                    isOptional={true}
                  />
                </FormRow>
                <FormRow>
                  <FormDatePicker
                    name="invoiceDetails.date"
                    label="Invoice Date"
                    reactform={form}
                    description="When was this invoice issued?"
                  />
                  <FormDatePicker
                    name="invoiceDetails.dueDate"
                    label="Due Date"
                    reactform={form}
                    description="When should payment be made?"
                    isOptional={true}
                  />
                </FormRow>
                <FormInput
                  name="invoiceDetails.paymentTerms"
                  label="Payment Terms"
                  reactform={form}
                  placeholder="e.g. 50% upfront, balance upon completion"
                  description="Any special payment conditions"
                  isOptional={true}
                  onValueChange={handlePaymentTermsChange}
                />
                <InvoiceFieldKeyNumberValuesSection
                  reactform={form}
                  name="invoiceDetails.billingDetails"
                  label="Taxes & Discounts"
                  description="Add SST, service tax, discounts, etc."
                />
              </AccordionContent>
            </AccordionItem>
            {/* Invoice Items */}
            <AccordionItem value="invoice-items">
              <AccordionTrigger>Products & Services</AccordionTrigger>
              <AccordionContent>
                <InvoiceItemsSection form={form} />
              </AccordionContent>
            </AccordionItem>
            {/* Additional Information */}
            <AccordionItem value="additional-info">
              <AccordionTrigger>Notes & Payment</AccordionTrigger>
              <AccordionContent>
                <FormTextarea
                  name="metadata.notes"
                  label="Notes"
                  reactform={form}
                  placeholder="Thank you for your business!"
                  description="Any message for your client"
                  isOptional={true}
                />
                <FormTextarea
                  name="metadata.terms"
                  label="Terms & Conditions"
                  reactform={form}
                  placeholder="e.g. Payment is due within 30 days. Late payments may incur additional charges."
                  description="Your payment policies"
                  isOptional={true}
                />
                <InvoiceFieldKeyStringValuesSection
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

export default InvoiceForm;
