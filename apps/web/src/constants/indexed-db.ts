export const IDB_NAME = "open-bookkeeping";
export const IDB_VERSION = 4; // v4: Added userId index for user isolation (security fix)

// Schema Names
export const IDB_SCHEMA_INVOICES = "inv_invoices";
export const IDB_SCHEMA_QUOTATIONS = "inv_quotations";
export const IDB_SCHEMA_CREDIT_NOTES = "inv_credit_notes";
export const IDB_SCHEMA_DEBIT_NOTES = "inv_debit_notes";
export const IDB_IMAGES = "inv_images";

// Agent Chat (T3-style local-first)
export const IDB_AGENT_THREADS = "agent_threads";
export const IDB_AGENT_MESSAGES = "agent_messages";
