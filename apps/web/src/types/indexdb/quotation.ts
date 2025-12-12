import type { quotationTypeEnum, quotationStatusEnum } from "@open-bookkeeping/db";
import type { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";

export type QuotationTypeType = (typeof quotationTypeEnum.enumValues)[number];
export type QuotationStatusType = (typeof quotationStatusEnum.enumValues)[number];

export interface IDBQuotation {
  id: string;
  type: QuotationTypeType;
  createdAt: Date;
  updatedAt: Date;
  status: QuotationStatusType;
  acceptedAt: Date | null;
  quotationFields: ZodCreateQuotationSchema;
}
