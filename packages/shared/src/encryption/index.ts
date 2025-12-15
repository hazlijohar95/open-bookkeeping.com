/**
 * Application-Level Encryption Module
 *
 * Provides AES-256-GCM encryption for sensitive data such as:
 * - Bank account numbers
 * - IC numbers (Malaysian Identity Card)
 * - Passport numbers
 * - Other PII (Personally Identifiable Information)
 *
 * SECURITY NOTES:
 * - Uses AES-256-GCM for authenticated encryption
 * - Random IV generated for each encryption operation
 * - ENCRYPTION_KEY must be a 32-byte (256-bit) hex string
 * - Set ENCRYPTION_KEY in environment variables (never commit to code)
 *
 * Usage:
 *   const encrypted = encrypt('sensitive-data');
 *   const decrypted = decrypt(encrypted);
 */

import crypto from "crypto";

// Constants
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended IV length
const AUTH_TAG_LENGTH = 16; // GCM authentication tag length
const KEY_LENGTH = 32; // 256 bits

// Separator for encoding (IV:TAG:CIPHERTEXT)
const SEPARATOR = ":";

/**
 * Get the encryption key from environment
 * Key must be a 64-character hex string (32 bytes)
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: openssl rand -hex 32"
    );
  }

  if (keyHex.length !== 64) {
    throw new Error(
      `ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got ${keyHex.length} characters.`
    );
  }

  const key = Buffer.from(keyHex, "hex");

  if (key.length !== KEY_LENGTH) {
    throw new Error("Invalid ENCRYPTION_KEY format. Must be a valid hex string.");
  }

  return key;
}

/**
 * Encrypt sensitive data
 *
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: IV:AUTH_TAG:CIPHERTEXT (all base64)
 * @throws Error if ENCRYPTION_KEY is not set or invalid
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  const key = getEncryptionKey();

  // Generate random IV for each encryption
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Encrypt
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine IV:TAG:CIPHERTEXT
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted,
  ].join(SEPARATOR);
}

/**
 * Decrypt sensitive data
 *
 * @param ciphertext - Encrypted string in format: IV:AUTH_TAG:CIPHERTEXT
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails or data is tampered
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) {
    return ciphertext;
  }

  const key = getEncryptionKey();

  // Split IV:TAG:CIPHERTEXT
  const parts = ciphertext.split(SEPARATOR);
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [ivBase64, authTagBase64, encryptedData] = parts;

  // Decode from base64
  const iv = Buffer.from(ivBase64!, "base64");
  const authTag = Buffer.from(authTagBase64!, "base64");

  // Validate lengths
  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid authentication tag length");
  }

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Set auth tag for verification
  decipher.setAuthTag(authTag);

  // Decrypt
  try {
    let decrypted = decipher.update(encryptedData!, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    // Re-throw with more context
    if (error instanceof Error && error.message.includes("Unsupported state")) {
      throw new Error("Decryption failed: Data may be tampered or key is incorrect");
    }
    throw error;
  }
}

/**
 * Check if a string appears to be encrypted
 * (Has the IV:TAG:CIPHERTEXT format)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;

  const parts = value.split(SEPARATOR);
  if (parts.length !== 3) return false;

  try {
    const iv = Buffer.from(parts[0]!, "base64");
    const authTag = Buffer.from(parts[1]!, "base64");
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Encrypt if not already encrypted
 * Safe to call multiple times on the same value
 */
export function encryptIfNeeded(value: string): string {
  if (!value || isEncrypted(value)) {
    return value;
  }
  return encrypt(value);
}

/**
 * Decrypt if encrypted, otherwise return as-is
 * Safe to call on both encrypted and plaintext values
 */
export function decryptIfNeeded(value: string): string {
  if (!value || !isEncrypted(value)) {
    return value;
  }
  return decrypt(value);
}

/**
 * Hash a value for indexing/searching (one-way)
 * Use this when you need to search for a value without storing it in plaintext
 *
 * @param value - The value to hash
 * @returns SHA-256 hash of the value
 */
export function hashForSearch(value: string): string {
  if (!value) return value;

  const key = getEncryptionKey();

  // HMAC with the encryption key for keyed hashing
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

/**
 * Mask sensitive data for display
 * Shows only first and last few characters
 *
 * @param value - The sensitive value to mask
 * @param showFirst - Number of characters to show at start (default 2)
 * @param showLast - Number of characters to show at end (default 4)
 * @returns Masked string like "12****5678"
 */
export function maskSensitiveData(
  value: string,
  showFirst: number = 2,
  showLast: number = 4
): string {
  if (!value) return value;

  const minLength = showFirst + showLast + 2;
  if (value.length < minLength) {
    // For short values, just show asterisks
    return "*".repeat(value.length);
  }

  const start = value.substring(0, showFirst);
  const end = value.substring(value.length - showLast);
  const masked = "*".repeat(value.length - showFirst - showLast);

  return `${start}${masked}${end}`;
}
