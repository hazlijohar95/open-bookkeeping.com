import type { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { Document, Page, Text, View, Image, Font } from "@react-pdf/renderer";
import { getSubTotalValue, getTotalValue } from "@/constants/pdf-helpers";
import { INTER_FONT, GEIST_MONO_FONT } from "@/constants/pdf-fonts";
import { formatCurrencyText } from "@/constants/currency";
import { createTw } from "react-pdf-tailwind";
import { toWords } from "number-to-words";
import { format } from "date-fns";
import React from "react";

// Register fonts
Font.register({
  family: "Inter",
  fonts: INTER_FONT,
});

Font.register({
  family: "GeistMono",
  fonts: GEIST_MONO_FONT,
});

const tw = createTw({
  theme: {
    // Override default font families to only use registered fonts
    fontFamily: {
      sans: ["Inter"],
      serif: ["Inter"],
      mono: ["GeistMono"],
    },
    extend: {
      colors: {
        // Light mode - Warm paper tones
        "paper": "#fefdfb",
        "paper-alt": "#f8f6f3",
        "ink": "#1a1a1a",
        "ink-light": "#4a4a4a",
        "ink-muted": "#787878",
        "rule": "#e8e5e0",
        "rule-dark": "#d4d0c8",
        // Dark mode - Black bg with proper contrast white text
        "dark-paper": "#0a0a0a",
        "dark-paper-alt": "#141414",
        "dark-ink": "#fafafa",
        "dark-ink-light": "#a3a3a3",
        "dark-ink-muted": "#666666",
        "dark-rule": "#262626",
        "dark-rule-dark": "#333333",
      },
    },
  },
});

// Helper for monospace text
const mono = { fontFamily: "GeistMono" };

const ClassicPdf: React.FC<{ data: ZodCreateInvoiceSchema }> = ({ data }) => {
  const isDark = data.invoiceDetails.theme.mode === "dark";
  const subtotal = getSubTotalValue(data);
  const total = getTotalValue(data);

  // Theme-aware colors
  const paper = isDark ? "bg-dark-paper" : "bg-paper";
  const ink = isDark ? "text-dark-ink" : "text-ink";
  const inkLight = isDark ? "text-dark-ink-light" : "text-ink-light";
  const inkMuted = isDark ? "text-dark-ink-muted" : "text-ink-muted";
  const rule = isDark ? "border-dark-rule" : "border-rule";
  const ruleDark = isDark ? "border-dark-rule-dark" : "border-rule-dark";
  const bgInk = isDark ? "bg-dark-ink" : "bg-ink";

  return (
    <Document
      title={`Invoice ${data.invoiceDetails.prefix}${data.invoiceDetails.serialNumber}`}
      author={data.companyDetails.name}
      producer="Open-Bookkeeping"
    >
      <Page size="A4" style={{ ...tw(`p-16 ${paper} ${ink}`), fontFamily: "Inter" }}>
        {/* ═══════════════════════════════════════════════════════════════════
            HEADER
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row justify-between items-start mb-12")}>
          <View style={tw("flex flex-col")}>
            <Text style={tw(`text-[42px] font-light tracking-tight leading-none ${ink}`)}>
              Invoice
            </Text>
            <Text style={{ ...tw(`text-[14px] ${inkMuted} mt-2`), ...mono }}>
              #{data.invoiceDetails.prefix}{data.invoiceDetails.serialNumber}
            </Text>
          </View>

          {data.companyDetails.logo && (
            <Image
              src={data.companyDetails.logo}
              style={{ ...tw("w-20 h-14 object-contain") }}
            />
          )}
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            META
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw(`flex flex-row flex-wrap gap-x-12 gap-y-3 mb-10 pb-8 border-b-2 ${rule}`)}>
          <View style={tw("flex flex-col")}>
            <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-1`)}>Date</Text>
            <Text style={tw(`text-[11px] ${ink}`)}>{format(data.invoiceDetails.date, "MMMM d, yyyy")}</Text>
          </View>
          {data.invoiceDetails.dueDate && (
            <View style={tw("flex flex-col")}>
              <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-1`)}>Due Date</Text>
              <Text style={tw(`text-[11px] ${ink}`)}>{format(data.invoiceDetails.dueDate, "MMMM d, yyyy")}</Text>
            </View>
          )}
          {data.invoiceDetails.paymentTerms && (
            <View style={tw("flex flex-col")}>
              <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-1`)}>Payment Terms</Text>
              <Text style={tw(`text-[11px] ${ink}`)}>{data.invoiceDetails.paymentTerms}</Text>
            </View>
          )}
          {data.invoiceDetails.poNumber && (
            <View style={tw("flex flex-col")}>
              <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-1`)}>PO Number</Text>
              <Text style={{ ...tw(`text-[11px] ${ink}`), ...mono }}>{data.invoiceDetails.poNumber}</Text>
            </View>
          )}
          {data.invoiceDetails.referenceNumber && (
            <View style={tw("flex flex-col")}>
              <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-1`)}>Reference</Text>
              <Text style={{ ...tw(`text-[11px] ${ink}`), ...mono }}>{data.invoiceDetails.referenceNumber}</Text>
            </View>
          )}
          <View style={tw("flex flex-col")}>
            <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-1`)}>Currency</Text>
            <Text style={{ ...tw(`text-[11px] ${ink}`), ...mono }}>{data.invoiceDetails.currency}</Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            PARTIES
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row gap-16 mb-10")}>
          {/* From */}
          <View style={tw("flex-1")}>
            <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-3`)}>From</Text>
            <Text style={tw(`text-[13px] font-medium ${ink} mb-1`)}>{data.companyDetails.name}</Text>
            {data.companyDetails.address && (
              <Text style={tw(`text-[10px] ${inkLight} leading-relaxed`)}>{data.companyDetails.address}</Text>
            )}
            {data.companyDetails.metadata.length > 0 && (
              <View style={tw("flex flex-col gap-0.5 mt-3")}>
                {data.companyDetails.metadata.map((m, i) => (
                  <Text key={i} style={tw(`text-[9px] ${inkMuted}`)}>
                    {m.label}: <Text style={tw(inkLight)}>{m.value}</Text>
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* To */}
          <View style={tw("flex-1")}>
            <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-3`)}>To</Text>
            <Text style={tw(`text-[13px] font-medium ${ink} mb-1`)}>{data.clientDetails.name}</Text>
            {data.clientDetails.address && (
              <Text style={tw(`text-[10px] ${inkLight} leading-relaxed`)}>{data.clientDetails.address}</Text>
            )}
            {data.clientDetails.metadata.length > 0 && (
              <View style={tw("flex flex-col gap-0.5 mt-3")}>
                {data.clientDetails.metadata.map((m, i) => (
                  <Text key={i} style={tw(`text-[9px] ${inkMuted}`)}>
                    {m.label}: <Text style={tw(inkLight)}>{m.value}</Text>
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            ITEMS
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("mb-10 grow")}>
          {/* Header */}
          <View style={tw(`flex flex-row pb-2 border-b-2 ${ruleDark} mb-1`)}>
            <Text style={tw(`flex-1 text-[9px] font-medium ${ink} uppercase tracking-wider`)}>Description</Text>
            <Text style={tw(`w-12 text-[9px] font-medium ${ink} uppercase tracking-wider text-center`)}>Qty</Text>
            <Text style={tw(`w-28 text-[9px] font-medium ${ink} uppercase tracking-wider text-right`)}>Rate</Text>
            <Text style={tw(`w-32 text-[9px] font-medium ${ink} uppercase tracking-wider text-right`)}>Amount</Text>
          </View>

          {/* Rows */}
          {data.items.map((item, i) => (
            <View key={i} style={tw(`flex flex-row items-center py-3 border-b ${rule}`)}>
              <View style={tw("flex-1 pr-4")}>
                <Text style={tw(`text-[11px] ${ink}`)}>{item.name}</Text>
                {item.description && (
                  <Text style={tw(`text-[9px] ${inkMuted} mt-0.5 italic`)}>{item.description}</Text>
                )}
              </View>
              <Text style={{ ...tw(`w-12 text-[11px] ${ink} text-center`), ...mono }}>{item.quantity}</Text>
              <Text style={{ ...tw(`w-28 text-[11px] ${inkLight} text-right`), ...mono }}>
                {formatCurrencyText(data.invoiceDetails.currency, item.unitPrice)}
              </Text>
              <Text style={{ ...tw(`w-32 text-[11px] ${ink} text-right`), ...mono }}>
                {formatCurrencyText(data.invoiceDetails.currency, item.quantity * item.unitPrice)}
              </Text>
            </View>
          ))}
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            FOOTER
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row gap-16")}>
          {/* Left: Notes */}
          <View style={tw("flex-1 flex flex-col gap-6")}>
            {data.metadata.paymentInformation.length > 0 && (
              <View>
                <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-2`)}>Payment Information</Text>
                {data.metadata.paymentInformation.map((info, i) => (
                  <Text key={i} style={tw(`text-[9px] ${inkLight} ${i !== 0 ? "mt-1" : ""}`)}>
                    {info.label}: <Text style={mono}>{info.value}</Text>
                  </Text>
                ))}
              </View>
            )}

            {data.metadata.terms && (
              <View>
                <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-2`)}>Terms & Conditions</Text>
                <Text style={tw(`text-[9px] ${inkLight} leading-relaxed`)}>{data.metadata.terms}</Text>
              </View>
            )}

            {data.metadata.notes && (
              <View>
                <Text style={tw(`text-[9px] ${inkMuted} uppercase tracking-wider mb-2`)}>Notes</Text>
                <Text style={tw(`text-[9px] ${inkLight} leading-relaxed italic`)}>{data.metadata.notes}</Text>
              </View>
            )}
          </View>

          {/* Right: Totals */}
          <View style={tw("w-64")}>
            {/* Signature */}
            {data.companyDetails.signature && (
              <View style={tw(`flex flex-col items-end mb-4 pb-4 border-b ${rule}`)}>
                <Image
                  src={data.companyDetails.signature}
                  style={{ ...tw("w-16 h-16 object-contain") }}
                />
                <View style={tw(`w-full h-px ${bgInk} mt-1`)} />
                <Text style={tw(`text-[8px] ${inkMuted} mt-1`)}>Authorized Signature</Text>
              </View>
            )}

            {/* Summary */}
            <View style={tw("flex flex-row justify-between items-center py-1")}>
              <Text style={tw(`text-[10px] ${inkMuted}`)}>Subtotal</Text>
              <Text style={{ ...tw(`text-[10px] ${ink}`), ...mono }}>
                {formatCurrencyText(data.invoiceDetails.currency, subtotal)}
              </Text>
            </View>

            {data.invoiceDetails.billingDetails.map((detail, i) => (
              <View key={i} style={tw("flex flex-row justify-between items-center py-1")}>
                <Text style={tw(`text-[10px] ${inkMuted}`)}>{detail.label}</Text>
                <Text style={{ ...tw(`text-[10px] ${ink}`), ...mono }}>
                  {detail.type === "percentage" ? `${detail.value}%` : formatCurrencyText(data.invoiceDetails.currency, detail.value)}
                </Text>
              </View>
            ))}

            <View style={tw(`border-t-2 ${ruleDark} mt-2 pt-3`)}>
              <View style={tw("flex flex-row justify-between items-center")}>
                <Text style={tw(`text-[12px] font-medium ${ink}`)}>Total Due</Text>
                <Text style={{ ...tw(`text-[20px] font-medium ${ink}`), ...mono }}>
                  {formatCurrencyText(data.invoiceDetails.currency, total)}
                </Text>
              </View>
            </View>

            <View style={tw(`border-t ${rule} mt-3 pt-2`)}>
              <Text style={tw(`text-[8px] ${inkMuted} uppercase tracking-wider`)}>Amount in Words</Text>
              <Text style={tw(`text-[9px] ${inkLight} capitalize mt-0.5`)}>
                {toWords(Math.round(total))} only
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default ClassicPdf;
