import { describe, it, expect } from "vitest";
import { detectMimeType, validateMimeType, ALLOWED_MIME_TYPES } from "../utils/mime-validator";

describe("MIME Validator", () => {
  describe("ALLOWED_MIME_TYPES", () => {
    it("should include common image types", () => {
      expect(ALLOWED_MIME_TYPES.has("image/jpeg")).toBe(true);
      expect(ALLOWED_MIME_TYPES.has("image/png")).toBe(true);
      expect(ALLOWED_MIME_TYPES.has("image/gif")).toBe(true);
      expect(ALLOWED_MIME_TYPES.has("image/webp")).toBe(true);
      expect(ALLOWED_MIME_TYPES.has("image/svg+xml")).toBe(true);
    });

    it("should include PDF", () => {
      expect(ALLOWED_MIME_TYPES.has("application/pdf")).toBe(true);
    });

    it("should include Office formats", () => {
      expect(ALLOWED_MIME_TYPES.has("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
      expect(ALLOWED_MIME_TYPES.has("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    });

    it("should include text formats", () => {
      expect(ALLOWED_MIME_TYPES.has("text/plain")).toBe(true);
      expect(ALLOWED_MIME_TYPES.has("text/csv")).toBe(true);
    });

    it("should not include executable types", () => {
      expect(ALLOWED_MIME_TYPES.has("application/x-executable")).toBe(false);
      expect(ALLOWED_MIME_TYPES.has("application/javascript")).toBe(false);
    });
  });

  describe("detectMimeType", () => {
    it("should detect PNG from magic bytes", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      expect(detectMimeType(pngBuffer)).toBe("image/png");
    });

    it("should detect JPEG from magic bytes", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(detectMimeType(jpegBuffer)).toBe("image/jpeg");
    });

    it("should detect PDF from magic bytes", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      expect(detectMimeType(pdfBuffer)).toBe("application/pdf");
    });

    it("should detect GIF87a from magic bytes", () => {
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00]);
      expect(detectMimeType(gifBuffer)).toBe("image/gif");
    });

    it("should detect GIF89a from magic bytes", () => {
      const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00]);
      expect(detectMimeType(gifBuffer)).toBe("image/gif");
    });

    it("should detect BMP from magic bytes", () => {
      const bmpBuffer = Buffer.from([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(detectMimeType(bmpBuffer)).toBe("image/bmp");
    });

    it("should detect WebP from magic bytes", () => {
      // RIFF....WEBP
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
        0x57, 0x45, 0x42, 0x50, // WEBP
      ]);
      expect(detectMimeType(webpBuffer)).toBe("image/webp");
    });

    it("should detect ZIP archive (Office formats)", () => {
      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
      expect(detectMimeType(zipBuffer)).toBe("application/zip");
    });

    it("should detect text content", () => {
      const textBuffer = Buffer.from("Hello, this is a plain text file.\nWith multiple lines.\n");
      expect(detectMimeType(textBuffer)).toBe("text/plain");
    });

    it("should detect SVG from content", () => {
      const svgBuffer = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
      expect(detectMimeType(svgBuffer)).toBe("image/svg+xml");
    });

    it("should return null for too small buffer", () => {
      const tinyBuffer = Buffer.from([0x00, 0x01]);
      expect(detectMimeType(tinyBuffer)).toBe(null);
    });

    it("should return null for unrecognized format", () => {
      const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(detectMimeType(unknownBuffer)).toBe(null);
    });
  });

  describe("validateMimeType", () => {
    it("should validate matching PNG", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const result = validateMimeType(pngBuffer, "image/png", "test.png");
      expect(result.valid).toBe(true);
      expect(result.detectedType).toBe("image/png");
    });

    it("should validate matching JPEG", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const result = validateMimeType(jpegBuffer, "image/jpeg", "photo.jpg");
      expect(result.valid).toBe(true);
    });

    it("should validate matching PDF", () => {
      const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const result = validateMimeType(pdfBuffer, "application/pdf", "document.pdf");
      expect(result.valid).toBe(true);
    });

    it("should validate DOCX (ZIP-based)", () => {
      const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
      const result = validateMimeType(
        zipBuffer,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "document.docx"
      );
      expect(result.valid).toBe(true);
    });

    it("should validate CSV as text", () => {
      const csvBuffer = Buffer.from("name,email,phone\nJohn,john@example.com,123\n");
      const result = validateMimeType(csvBuffer, "text/csv", "data.csv");
      expect(result.valid).toBe(true);
    });

    it("should reject disallowed MIME type", () => {
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ header
      const result = validateMimeType(exeBuffer, "application/x-executable", "malware.exe");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("should reject mismatched extension and MIME type", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const result = validateMimeType(pngBuffer, "image/jpeg", "image.png");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match");
    });

    it("should reject content that doesn't match claimed type", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const result = validateMimeType(jpegBuffer, "image/png", "fake.png");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match");
    });

    it("should handle MIME type with charset parameter", () => {
      const textBuffer = Buffer.from("Hello World");
      const result = validateMimeType(textBuffer, "text/plain; charset=utf-8", "readme.txt");
      expect(result.valid).toBe(true);
    });

    it("should validate SVG content", () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>');
      const result = validateMimeType(svgBuffer, "image/svg+xml", "icon.svg");
      expect(result.valid).toBe(true);
    });
  });
});
