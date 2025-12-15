/**
 * PII Encryption Service
 *
 * Provides application-level encryption for sensitive data like:
 * - Bank account numbers
 * - IC numbers (Malaysian NRIC)
 * - Passport numbers
 * - Tax identification numbers
 *
 * Uses AES-256-GCM encryption via pgcrypto in the database.
 * The encryption key is stored in environment variables and never exposed.
 */

import { db } from "@open-bookkeeping/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@open-bookkeeping/shared";

const logger = createLogger("encryption-service");

// Encryption key from environment - MUST be set in production
const ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  logger.warn("PII_ENCRYPTION_KEY not set - sensitive data will NOT be encrypted!");
}

/**
 * Encrypt sensitive PII data using database-level pgcrypto
 * @param plaintext The sensitive data to encrypt
 * @returns Base64-encoded encrypted data or null if encryption fails
 */
export async function encryptPII(plaintext: string | null | undefined): Promise<string | null> {
  if (!plaintext || !ENCRYPTION_KEY) {
    return null;
  }

  try {
    const result = await db.execute<{ encrypted: Buffer }>(
      sql`SELECT encrypt_pii(${plaintext}, ${ENCRYPTION_KEY}) as encrypted`
    );

    const encrypted = (result as unknown as Array<{ encrypted: Buffer }>)[0]?.encrypted;
    if (!encrypted) {
      return null;
    }

    // Return as base64 for easier storage/transport
    return Buffer.from(encrypted).toString("base64");
  } catch (error) {
    logger.error({ error }, "Failed to encrypt PII data");
    return null;
  }
}

/**
 * Decrypt sensitive PII data
 * @param encryptedBase64 Base64-encoded encrypted data
 * @returns Decrypted plaintext or null if decryption fails
 */
export async function decryptPII(encryptedBase64: string | null | undefined): Promise<string | null> {
  if (!encryptedBase64 || !ENCRYPTION_KEY) {
    return null;
  }

  try {
    // Convert base64 back to buffer for pgcrypto
    const encryptedBuffer = Buffer.from(encryptedBase64, "base64");

    const result = await db.execute<{ decrypted: string }>(
      sql`SELECT decrypt_pii(${encryptedBuffer}::bytea, ${ENCRYPTION_KEY}) as decrypted`
    );

    return (result as unknown as Array<{ decrypted: string }>)[0]?.decrypted ?? null;
  } catch (error) {
    logger.error({ error }, "Failed to decrypt PII data");
    return null;
  }
}

/**
 * Mask sensitive data for display (show only last 4 characters)
 * @param data The data to mask
 * @param visibleChars Number of characters to show at the end
 * @returns Masked string like "****5678"
 */
export function maskPII(data: string | null | undefined, visibleChars: number = 4): string {
  if (!data) {
    return "****";
  }

  if (data.length <= visibleChars) {
    return "*".repeat(data.length);
  }

  const masked = "*".repeat(data.length - visibleChars);
  const visible = data.slice(-visibleChars);
  return masked + visible;
}

/**
 * Check if encryption is properly configured
 */
export function isEncryptionEnabled(): boolean {
  return !!ENCRYPTION_KEY;
}

/**
 * Helper to encrypt and update a record's sensitive field
 * This handles the common pattern of encrypting existing plaintext data
 */
export async function migrateToEncrypted<T extends Record<string, unknown>>(
  tableName: string,
  idColumn: string,
  plaintextColumn: string,
  encryptedColumn: string,
  record: T
): Promise<void> {
  const id = record[idColumn] as string;
  const plaintext = record[plaintextColumn] as string | null;

  if (!plaintext || !ENCRYPTION_KEY) {
    return;
  }

  try {
    // Encrypt the plaintext value
    const encrypted = await encryptPII(plaintext);
    if (!encrypted) {
      return;
    }

    // Update the encrypted column using raw SQL
    const encryptedBuffer = Buffer.from(encrypted, "base64");
    await db.execute(
      sql`UPDATE ${sql.identifier(tableName)} SET ${sql.identifier(encryptedColumn)} = ${encryptedBuffer}::bytea WHERE ${sql.identifier(idColumn)} = ${id}`
    );

    logger.info({ tableName, id, column: plaintextColumn }, "Migrated sensitive field to encrypted");
  } catch (error) {
    logger.error({ error, tableName, id }, "Failed to migrate sensitive field");
  }
}

