import type { IDBImage, IDBInvoice } from "@/types/indexdb/invoice";
import type { IDBQuotation } from "@/types/indexdb/quotation";
import type { IDBCreditNote } from "@/types/indexdb/credit-note";
import type { IDBDebitNote } from "@/types/indexdb/debit-note";
import type { IDBAgentThread, IDBAgentMessage } from "@/types/indexdb/agent";
import type { DBSchema } from "idb";

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
  // Agent Chat (T3-style local-first)
  agent_threads: {
    key: string;
    value: IDBAgentThread;
    indexes: {
      id: string;
      updatedAt: string;
    };
  };
  agent_messages: {
    key: string;
    value: IDBAgentMessage;
    indexes: {
      id: string;
      threadId: string;
      createdAt: string;
    };
  };
}

export type { IDBAgentThread, IDBAgentMessage, IDBAgentMessagePart } from "@/types/indexdb/agent";
