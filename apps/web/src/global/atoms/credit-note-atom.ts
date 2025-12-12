import type { ZodError } from "zod";
import { atom } from "jotai";

// Credit Note Form Error Issues For Error Modal
export const creditNoteErrorAtom = atom<ZodError["issues"]>([]);

// Credit Note Form Tab For Preview and Form Tab Switching
export type CreditNoteTab = "preview" | "form" | "both";
export const creditNoteTabAtom = atom<CreditNoteTab>("both");

// Debug labels for Jotai DevTools
creditNoteTabAtom.debugLabel = "creditNoteTab";
creditNoteErrorAtom.debugLabel = "creditNoteError";
