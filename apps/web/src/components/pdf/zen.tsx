/* eslint-disable jsx-a11y/alt-text */

import { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { Document, Page, Text, View, Image, Font } from "@react-pdf/renderer";
import { getSubTotalValue, getTotalValue } from "@/constants/pdf-helpers";
import { DM_SANS_FONT, GEIST_MONO_FONT, GEIST_FONT } from "@/constants/pdf-fonts";
import { formatCurrencyText } from "@/constants/currency";
import { createTw } from "react-pdf-tailwind";
import { toWords } from "number-to-words";
import { format } from "date-fns";
import React from "react";

// Register fonts - Use Geist as fallback if DM Sans fails
Font.register({
  family: "DMSans",
  fonts: DM_SANS_FONT,
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
      sans: ["DMSans", "Geist"],
      serif: ["DMSans", "Geist"],
      mono: ["GeistMono"],
    },
    extend: {
      colors: {
        // Light mode - Pure, clean whites
        "zen": "#ffffff",
        "zen-subtle": "#fafafa",
        "ink": "#1a1a1a",
        "ink-soft": "#6b6b6b",
        "ink-whisper": "#a8a8a8",
        "line": "#e8e8e8",
        // Dark mode - Deep black with proper contrast
        "zen-dark": "#0a0a0a",
        "zen-dark-subtle": "#141414",
        "ink-dark": "#fafafa",
        "ink-dark-soft": "#a3a3a3",
        "ink-dark-whisper": "#666666",
        "line-dark": "#262626",
      },
    },
  },
});

// Helper for monospace text
const mono = { fontFamily: "GeistMono" };

