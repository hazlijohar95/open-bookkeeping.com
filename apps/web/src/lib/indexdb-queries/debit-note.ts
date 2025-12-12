import type { ZodCreateDebitNoteSchema } from "@/zod-schemas/debit-note/create-debit-note";
import { IDB_SCHEMA_DEBIT_NOTES } from "@/constants/indexed-db";
import type { IDBDebitNote } from "@/types/indexdb/debit-note";
import { ERROR_MESSAGES } from "@/constants/issues";
import { initIndexedDB } from "@/global/indexdb";
import { v4 as uuidv4 } from "uuid";

/**
 * Force insert a debit note into the database
 * @param debitNote - The debit note to insert
 * @returns {Promise<string>} The id of the inserted debit note
 */
export const forceInsertDebitNote = async (debitNote: ZodCreateDebitNoteSchema): Promise<string> => {
  const db = await initIndexedDB();

  const id = uuidv4();

  await db.put(IDB_SCHEMA_DEBIT_NOTES, {
    id: id,
    type: "local",
    status: "draft",
    debitNoteFields: debitNote,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return id;
};

/**
 * Get all debit notes from the database
 * @returns {Promise<IDBDebitNote[]>}
 */
export const getAllDebitNotes = async (): Promise<IDBDebitNote[]> => {
  const db = await initIndexedDB();
  return await db.getAll(IDB_SCHEMA_DEBIT_NOTES);
};

/**
 * Get a debit note from the database by id
 * @param id - The id of the debit note
 * @returns {Promise<IDBDebitNote>}
 */
export const getDebitNoteById = async (id: string): Promise<IDBDebitNote | undefined> => {
  const db = await initIndexedDB();
  return await db.get(IDB_SCHEMA_DEBIT_NOTES, id);
};

/**
 * Update a debit note in the database
 * @param id - The id of the debit note
 * @param debitNote - The debit note to update
 * @returns {Promise<void>}
 */
export const updateDebitNote = async (id: string, debitNote: ZodCreateDebitNoteSchema): Promise<void> => {
  const db = await initIndexedDB();

  const oldDebitNote = await db.get(IDB_SCHEMA_DEBIT_NOTES, id);

  if (!oldDebitNote) {
    throw new Error(ERROR_MESSAGES.DEBIT_NOTE_NOT_FOUND);
  }

  // first we delete the old debit note with the id
  await db.delete(IDB_SCHEMA_DEBIT_NOTES, id);

  // then we add the new debit note
  await db.put(IDB_SCHEMA_DEBIT_NOTES, {
    ...oldDebitNote,
    id: oldDebitNote.id,
    updatedAt: new Date(),
    debitNoteFields: debitNote,
  });
};

/**
 * Delete a debit note from the database
 * @param id - The id of the debit note
 * @returns {Promise<void>}
 */
export const deleteDebitNote = async (id: string): Promise<void> => {
  const db = await initIndexedDB();
  await db.delete(IDB_SCHEMA_DEBIT_NOTES, id);
};
