export interface BillItem {
  id: string;
  billId: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export type BillStatus = "draft" | "pending" | "paid" | "overdue" | "cancelled";

export interface Vendor {
  id: string;
  name: string;
  email: string | null;
}

export interface Bill {
  id: string;
  userId: string;
  vendorId: string | null;
  billNumber: string;
  description: string | null;
  currency: string;
  billDate: Date;
  dueDate: Date | null;
  status: BillStatus;
  notes: string | null;
  attachmentUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: BillItem[];
  vendor: Vendor | null;
}
