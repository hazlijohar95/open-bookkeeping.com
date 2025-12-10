export interface VendorMetadata {
  id: string;
  vendorId: string;
  label: string;
  value: string;
}

export interface Vendor {
  id: string;
  userId: string;

  // Basic Information
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;

  // Bank Details
  bankName: string | null;
  bankAccountNumber: string | null;
  bankRoutingNumber: string | null;
  bankSwiftCode: string | null;

  // Tax Identifiers
  taxId: string | null;
  vatNumber: string | null;
  registrationNumber: string | null;

  // Payment Terms
  paymentTermsDays: number | null;
  preferredPaymentMethod: string | null;
  creditLimit: string | null;

  // Custom metadata
  metadata: VendorMetadata[] | null;

  createdAt: Date;
  updatedAt: Date;
}
