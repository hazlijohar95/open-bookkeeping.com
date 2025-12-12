import type { ZodError } from "zod";
import { atom } from "jotai";

// Debit Note Form Error Issues For Error Modal
export const debitNoteErrorAtom = atom<ZodError["issues"]>([]);

// Debit Note Form Tab For Preview and Form Tab Switching
export type DebitNoteTab = "preview" | "form" | "both";
export const debitNoteTabAtom = atom<DebitNoteTab>("both");

// Debug labels for Jotai DevTools
debitNoteTabAtom.debugLabel = "debitNoteTab";
debitNoteErrorAtom.debugLabel = "debitNoteError";
