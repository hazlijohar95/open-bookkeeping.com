/* eslint-disable jsx-a11y/alt-text */

import { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { Document, Page, Text, View, Image, Font } from "@react-pdf/renderer";
import { getSubTotalValue, getTotalValue } from "@/constants/pdf-helpers";
import { POPPINS_FONT, GEIST_MONO_FONT, GEIST_FONT } from "@/constants/pdf-fonts";
import { formatCurrencyText } from "@/constants/currency";
import { createTw } from "react-pdf-tailwind";
import { toWords } from "number-to-words";
import { format } from "date-fns";
import React from "react";

// Register fonts - Use Geist as fallback if Poppins fails
Font.register({
  family: "Poppins",
  fonts: POPPINS_FONT,
});

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
      sans: ["Poppins", "Geist"],
      serif: ["Poppins", "Geist"],
      mono: ["GeistMono"],
    },
    extend: {
      colors: {
        // Light mode - Corporate, clean
        "exec": "#ffffff",
        "exec-alt": "#f8f9fa",
        "exec-box": "#f1f3f5",
        "ink": "#212529",
        "ink-mid": "#495057",
        "ink-light": "#868e96",
        "rule": "#dee2e6",
        "rule-dark": "#ced4da",
        // Dark mode - Professional dark with proper contrast
        "exec-dark": "#0a0a0a",
        "exec-dark-alt": "#141414",
        "exec-dark-box": "#1a1a1a",
        "ink-dark": "#fafafa",
        "ink-dark-mid": "#a3a3a3",
        "ink-dark-light": "#666666",
        "rule-dark-mode": "#262626",
        "rule-dark-dark": "#333333",
      },
    },
  },
});

// Helper for monospace text
const mono = { fontFamily: "GeistMono" };

