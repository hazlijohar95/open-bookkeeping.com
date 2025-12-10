import { ZodError } from "zod";
import { atom } from "jotai";

// Invoice Form Error Issues For Error Modal
export const invoiceErrorAtom = atom<ZodError["issues"]>([]);

// Invoice Form Tab For Preview and Form Tab Switching
export type InvoiceTab = "preview" | "form" | "both";
export const invoiceTabAtom = atom<InvoiceTab>("both");

// Debug labels for Jotai DevTools

invoiceTabAtom.debugLabel = "invoiceTab";
invoiceErrorAtom.debugLabel = "invoiceError";
