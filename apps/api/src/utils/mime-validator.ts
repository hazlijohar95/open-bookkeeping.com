/**
 * MIME type validation utility using magic bytes
 * Validates that file content matches the claimed MIME type
 */

// Magic byte signatures for supported file types
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  // Images
  "image/jpeg": [
    { bytes: [0xff, 0xd8, 0xff] },
  ],
  "image/png": [
    { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  ],
  "image/gif": [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  "image/webp": [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header
    // Note: WebP also has "WEBP" at offset 8, but checking RIFF is usually sufficient
  ],
  "image/bmp": [
    { bytes: [0x42, 0x4d] }, // BM
  ],
  "image/svg+xml": [
    // SVG is text-based, check for XML declaration or svg tag
  ],

  // Documents
  "application/pdf": [
    { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  ],

  // Microsoft Office (OOXML)
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    { bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (ZIP archive)
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    { bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (ZIP archive)
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    { bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (ZIP archive)
  ],

  // Legacy Microsoft Office
  "application/msword": [
    { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // OLE2
  ],
  "application/vnd.ms-excel": [
    { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // OLE2
  ],
  "application/vnd.ms-powerpoint": [
    { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // OLE2
  ],

  // Text formats (these need content-based validation)
  "text/plain": [],
  "text/csv": [],
};

// Allowed MIME types for vault uploads
export const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",

  // Documents
  "application/pdf",

  // Office documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/msword", // .doc
  "application/vnd.ms-excel", // .xls
  "application/vnd.ms-powerpoint", // .ppt

  // Text
  "text/plain",
  "text/csv",
]);

// Extension to MIME type mapping for additional validation
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
  ".bmp": ["image/bmp"],
  ".svg": ["image/svg+xml"],
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".txt": ["text/plain"],
  ".csv": ["text/csv", "text/plain"],
};

/**
 * Detect MIME type from buffer using magic bytes
 */
export function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 8) {
    return null;
  }

  // Check for PDF
  if (matchesMagicBytes(buffer, MAGIC_BYTES["application/pdf"]!)) {
    return "application/pdf";
  }

  // Check for PNG
  if (matchesMagicBytes(buffer, MAGIC_BYTES["image/png"]!)) {
    return "image/png";
  }

  // Check for JPEG
  if (matchesMagicBytes(buffer, MAGIC_BYTES["image/jpeg"]!)) {
    return "image/jpeg";
  }

  // Check for GIF
  if (matchesMagicBytes(buffer, MAGIC_BYTES["image/gif"]!)) {
    return "image/gif";
  }

  // Check for WebP (RIFF header + WEBP at offset 8)
  if (
    matchesMagicBytes(buffer, MAGIC_BYTES["image/webp"]!) &&
    buffer.length >= 12 &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  // Check for BMP
  if (matchesMagicBytes(buffer, MAGIC_BYTES["image/bmp"]!)) {
    return "image/bmp";
  }

  // Check for ZIP-based formats (Office OOXML)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    // It's a ZIP archive - could be docx, xlsx, pptx
    // Return generic ZIP indicator, actual type determined by extension
    return "application/zip";
  }

  // Check for OLE2 (legacy Office)
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return "application/ole2";
  }

  // Check for SVG (text-based)
  const textStart = buffer.toString("utf8", 0, Math.min(buffer.length, 1000));
  if (
    textStart.includes("<svg") ||
    textStart.includes("<?xml") && textStart.includes("<svg")
  ) {
    return "image/svg+xml";
  }

  // Check if it looks like text (for txt/csv)
  if (isLikelyText(buffer)) {
    return "text/plain";
  }

  return null;
}

/**
 * Check if buffer matches any of the magic byte patterns
 */
function matchesMagicBytes(
  buffer: Buffer,
  patterns: { bytes: number[]; offset?: number }[]
): boolean {
  for (const pattern of patterns) {
    const offset = pattern.offset ?? 0;
    if (buffer.length < offset + pattern.bytes.length) {
      continue;
    }

    let matches = true;
    for (let i = 0; i < pattern.bytes.length; i++) {
      if (buffer[offset + i] !== pattern.bytes[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return true;
    }
  }

  return false;
}

/**
 * Check if buffer appears to be text content
 */
function isLikelyText(buffer: Buffer): boolean {
  // Check first 1KB for text-like content
  const sampleSize = Math.min(buffer.length, 1024);
  let textChars = 0;

  for (let i = 0; i < sampleSize; i++) {
    const byte = buffer[i]!;
    // Printable ASCII, tabs, newlines, carriage returns
    if (
      (byte >= 0x20 && byte <= 0x7e) ||
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0d
    ) {
      textChars++;
    }
  }

  // If more than 90% is text-like, consider it text
  return textChars / sampleSize > 0.9;
}

/**
 * Validate that the claimed MIME type matches the file content
 */
export function validateMimeType(
  buffer: Buffer,
  claimedMimeType: string,
  fileName: string
): { valid: boolean; detectedType: string | null; error?: string } {
  // Normalize MIME type
  const normalizedClaimed = claimedMimeType.toLowerCase().split(";")[0]?.trim() ?? "";

  // Check if MIME type is allowed
  if (!ALLOWED_MIME_TYPES.has(normalizedClaimed)) {
    return {
      valid: false,
      detectedType: null,
      error: `File type '${normalizedClaimed}' is not allowed`,
    };
  }

  // Get file extension
  const ext = ("." + (fileName.split(".").pop() ?? "")).toLowerCase();
  const allowedMimesForExt = EXTENSION_MIME_MAP[ext];

  // Validate extension matches claimed MIME type
  if (allowedMimesForExt && !allowedMimesForExt.includes(normalizedClaimed)) {
    return {
      valid: false,
      detectedType: null,
      error: `File extension '${ext}' does not match claimed type '${normalizedClaimed}'`,
    };
  }

  // Detect actual MIME type from content
  const detectedType = detectMimeType(buffer);

  // Special handling for ZIP-based Office formats
  if (detectedType === "application/zip") {
    const officeTypes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    if (officeTypes.includes(normalizedClaimed)) {
      return { valid: true, detectedType: normalizedClaimed };
    }
  }

  // Special handling for OLE2-based Office formats
  if (detectedType === "application/ole2") {
    const legacyOfficeTypes = [
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
    ];
    if (legacyOfficeTypes.includes(normalizedClaimed)) {
      return { valid: true, detectedType: normalizedClaimed };
    }
  }

  // Special handling for text-based formats
  if (detectedType === "text/plain") {
    if (normalizedClaimed === "text/plain" || normalizedClaimed === "text/csv") {
      return { valid: true, detectedType: normalizedClaimed };
    }
    // SVG might also be detected as text initially
    if (normalizedClaimed === "image/svg+xml") {
      const textContent = buffer.toString("utf8", 0, Math.min(buffer.length, 2000));
      if (textContent.includes("<svg")) {
        return { valid: true, detectedType: "image/svg+xml" };
      }
    }
  }

  // Direct match
  if (detectedType === normalizedClaimed) {
    return { valid: true, detectedType };
  }

  // If we couldn't detect the type but extension matches, allow it with warning
  if (!detectedType && allowedMimesForExt?.includes(normalizedClaimed)) {
    return { valid: true, detectedType: normalizedClaimed };
  }

  // Mismatch
  if (detectedType && detectedType !== normalizedClaimed) {
    return {
      valid: false,
      detectedType,
      error: `File content type '${detectedType}' does not match claimed type '${normalizedClaimed}'`,
    };
  }

  // Unknown type
  return {
    valid: false,
    detectedType,
    error: `Unable to verify file type '${normalizedClaimed}'`,
  };
}
