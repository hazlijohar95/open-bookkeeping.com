import { ZodCreateCreditNoteSchema } from "@/zod-schemas/credit-note/create-credit-note";
import { IDB_SCHEMA_CREDIT_NOTES } from "@/constants/indexed-db";
import { IDBCreditNote } from "@/types/indexdb/credit-note";
import { ERROR_MESSAGES } from "@/constants/issues";
import { initIndexedDB } from "@/global/indexdb";
import { v4 as uuidv4 } from "uuid";

/**
 * Force insert a credit note into the database
 * @param creditNote - The credit note to insert
 * @returns {Promise<string>} The id of the inserted credit note
 */
export const forceInsertCreditNote = async (creditNote: ZodCreateCreditNoteSchema): Promise<string> => {
  const db = await initIndexedDB();

  const id = uuidv4();

  await db.put(IDB_SCHEMA_CREDIT_NOTES, {
    id: id,
    type: "local",
    status: "draft",
    creditNoteFields: creditNote,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return id;
};

/**
 * Get all credit notes from the database
 * @returns {Promise<IDBCreditNote[]>}
 */
export const getAllCreditNotes = async (): Promise<IDBCreditNote[]> => {
  const db = await initIndexedDB();
  return await db.getAll(IDB_SCHEMA_CREDIT_NOTES);
};

/**
 * Get a credit note from the database by id
 * @param id - The id of the credit note
 * @returns {Promise<IDBCreditNote>}
 */
export const getCreditNoteById = async (id: string): Promise<IDBCreditNote | undefined> => {
  const db = await initIndexedDB();
  return await db.get(IDB_SCHEMA_CREDIT_NOTES, id);
};

/**
 * Update a credit note in the database
 * @param id - The id of the credit note
 * @param creditNote - The credit note to update
 * @returns {Promise<void>}
 */
export const updateCreditNote = async (id: string, creditNote: ZodCreateCreditNoteSchema): Promise<void> => {
  const db = await initIndexedDB();

  const oldCreditNote = await db.get(IDB_SCHEMA_CREDIT_NOTES, id);

  if (!oldCreditNote) {
    throw new Error(ERROR_MESSAGES.CREDIT_NOTE_NOT_FOUND);
  }

  // first we delete the old credit note with the id
  await db.delete(IDB_SCHEMA_CREDIT_NOTES, id);

  // then we add the new credit note
  await db.put(IDB_SCHEMA_CREDIT_NOTES, {
    ...oldCreditNote,
    id: oldCreditNote.id,
    updatedAt: new Date(),
    creditNoteFields: creditNote,
  });
};

/**
 * Delete a credit note from the database
 * @param id - The id of the credit note
 * @returns {Promise<void>}
 */
export const deleteCreditNote = async (id: string): Promise<void> => {
  const db = await initIndexedDB();
  await db.delete(IDB_SCHEMA_CREDIT_NOTES, id);
};
