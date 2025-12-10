import {
  IDB_NAME,
  IDB_VERSION,
  IDB_SCHEMA_INVOICES,
  IDB_SCHEMA_QUOTATIONS,
  IDB_SCHEMA_CREDIT_NOTES,
  IDB_SCHEMA_DEBIT_NOTES,
  IDB_IMAGES,
} from "@/constants/indexed-db";
import { IndexedDBSchema } from "@/types/indexdb";
import { openDB } from "idb";

// Initialize the indexedDB
// This is used to create the object stores when user first opens the app
export const initIndexedDB = async () => {
  return await openDB<IndexedDBSchema>(IDB_NAME, IDB_VERSION, {
    upgrade(db) {
      // Create invoices object store
      if (!db.objectStoreNames.contains(IDB_SCHEMA_INVOICES)) {
        const invoicesStore = db.createObjectStore(IDB_SCHEMA_INVOICES, { keyPath: "id" });
        invoicesStore.createIndex("id", "id", { unique: true });
      }

      // Create quotations object store
      if (!db.objectStoreNames.contains(IDB_SCHEMA_QUOTATIONS)) {
        const quotationsStore = db.createObjectStore(IDB_SCHEMA_QUOTATIONS, { keyPath: "id" });
        quotationsStore.createIndex("id", "id", { unique: true });
      }

      // Create credit notes object store
      if (!db.objectStoreNames.contains(IDB_SCHEMA_CREDIT_NOTES)) {
        const creditNotesStore = db.createObjectStore(IDB_SCHEMA_CREDIT_NOTES, { keyPath: "id" });
        creditNotesStore.createIndex("id", "id", { unique: true });
      }

      // Create debit notes object store
      if (!db.objectStoreNames.contains(IDB_SCHEMA_DEBIT_NOTES)) {
        const debitNotesStore = db.createObjectStore(IDB_SCHEMA_DEBIT_NOTES, { keyPath: "id" });
        debitNotesStore.createIndex("id", "id", { unique: true });
      }

      // Create images object store
      if (!db.objectStoreNames.contains(IDB_IMAGES)) {
        const imagesStore = db.createObjectStore(IDB_IMAGES, { keyPath: "id" });
        imagesStore.createIndex("id", "id", { unique: true });
      }
    },
  });
};