const ExecutivePdf: React.FC<{ data: ZodCreateInvoiceSchema }> = ({ data }) => {
  const isDark = data.invoiceDetails.theme.mode === "dark";
  const accent = data.invoiceDetails.theme.baseColor;
  const subtotal = getSubTotalValue(data);
  const total = getTotalValue(data);

  // Theme-aware colors
  const bg = isDark ? "bg-exec-dark" : "bg-exec";
  const bgAlt = isDark ? "bg-exec-dark-alt" : "bg-exec-alt";
  const bgBox = isDark ? "bg-exec-dark-box" : "bg-exec-box";
  const ink = isDark ? "text-ink-dark" : "text-ink";
  const inkMid = isDark ? "text-ink-dark-mid" : "text-ink-mid";
  const inkLight = isDark ? "text-ink-dark-light" : "text-ink-light";
  const rule = isDark ? "border-rule-dark-mode" : "border-rule";
  const ruleDark = isDark ? "border-rule-dark-dark" : "border-rule-dark";

  return (
    <Document
      title={`Invoice ${data.invoiceDetails.prefix}${data.invoiceDetails.serialNumber}`}
      author={data.companyDetails.name}
      producer="Open-Bookkeeping"
    >
      <Page size="A4" style={{ ...tw(`${bg}`), fontFamily: "Poppins" }}>
        {/* ═══════════════════════════════════════════════════════════════════
            TOP ACCENT BAR - Brand color stripe
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={{ ...tw("w-full h-2"), backgroundColor: accent }} />

        {/* ═══════════════════════════════════════════════════════════════════
            HEADER - Logo and Invoice title
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row justify-between items-start px-10 pt-8 pb-6")}>
          {/* Left: Logo */}
          <View style={tw("flex flex-col")}>
            {data.companyDetails.logo ? (
              <Image
                src={data.companyDetails.logo}
                style={{ ...tw("w-24 h-16 object-contain") }}
              />
            ) : (
              <Text style={tw(`text-[16px] font-semibold ${ink}`)}>{data.companyDetails.name}</Text>
            )}
          </View>

          {/* Right: Invoice Title */}
          <View style={tw("flex flex-col items-end")}>
            <Text style={{ ...tw(`text-[28px] font-semibold tracking-tight`), color: accent }}>
              INVOICE
            </Text>
            <Text style={{ ...tw(`text-[12px] font-medium ${inkMid} mt-1`), ...mono }}>
              {data.invoiceDetails.prefix}{data.invoiceDetails.serialNumber}
            </Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            BILLING PARTIES - Boxed sections
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row gap-4 px-10 mb-6")}>
          {/* From Box */}
          <View style={tw(`flex-1 p-5 rounded-lg border ${rule}`)}>
            <Text style={tw(`text-[9px] font-semibold tracking-[0.15em] uppercase ${inkLight} mb-3`)}>FROM</Text>
            <Text style={tw(`text-[12px] font-semibold ${ink} mb-1`)}>{data.companyDetails.name}</Text>
            {data.companyDetails.address && (
              <Text style={tw(`text-[10px] ${inkMid} leading-relaxed`)}>{data.companyDetails.address}</Text>
            )}
            {data.companyDetails.metadata.length > 0 && (
              <View style={tw("flex flex-col gap-0.5 mt-3")}>
                {data.companyDetails.metadata.map((m, i) => (
                  <View key={i} style={tw("flex flex-row")}>
                    <Text style={tw(`text-[9px] ${inkLight} w-20`)}>{m.label}</Text>
                    <Text style={tw(`text-[9px] ${inkMid}`)}>{m.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* To Box */}
          <View style={tw(`flex-1 p-5 rounded-lg border ${rule}`)}>
            <Text style={tw(`text-[9px] font-semibold tracking-[0.15em] uppercase ${inkLight} mb-3`)}>BILL TO</Text>
            <Text style={tw(`text-[12px] font-semibold ${ink} mb-1`)}>{data.clientDetails.name}</Text>
            {data.clientDetails.address && (
              <Text style={tw(`text-[10px] ${inkMid} leading-relaxed`)}>{data.clientDetails.address}</Text>
            )}
            {data.clientDetails.metadata.length > 0 && (
              <View style={tw("flex flex-col gap-0.5 mt-3")}>
                {data.clientDetails.metadata.map((m, i) => (
                  <View key={i} style={tw("flex flex-row")}>
                    <Text style={tw(`text-[9px] ${inkLight} w-20`)}>{m.label}</Text>
                    <Text style={tw(`text-[9px] ${inkMid}`)}>{m.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            META INFO - Structured row
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw(`flex flex-row flex-wrap gap-x-6 gap-y-2 px-10 py-4 mb-4 ${bgAlt}`)}>
          <View style={tw("flex flex-row items-center gap-2")}>
            <Text style={tw(`text-[9px] font-medium ${inkLight}`)}>Invoice Date:</Text>
            <Text style={tw(`text-[10px] font-medium ${ink}`)}>{format(data.invoiceDetails.date, "MMM dd, yyyy")}</Text>
          </View>
          {data.invoiceDetails.dueDate && (
            <View style={tw("flex flex-row items-center gap-2")}>
              <Text style={tw(`text-[9px] font-medium ${inkLight}`)}>Due Date:</Text>
              <Text style={tw(`text-[10px] font-medium ${ink}`)}>{format(data.invoiceDetails.dueDate, "MMM dd, yyyy")}</Text>
            </View>
          )}
          {data.invoiceDetails.paymentTerms && (
            <View style={tw("flex flex-row items-center gap-2")}>
              <Text style={tw(`text-[9px] font-medium ${inkLight}`)}>Payment Terms:</Text>
              <Text style={tw(`text-[10px] font-medium ${ink}`)}>{data.invoiceDetails.paymentTerms}</Text>
            </View>
          )}
          {data.invoiceDetails.poNumber && (
            <View style={tw("flex flex-row items-center gap-2")}>
              <Text style={tw(`text-[9px] font-medium ${inkLight}`)}>PO Number:</Text>
              <Text style={{ ...tw(`text-[10px] font-medium ${ink}`), ...mono }}>{data.invoiceDetails.poNumber}</Text>
            </View>
          )}
          {data.invoiceDetails.referenceNumber && (
            <View style={tw("flex flex-row items-center gap-2")}>
              <Text style={tw(`text-[9px] font-medium ${inkLight}`)}>Reference:</Text>
              <Text style={{ ...tw(`text-[10px] font-medium ${ink}`), ...mono }}>{data.invoiceDetails.referenceNumber}</Text>
            </View>
          )}
          <View style={tw("flex flex-row items-center gap-2")}>
            <Text style={tw(`text-[9px] font-medium ${inkLight}`)}>Currency:</Text>
            <Text style={{ ...tw(`text-[10px] font-medium ${ink}`), ...mono }}>{data.invoiceDetails.currency}</Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            LINE ITEMS TABLE - Full bordered table
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("px-10 mb-6 grow")}>
          {/* Header Row with accent background */}
          <View style={{ ...tw(`flex flex-row rounded-t-lg px-4 py-3`), backgroundColor: isDark ? "#1a1a1a" : accent }}>
            <Text style={tw(`flex-1 text-[9px] font-semibold tracking-wider uppercase ${isDark ? "text-ink-dark-mid" : "text-white"}`)}>
              Description
            </Text>
            <Text style={tw(`w-12 text-[9px] font-semibold tracking-wider uppercase text-center ${isDark ? "text-ink-dark-mid" : "text-white"}`)}>
              Qty
            </Text>
            <Text style={tw(`w-28 text-[9px] font-semibold tracking-wider uppercase text-right ${isDark ? "text-ink-dark-mid" : "text-white"}`)}>
              Rate
            </Text>
            <Text style={tw(`w-32 text-[9px] font-semibold tracking-wider uppercase text-right ${isDark ? "text-ink-dark-mid" : "text-white"}`)}>
              Amount
            </Text>
          </View>

          {/* Data Rows */}
          <View style={tw(`border-l border-r border-b rounded-b-lg ${rule}`)}>
            {data.items.map((item, i) => (
              <View
                key={i}
                style={tw(`flex flex-row items-center px-4 py-3 ${i !== data.items.length - 1 ? `border-b ${rule}` : ""} ${i % 2 === 1 ? bgBox : ""}`)}>
                <View style={tw("flex-1 pr-3")}>
                  <Text style={tw(`text-[11px] font-medium ${ink}`)}>{item.name}</Text>
                  {item.description && (
                    <Text style={tw(`text-[9px] mt-0.5 ${inkMid}`)}>{item.description}</Text>
                  )}
                </View>
                <Text style={{ ...tw(`w-12 text-[11px] text-center ${ink}`), ...mono }}>{item.quantity}</Text>
                <Text style={{ ...tw(`w-28 text-[11px] text-right ${inkMid}`), ...mono }}>
                  {formatCurrencyText(data.invoiceDetails.currency, item.unitPrice)}
                </Text>
                <Text style={{ ...tw(`w-32 text-[11px] font-medium text-right ${ink}`), ...mono }}>
                  {formatCurrencyText(data.invoiceDetails.currency, item.quantity * item.unitPrice)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            FOOTER - Totals box and payment info
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row gap-6 px-10 pb-10")}>
          {/* Left: Payment Info */}
          <View style={tw("flex-1 flex flex-col gap-5")}>
            {data.metadata.paymentInformation.length > 0 && (
              <View>
                <Text style={tw(`text-[9px] font-semibold tracking-[0.1em] uppercase ${inkLight} mb-2`)}>
                  PAYMENT INFORMATION
                </Text>
                <View style={tw(`p-4 rounded-lg border ${rule}`)}>
                  {data.metadata.paymentInformation.map((info, i) => (
                    <View key={i} style={tw(`flex flex-row ${i !== 0 ? "mt-1.5" : ""}`)}>
                      <Text style={tw(`text-[9px] ${inkLight} w-24`)}>{info.label}</Text>
                      <Text style={{ ...tw(`text-[9px] ${inkMid}`), ...mono }}>{info.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {data.metadata.terms && (
              <View>
                <Text style={tw(`text-[9px] font-semibold tracking-[0.1em] uppercase ${inkLight} mb-2`)}>
                  TERMS & CONDITIONS
                </Text>
                <Text style={tw(`text-[9px] ${inkMid} leading-relaxed`)}>{data.metadata.terms}</Text>
              </View>
            )}

            {data.metadata.notes && (
              <View>
                <Text style={tw(`text-[9px] font-semibold tracking-[0.1em] uppercase ${inkLight} mb-2`)}>
                  NOTES
                </Text>
                <Text style={tw(`text-[9px] ${inkMid} leading-relaxed`)}>{data.metadata.notes}</Text>
              </View>
            )}
          </View>

          {/* Right: Totals Box */}
          <View style={tw("w-64")}>
            {/* Signature */}
            {data.companyDetails.signature && (
              <View style={tw("flex flex-col items-end mb-4")}>
                <Image
                  src={data.companyDetails.signature}
                  style={{ ...tw("w-16 h-16 object-contain") }}
                />
                <Text style={tw(`text-[8px] ${inkLight} mt-1`)}>Authorized Signature</Text>
              </View>
            )}

            {/* Summary Box */}
            <View style={tw(`p-4 rounded-lg border ${ruleDark}`)}>
              <View style={tw("flex flex-row justify-between items-center")}>
                <Text style={tw(`text-[10px] ${inkMid}`)}>Subtotal</Text>
                <Text style={{ ...tw(`text-[10px] ${ink}`), ...mono }}>
                  {formatCurrencyText(data.invoiceDetails.currency, subtotal)}
                </Text>
              </View>

              {data.invoiceDetails.billingDetails.map((detail, i) => (
                <View key={i} style={tw("flex flex-row justify-between items-center mt-2")}>
                  <Text style={tw(`text-[10px] ${inkMid}`)}>{detail.label}</Text>
                  <Text style={{ ...tw(`text-[10px] ${ink}`), ...mono }}>
                    {detail.type === "percentage" ? `${detail.value}%` : formatCurrencyText(data.invoiceDetails.currency, detail.value)}
                  </Text>
                </View>
              ))}

              {/* Total with accent background */}
              <View style={{ ...tw(`mt-4 -mx-4 -mb-4 px-4 py-4 rounded-b-lg`), backgroundColor: isDark ? "#1a1a1a" : accent }}>
                <View style={tw("flex flex-row justify-between items-center")}>
                  <Text style={tw(`text-[11px] font-semibold ${isDark ? "text-ink-dark-mid" : "text-white"} tracking-wider uppercase`)}>
                    Total
                  </Text>
                  <Text style={{ ...tw(`text-[20px] font-semibold ${isDark ? "text-ink-dark" : "text-white"}`), ...mono }}>
                    {formatCurrencyText(data.invoiceDetails.currency, total)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Amount in Words */}
            <View style={tw("mt-3")}>
              <Text style={tw(`text-[8px] ${inkLight}`)}>Amount in words</Text>
              <Text style={tw(`text-[9px] ${inkMid} capitalize mt-0.5`)}>
                {toWords(Math.round(total))} only
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default ExecutivePdf;