const ZenPdf: React.FC<{ data: ZodCreateInvoiceSchema }> = ({ data }) => {
  const isDark = data.invoiceDetails.theme.mode === "dark";
  const subtotal = getSubTotalValue(data);
  const total = getTotalValue(data);

  // Theme-aware colors
  const bg = isDark ? "bg-zen-dark" : "bg-zen";
  const ink = isDark ? "text-ink-dark" : "text-ink";
  const inkSoft = isDark ? "text-ink-dark-soft" : "text-ink-soft";
  const inkWhisper = isDark ? "text-ink-dark-whisper" : "text-ink-whisper";
  const line = isDark ? "border-line-dark" : "border-line";

  return (
    <Document
      title={`Invoice ${data.invoiceDetails.prefix}${data.invoiceDetails.serialNumber}`}
      author={data.companyDetails.name}
      producer="Open-Bookkeeping"
    >
      <Page size="A4" style={{ ...tw(`p-16 ${bg} ${ink}`), fontFamily: "DMSans" }}>
        {/* ═══════════════════════════════════════════════════════════════════
            HEADER - Extreme minimalism, lots of breathing room
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row justify-between items-start mb-16")}>
          <View style={tw("flex flex-col")}>
            <Text style={tw(`text-[11px] font-light tracking-[0.4em] uppercase ${inkWhisper}`)}>
              Invoice
            </Text>
            <Text style={{ ...tw(`text-[28px] font-light tracking-tight mt-2 ${ink}`), ...mono }}>
              {data.invoiceDetails.prefix}{data.invoiceDetails.serialNumber}
            </Text>
          </View>

          {data.companyDetails.logo && (
            <Image
              src={data.companyDetails.logo}
              style={{ ...tw("w-16 h-12 object-contain opacity-80") }}
            />
          )}
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            SINGLE DELICATE LINE SEPARATOR
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw(`border-t ${line} mb-12`)} />

        {/* ═══════════════════════════════════════════════════════════════════
            PARTIES - Asymmetric, generous whitespace
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row gap-24 mb-14")}>
          {/* From */}
          <View style={tw("flex-1")}>
            <Text style={tw(`text-[9px] font-light tracking-[0.3em] uppercase ${inkWhisper} mb-4`)}>From</Text>
            <Text style={tw(`text-[12px] font-medium ${ink} mb-2`)}>{data.companyDetails.name}</Text>
            {data.companyDetails.address && (
              <Text style={tw(`text-[10px] font-light leading-relaxed ${inkSoft}`)}>{data.companyDetails.address}</Text>
            )}
            {data.companyDetails.metadata.length > 0 && (
              <View style={tw("flex flex-col gap-1 mt-4")}>
                {data.companyDetails.metadata.map((m, i) => (
                  <Text key={i} style={tw(`text-[9px] font-light ${inkSoft}`)}>
                    {m.label} · {m.value}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* To */}
          <View style={tw("flex-1")}>
            <Text style={tw(`text-[9px] font-light tracking-[0.3em] uppercase ${inkWhisper} mb-4`)}>To</Text>
            <Text style={tw(`text-[12px] font-medium ${ink} mb-2`)}>{data.clientDetails.name}</Text>
            {data.clientDetails.address && (
              <Text style={tw(`text-[10px] font-light leading-relaxed ${inkSoft}`)}>{data.clientDetails.address}</Text>
            )}
            {data.clientDetails.metadata.length > 0 && (
              <View style={tw("flex flex-col gap-1 mt-4")}>
                {data.clientDetails.metadata.map((m, i) => (
                  <Text key={i} style={tw(`text-[9px] font-light ${inkSoft}`)}>
                    {m.label} · {m.value}
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            META - Horizontal, understated
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row flex-wrap gap-x-10 gap-y-2 mb-12")}>
          <View style={tw("flex flex-row items-baseline gap-2")}>
            <Text style={tw(`text-[8px] font-light tracking-wider uppercase ${inkWhisper}`)}>Date</Text>
            <Text style={tw(`text-[10px] font-light ${inkSoft}`)}>{format(data.invoiceDetails.date, "dd MMM yyyy")}</Text>
          </View>
          {data.invoiceDetails.dueDate && (
            <View style={tw("flex flex-row items-baseline gap-2")}>
              <Text style={tw(`text-[8px] font-light tracking-wider uppercase ${inkWhisper}`)}>Due</Text>
              <Text style={tw(`text-[10px] font-light ${inkSoft}`)}>{format(data.invoiceDetails.dueDate, "dd MMM yyyy")}</Text>
            </View>
          )}
          {data.invoiceDetails.paymentTerms && (
            <View style={tw("flex flex-row items-baseline gap-2")}>
              <Text style={tw(`text-[8px] font-light tracking-wider uppercase ${inkWhisper}`)}>Terms</Text>
              <Text style={tw(`text-[10px] font-light ${inkSoft}`)}>{data.invoiceDetails.paymentTerms}</Text>
            </View>
          )}
          {data.invoiceDetails.poNumber && (
            <View style={tw("flex flex-row items-baseline gap-2")}>
              <Text style={tw(`text-[8px] font-light tracking-wider uppercase ${inkWhisper}`)}>PO</Text>
              <Text style={{ ...tw(`text-[10px] font-light ${inkSoft}`), ...mono }}>{data.invoiceDetails.poNumber}</Text>
            </View>
          )}
          {data.invoiceDetails.referenceNumber && (
            <View style={tw("flex flex-row items-baseline gap-2")}>
              <Text style={tw(`text-[8px] font-light tracking-wider uppercase ${inkWhisper}`)}>Ref</Text>
              <Text style={{ ...tw(`text-[10px] font-light ${inkSoft}`), ...mono }}>{data.invoiceDetails.referenceNumber}</Text>
            </View>
          )}
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            LINE ITEMS - Clean, spacious rows
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("mb-10 grow")}>
          {/* Header - subtle */}
          <View style={tw(`flex flex-row pb-3 border-b ${line}`)}>
            <Text style={tw(`flex-1 text-[8px] font-light tracking-[0.2em] uppercase ${inkWhisper}`)}>Description</Text>
            <Text style={tw(`w-12 text-[8px] font-light tracking-[0.2em] uppercase text-center ${inkWhisper}`)}>Qty</Text>
            <Text style={tw(`w-28 text-[8px] font-light tracking-[0.2em] uppercase text-right ${inkWhisper}`)}>Rate</Text>
            <Text style={tw(`w-32 text-[8px] font-light tracking-[0.2em] uppercase text-right ${inkWhisper}`)}>Amount</Text>
          </View>

          {/* Rows - no backgrounds, just generous spacing */}
          {data.items.map((item, i) => (
            <View key={i} style={tw(`flex flex-row items-center py-4 ${i !== data.items.length - 1 ? `border-b ${line}` : ""}`)}>
              <View style={tw("flex-1 pr-4")}>
                <Text style={tw(`text-[11px] font-normal ${ink}`)}>{item.name}</Text>
                {item.description && (
                  <Text style={tw(`text-[9px] font-light mt-1 ${inkSoft}`)}>{item.description}</Text>
                )}
              </View>
              <Text style={{ ...tw(`w-12 text-[10px] font-light text-center ${inkSoft}`), ...mono }}>{item.quantity}</Text>
              <Text style={{ ...tw(`w-28 text-[10px] font-light text-right ${inkSoft}`), ...mono }}>
                {formatCurrencyText(data.invoiceDetails.currency, item.unitPrice)}
              </Text>
              <Text style={{ ...tw(`w-32 text-[10px] font-normal text-right ${ink}`), ...mono }}>
                {formatCurrencyText(data.invoiceDetails.currency, item.quantity * item.unitPrice)}
              </Text>
            </View>
          ))}
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            FOOTER - Right-aligned totals, minimal notes
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row gap-16")}>
          {/* Left: Notes & Payment - subtle */}
          <View style={tw("flex-1 flex flex-col gap-6")}>
            {data.metadata.paymentInformation.length > 0 && (
              <View>
                <Text style={tw(`text-[8px] font-light tracking-[0.2em] uppercase ${inkWhisper} mb-3`)}>Payment</Text>
                {data.metadata.paymentInformation.map((info, i) => (
                  <Text key={i} style={tw(`text-[9px] font-light ${inkSoft} ${i !== 0 ? "mt-1" : ""}`)}>
                    {info.label} · <Text style={mono}>{info.value}</Text>
                  </Text>
                ))}
              </View>
            )}

            {data.metadata.terms && (
              <View>
                <Text style={tw(`text-[8px] font-light tracking-[0.2em] uppercase ${inkWhisper} mb-2`)}>Terms</Text>
                <Text style={tw(`text-[9px] font-light leading-relaxed ${inkSoft}`)}>{data.metadata.terms}</Text>
              </View>
            )}

            {data.metadata.notes && (
              <View>
                <Text style={tw(`text-[8px] font-light tracking-[0.2em] uppercase ${inkWhisper} mb-2`)}>Notes</Text>
                <Text style={tw(`text-[9px] font-light leading-relaxed ${inkSoft}`)}>{data.metadata.notes}</Text>
              </View>
            )}
          </View>

          {/* Right: Totals - clean, right-aligned */}
          <View style={tw("w-56")}>
            {/* Signature */}
            {data.companyDetails.signature && (
              <View style={tw("flex flex-col items-end mb-6")}>
                <Image
                  src={data.companyDetails.signature}
                  style={{ ...tw("w-14 h-14 object-contain") }}
                />
              </View>
            )}

            {/* Summary */}
            <View style={tw("flex flex-col gap-2")}>
              <View style={tw("flex flex-row justify-between items-center")}>
                <Text style={tw(`text-[9px] font-light ${inkSoft}`)}>Subtotal</Text>
                <Text style={{ ...tw(`text-[10px] font-light ${ink}`), ...mono }}>
                  {formatCurrencyText(data.invoiceDetails.currency, subtotal)}
                </Text>
              </View>

              {data.invoiceDetails.billingDetails.map((detail, i) => (
                <View key={i} style={tw("flex flex-row justify-between items-center")}>
                  <Text style={tw(`text-[9px] font-light ${inkSoft}`)}>{detail.label}</Text>
                  <Text style={{ ...tw(`text-[10px] font-light ${ink}`), ...mono }}>
                    {detail.type === "percentage" ? `${detail.value}%` : formatCurrencyText(data.invoiceDetails.currency, detail.value)}
                  </Text>
                </View>
              ))}

              {/* Single line before total */}
              <View style={tw(`border-t ${line} mt-3 pt-4`)}>
                <View style={tw("flex flex-row justify-between items-baseline")}>
                  <Text style={tw(`text-[9px] font-light tracking-wider uppercase ${inkWhisper}`)}>Total</Text>
                  <Text style={{ ...tw(`text-[22px] font-light tracking-tight ${ink}`), ...mono }}>
                    {formatCurrencyText(data.invoiceDetails.currency, total)}
                  </Text>
                </View>
              </View>

              {/* Amount in words - whisper */}
              <View style={tw("mt-4")}>
                <Text style={tw(`text-[8px] font-light ${inkWhisper} capitalize`)}>
                  {toWords(Math.round(total))} {data.invoiceDetails.currency.toLowerCase()} only
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default ZenPdf;
