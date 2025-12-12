import type { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";
import { IDB_SCHEMA_QUOTATIONS } from "@/constants/indexed-db";
import type { IDBQuotation } from "@/types/indexdb/quotation";
import { ERROR_MESSAGES } from "@/constants/issues";
import { initIndexedDB } from "@/global/indexdb";
import { v4 as uuidv4 } from "uuid";

/**
 * Force insert a quotation into the database
 * @param quotation - The quotation to insert
 * @returns {Promise<string>} The id of the inserted quotation
 */
export const forceInsertQuotation = async (quotation: ZodCreateQuotationSchema): Promise<string> => {
  const db = await initIndexedDB();

  const id = uuidv4();

  await db.put(IDB_SCHEMA_QUOTATIONS, {
    id: id,
    type: "local",
    status: "draft",
    quotationFields: quotation,
    createdAt: new Date(),
    updatedAt: new Date(),
    acceptedAt: null,
  });

  return id;
};

/**
 * Get all quotations from the database
 * @returns {Promise<IDBQuotation[]>}
 */
export const getAllQuotations = async (): Promise<IDBQuotation[]> => {
  const db = await initIndexedDB();
  return await db.getAll(IDB_SCHEMA_QUOTATIONS);
};

/**
 * Get a quotation from the database by id
 * @param id - The id of the quotation
 * @returns {Promise<IDBQuotation>}
 */
export const getQuotationById = async (id: string): Promise<IDBQuotation | undefined> => {
  const db = await initIndexedDB();
  return await db.get(IDB_SCHEMA_QUOTATIONS, id);
};

/**
 * Update a quotation in the database
 * @param id - The id of the quotation
 * @param quotation - The quotation to update
 * @returns {Promise<void>}
 */
export const updateQuotation = async (id: string, quotation: ZodCreateQuotationSchema): Promise<void> => {
  const db = await initIndexedDB();

  const oldQuotation = await db.get(IDB_SCHEMA_QUOTATIONS, id);

  if (!oldQuotation) {
    throw new Error(ERROR_MESSAGES.QUOTATION_NOT_FOUND);
  }

  // first we delete the old quotation with the id
  await db.delete(IDB_SCHEMA_QUOTATIONS, id);

  // then we add the new quotation
  await db.put(IDB_SCHEMA_QUOTATIONS, {
    ...oldQuotation,
    id: oldQuotation.id,
    updatedAt: new Date(),
    quotationFields: quotation,
  });
};

/**
 * Delete a quotation from the database
 * @param id - The id of the quotation
 * @returns {Promise<void>}
 */
export const deleteQuotation = async (id: string): Promise<void> => {
  const db = await initIndexedDB();
  await db.delete(IDB_SCHEMA_QUOTATIONS, id);
};
