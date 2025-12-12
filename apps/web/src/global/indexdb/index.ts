import {
  IDB_NAME,
  IDB_VERSION,
  IDB_SCHEMA_INVOICES,
  IDB_SCHEMA_QUOTATIONS,
  IDB_SCHEMA_CREDIT_NOTES,
  IDB_SCHEMA_DEBIT_NOTES,
  IDB_IMAGES,
  IDB_AGENT_THREADS,
  IDB_AGENT_MESSAGES,
} from "@/constants/indexed-db";
import type { IndexedDBSchema } from "@/types/indexdb";
import type { IDBPDatabase } from "idb";
import { openDB } from "idb";

// Singleton instance
let dbInstance: IDBPDatabase<IndexedDBSchema> | null = null;

// Initialize the indexedDB
// This is used to create the object stores when user first opens the app
export const initIndexedDB = async () => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<IndexedDBSchema>(IDB_NAME, IDB_VERSION, {
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

      // Create agent threads object store (T3-style local-first chat)
      if (!db.objectStoreNames.contains(IDB_AGENT_THREADS)) {
        const threadsStore = db.createObjectStore(IDB_AGENT_THREADS, { keyPath: "id" });
        threadsStore.createIndex("id", "id", { unique: true });
        threadsStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Create agent messages object store
      if (!db.objectStoreNames.contains(IDB_AGENT_MESSAGES)) {
        const messagesStore = db.createObjectStore(IDB_AGENT_MESSAGES, { keyPath: "id" });
        messagesStore.createIndex("id", "id", { unique: true });
        messagesStore.createIndex("threadId", "threadId", { unique: false });
        messagesStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    },
  });

  return dbInstance;
};

// Get the DB instance (ensures initialization)
export const getDB = async () => {
  if (!dbInstance) {
    await initIndexedDB();
  }
  return dbInstance!;
};
