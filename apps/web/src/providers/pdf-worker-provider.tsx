import { pdfjs } from "react-pdf";
import React from "react";

// Initialize PDF.js worker for Vite
// Use CDN URL matching the pdfjs version bundled in react-pdf
// react-pdf 10.2.0 uses pdfjs 5.4.296
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

const PdfWorkerProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export { PdfWorkerProvider };