/**
 * Batch encrypt existing plaintext data for migration
 * Call this once to migrate existing unencrypted data
 */
export async function batchEncryptExistingData(): Promise<{
  vendors: number;
  employees: number;
  paySlips: number;
}> {
  if (!ENCRYPTION_KEY) {
    logger.warn("Cannot batch encrypt - PII_ENCRYPTION_KEY not set");
    return { vendors: 0, employees: 0, paySlips: 0 };
  }

  const results = { vendors: 0, employees: 0, paySlips: 0 };

  try {
    // Vendors: encrypt bank_account_number
    const vendorResult = await db.execute(sql`
      UPDATE vendors
      SET bank_account_number_encrypted = encrypt_pii(bank_account_number, ${ENCRYPTION_KEY})
      WHERE bank_account_number IS NOT NULL
        AND bank_account_number != ''
        AND bank_account_number_encrypted IS NULL
    `);
    results.vendors = (vendorResult as { rowCount?: number }).rowCount ?? 0;

    // Employees: encrypt multiple fields
    const employeeResult = await db.execute(sql`
      UPDATE employees
      SET
        ic_number_encrypted = CASE WHEN ic_number IS NOT NULL AND ic_number != '' THEN encrypt_pii(ic_number, ${ENCRYPTION_KEY}) ELSE ic_number_encrypted END,
        passport_number_encrypted = CASE WHEN passport_number IS NOT NULL AND passport_number != '' THEN encrypt_pii(passport_number, ${ENCRYPTION_KEY}) ELSE passport_number_encrypted END,
        bank_account_number_encrypted = CASE WHEN bank_account_number IS NOT NULL AND bank_account_number != '' THEN encrypt_pii(bank_account_number, ${ENCRYPTION_KEY}) ELSE bank_account_number_encrypted END,
        tax_number_encrypted = CASE WHEN tax_number IS NOT NULL AND tax_number != '' THEN encrypt_pii(tax_number, ${ENCRYPTION_KEY}) ELSE tax_number_encrypted END
      WHERE (ic_number IS NOT NULL AND ic_number_encrypted IS NULL)
         OR (passport_number IS NOT NULL AND passport_number_encrypted IS NULL)
         OR (bank_account_number IS NOT NULL AND bank_account_number_encrypted IS NULL)
         OR (tax_number IS NOT NULL AND tax_number_encrypted IS NULL)
    `);
    results.employees = (employeeResult as { rowCount?: number }).rowCount ?? 0;

    // Pay slips: encrypt snapshots
    const paySlipResult = await db.execute(sql`
      UPDATE pay_slips
      SET
        ic_number_encrypted = CASE WHEN ic_number IS NOT NULL AND ic_number != '' THEN encrypt_pii(ic_number, ${ENCRYPTION_KEY}) ELSE ic_number_encrypted END,
        bank_account_number_encrypted = CASE WHEN bank_account_number IS NOT NULL AND bank_account_number != '' THEN encrypt_pii(bank_account_number, ${ENCRYPTION_KEY}) ELSE bank_account_number_encrypted END
      WHERE (ic_number IS NOT NULL AND ic_number_encrypted IS NULL)
         OR (bank_account_number IS NOT NULL AND bank_account_number_encrypted IS NULL)
    `);
    results.paySlips = (paySlipResult as { rowCount?: number }).rowCount ?? 0;

    logger.info(results, "Batch encryption completed");
  } catch (error) {
    logger.error({ error }, "Batch encryption failed");
  }

  return results;
}

export const encryptionService = {
  encryptPII,
  decryptPII,
  maskPII,
  isEncryptionEnabled,
  migrateToEncrypted,
  batchEncryptExistingData,
};
