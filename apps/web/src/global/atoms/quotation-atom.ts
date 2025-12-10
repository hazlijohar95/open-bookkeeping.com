import { ZodError } from "zod";
import { atom } from "jotai";

// Quotation Form Error Issues For Error Modal
export const quotationErrorAtom = atom<ZodError["issues"]>([]);

// Quotation Form Tab For Preview and Form Tab Switching
export type QuotationTab = "preview" | "form" | "both";
export const quotationTabAtom = atom<QuotationTab>("both");

// Debug labels for Jotai DevTools
quotationTabAtom.debugLabel = "quotationTab";
quotationErrorAtom.debugLabel = "quotationError";
