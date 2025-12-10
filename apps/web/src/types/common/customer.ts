export interface CustomerMetadata {
  id: string;
  customerId: string;
  label: string;
  value: string;
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  metadata: CustomerMetadata[] | null;
  createdAt: Date;
  updatedAt: Date;
}
