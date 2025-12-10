/* eslint-disable jsx-a11y/alt-text */

import { GEIST_MONO_FONT, GEIST_FONT } from "@/constants/pdf-fonts";
import { Document, Page, Text, View, Font } from "@react-pdf/renderer";
import { formatCurrencyText } from "@/constants/currency";
import { createTw } from "react-pdf-tailwind";
import { format } from "date-fns";
import React from "react";

// Register fonts
Font.register({
  family: "Geist",
  fonts: GEIST_FONT,
});

Font.register({
  family: "GeistMono",
  fonts: GEIST_MONO_FONT,
});

const tw = createTw({
  theme: {
    fontFamily: {
      sans: ["Geist"],
      serif: ["Geist"],
      mono: ["GeistMono"],
    },
    extend: {
      colors: {
        ink: "#0a0a0a",
        "ink-muted": "#525252",
        "ink-faint": "#a3a3a3",
        surface: "#ffffff",
        "surface-alt": "#fafafa",
        border: "#e5e5e5",
      },
    },
  },
});

// Helper for monospace text
const mono = { fontFamily: "GeistMono" };

// Types
export interface StatementEntry {
  id: string;
  date: string;
  type: "invoice" | "payment" | "credit_note" | "debit_note" | "bill";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface StatementSummary {
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
}

export interface StatementPDFData {
  entityType: "customer" | "vendor";
  entity: {
    id: string;
    name: string;
    email?: string | null;
    address?: string | null;
  };
  company?: {
    name: string;
    address?: string;
  };
  period: {
    startDate?: string | null;
    endDate?: string | null;
  };
  entries: StatementEntry[];
  summary: StatementSummary;
  currency: string;
  generatedAt: string;
}

const StatementDefaultPDF: React.FC<{ data: StatementPDFData }> = ({ data }) => {
  const accent = "#2563EB"; // Default blue accent

  const getTypeLabel = (type: StatementEntry["type"]) => {
    switch (type) {
      case "invoice":
        return "Invoice";
      case "payment":
        return "Payment";
      case "credit_note":
        return "Credit Note";
      case "debit_note":
        return "Debit Note";
      case "bill":
        return "Bill";
      default:
        return type;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  const periodLabel = () => {
    if (data.period.startDate && data.period.endDate) {
      return `${formatDate(data.period.startDate)} - ${formatDate(data.period.endDate)}`;
    }
    if (data.period.startDate) {
      return `From ${formatDate(data.period.startDate)}`;
    }
    if (data.period.endDate) {
      return `Until ${formatDate(data.period.endDate)}`;
    }
    return "All Time";
  };

  return (
    <Document
      title={`Statement of Account - ${data.entity.name}`}
      author={data.company?.name || "Open-Bookkeeping"}
      producer="Open-Bookkeeping"
    >
      <Page size="A4" style={{ ...tw("p-10 bg-surface text-ink"), fontFamily: "Geist" }}>
        {/* HEADER */}
        <View style={tw("flex flex-row justify-between items-start mb-8")}>
          <View style={tw("flex flex-col")}>
            <Text style={tw("text-[10px] font-medium tracking-[0.2em] uppercase text-ink-faint mb-2")}>
              Statement of Account
            </Text>
            <Text style={tw(`text-[24px] font-semibold tracking-tight leading-none text-[${accent}]`)}>
              {data.entity.name}
            </Text>
          </View>
          <View style={tw("flex flex-col items-end")}>
            <Text style={tw("text-[9px] text-ink-faint mb-1")}>Generated</Text>
            <Text style={tw("text-[11px] font-medium")}>
              {formatDate(data.generatedAt)}
            </Text>
          </View>
        </View>

        {/* META INFO BAR */}
        <View style={tw("flex flex-row gap-8 pb-5 mb-6 border-b border-border")}>
          <View style={tw("flex flex-col gap-1")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint")}>
              {data.entityType === "customer" ? "Customer" : "Vendor"}
            </Text>
            <Text style={tw("text-[11px] font-medium")}>{data.entity.name}</Text>
            {data.entity.email && (
              <Text style={tw("text-[9px] text-ink-muted")}>{data.entity.email}</Text>
            )}
          </View>
          <View style={tw("flex flex-col gap-1")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint")}>Period</Text>
            <Text style={tw("text-[11px] font-medium")}>{periodLabel()}</Text>
          </View>
          <View style={tw("flex flex-col gap-1")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint")}>Currency</Text>
            <Text style={{ ...tw("text-[11px] font-medium"), ...mono }}>{data.currency}</Text>
          </View>
        </View>

        {/* ADDRESS */}
        {data.entity.address && (
          <View style={tw("mb-6")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint mb-1")}>Address</Text>
            <Text style={tw("text-[10px] text-ink-muted leading-relaxed")}>{data.entity.address}</Text>
          </View>
        )}

        {/* TRANSACTIONS TABLE */}
        <View style={tw("mb-6 grow")}>
          {/* Header */}
          <View style={tw(`flex flex-row px-3 py-2.5 rounded-t-lg bg-[${accent}]`)}>
            <Text style={tw("w-20 text-[8px] font-semibold tracking-wider uppercase text-white")}>
              Date
            </Text>
            <Text style={tw("w-20 text-[8px] font-semibold tracking-wider uppercase text-white")}>
              Type
            </Text>
            <Text style={tw("flex-1 text-[8px] font-semibold tracking-wider uppercase text-white")}>
              Reference
            </Text>
            <Text style={tw("w-24 text-[8px] font-semibold tracking-wider uppercase text-right text-white")}>
              Debit
            </Text>
            <Text style={tw("w-24 text-[8px] font-semibold tracking-wider uppercase text-right text-white")}>
              Credit
            </Text>
            <Text style={tw("w-24 text-[8px] font-semibold tracking-wider uppercase text-right text-white")}>
              Balance
            </Text>
          </View>

          {/* Rows */}
          <View style={tw("border-l border-r border-b rounded-b-lg border-border")}>
            {data.entries.length === 0 ? (
              <View style={tw("px-3 py-8 flex items-center justify-center")}>
                <Text style={tw("text-[10px] text-ink-muted")}>No transactions found for this period</Text>
              </View>
            ) : (
              data.entries.map((entry, i) => (
                <View
                  key={entry.id}
                  style={tw(
                    `flex flex-row items-center px-3 py-2 ${i !== data.entries.length - 1 ? "border-b border-border" : ""} ${i % 2 === 1 ? "bg-surface-alt" : ""}`
                  )}
                >
                  <Text style={{ ...tw("w-20 text-[9px] text-ink-muted"), ...mono }}>
                    {formatDate(entry.date)}
                  </Text>
                  <Text style={tw("w-20 text-[9px] text-ink-muted")}>
                    {getTypeLabel(entry.type)}
                  </Text>
                  <View style={tw("flex-1 pr-2")}>
                    <Text style={{ ...tw("text-[9px] font-medium text-ink"), ...mono }}>
                      {entry.reference}
                    </Text>
                    <Text style={tw("text-[8px] text-ink-faint")}>
                      {entry.description}
                    </Text>
                  </View>
                  <Text style={{ ...tw("w-24 text-[9px] text-right text-ink"), ...mono }}>
                    {entry.debit > 0 ? formatCurrencyText(data.currency, entry.debit) : "-"}
                  </Text>
                  <Text style={{ ...tw("w-24 text-[9px] text-right text-ink"), ...mono }}>
                    {entry.credit > 0 ? formatCurrencyText(data.currency, entry.credit) : "-"}
                  </Text>
                  <Text style={{ ...tw("w-24 text-[9px] font-medium text-right text-ink"), ...mono }}>
                    {formatCurrencyText(data.currency, entry.balance)}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* SUMMARY */}
        <View style={tw("flex flex-row justify-end")}>
          <View style={tw("w-72 p-4 rounded-lg bg-surface-alt")}>
            <Text style={tw(`text-[9px] font-semibold tracking-[0.15em] uppercase text-[${accent}] mb-3`)}>
              Account Summary
            </Text>

            <View style={tw("flex flex-row justify-between items-center mb-2")}>
              <Text style={tw("text-[10px] text-ink-muted")}>Opening Balance</Text>
              <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                {formatCurrencyText(data.currency, data.summary.openingBalance)}
              </Text>
            </View>

            <View style={tw("flex flex-row justify-between items-center mb-2")}>
              <Text style={tw("text-[10px] text-ink-muted")}>Total Debits</Text>
              <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                {formatCurrencyText(data.currency, data.summary.totalDebits)}
              </Text>
            </View>

            <View style={tw("flex flex-row justify-between items-center mb-2")}>
              <Text style={tw("text-[10px] text-ink-muted")}>Total Credits</Text>
              <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                ({formatCurrencyText(data.currency, data.summary.totalCredits)})
              </Text>
            </View>

            <View style={tw("border-t border-border mt-3 pt-3")}>
              <View style={tw("flex flex-row justify-between items-center")}>
                <Text style={tw("text-[11px] font-semibold text-ink")}>
                  {data.entityType === "customer" ? "Amount Due" : "Amount Owed"}
                </Text>
                <Text style={{ ...tw(`text-[16px] font-semibold tracking-tight text-[${accent}]`), ...mono }}>
                  {formatCurrencyText(data.currency, data.summary.closingBalance)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* FOOTER */}
        <View style={tw("mt-auto pt-6 border-t border-border")}>
          <Text style={tw("text-[8px] text-ink-faint text-center")}>
            This is a computer-generated statement. Generated on {formatDate(data.generatedAt)}.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default StatementDefaultPDF;
