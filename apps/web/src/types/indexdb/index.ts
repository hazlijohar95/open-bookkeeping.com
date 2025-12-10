import { IDBImage, IDBInvoice } from "@/types/indexdb/invoice";
import { IDBQuotation } from "@/types/indexdb/quotation";
import { IDBCreditNote } from "@/types/indexdb/credit-note";
import { IDBDebitNote } from "@/types/indexdb/debit-note";
import { DBSchema } from "idb";

export interface IndexedDBSchema extends DBSchema {
  inv_invoices: {
    key: string;
    value: IDBInvoice;
    indexes: {
      id: string;
    };
  };
  inv_quotations: {
    key: string;
    value: IDBQuotation;
    indexes: {
      id: string;
    };
  };
  inv_credit_notes: {
    key: string;
    value: IDBCreditNote;
    indexes: {
      id: string;
    };
  };
  inv_debit_notes: {
    key: string;
    value: IDBDebitNote;
    indexes: {
      id: string;
    };
  };
  inv_images: {
    key: string;
    value: IDBImage;
    indexes: {
      id: string;
    };
  };
}
