import { invoiceTypeEnum, invoiceStatusEnum } from "@open-bookkeeping/db";
import { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { InvoiceImageType } from "../common/invoice";

export type InvoiceTypeType = (typeof invoiceTypeEnum.enumValues)[number];
export type InvoiceStatusType = (typeof invoiceStatusEnum.enumValues)[number];

export interface IDBInvoice {
  id: string;
  type: InvoiceTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: InvoiceStatusType;
  paidAt: Date | null;
  invoiceFields: ZodCreateInvoiceSchema;
}

export interface IDBImage {
  id: string;
  type: InvoiceImageType;
  createdAt: Date;
  base64: string;
}
