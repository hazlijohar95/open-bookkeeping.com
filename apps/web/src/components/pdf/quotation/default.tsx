import { GEIST_MONO_FONT, GEIST_FONT } from "@/constants/pdf-fonts";
import type { ZodCreateQuotationSchema } from "@/zod-schemas/quotation/create-quotation";
import { Document, Page, Text, View, Image, Font } from "@react-pdf/renderer";
import { getQuotationSubTotalValue, getQuotationTotalValue } from "@/constants/quotation-helpers";
import { formatCurrencyText } from "@/constants/currency";
import { createTw } from "react-pdf-tailwind";
import { toWords } from "number-to-words";
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
        // Light mode
        "ink": "#0a0a0a",
        "ink-muted": "#525252",
        "ink-faint": "#a3a3a3",
        "surface": "#ffffff",
        "surface-alt": "#fafafa",
        "border": "#e5e5e5",
        // Dark mode
        "dark-ink": "#fafafa",
        "dark-ink-muted": "#a3a3a3",
        "dark-ink-faint": "#525252",
        "dark-surface": "#0a0a0a",
        "dark-surface-alt": "#171717",
        "dark-border": "#262626",
      },
    },
  },
});

// Helper for monospace text
const mono = { fontFamily: "GeistMono" };

const QuotationDefaultPDF: React.FC<{ data: ZodCreateQuotationSchema }> = ({ data }) => {
  const isDark = data.quotationDetails.theme.mode === "dark";
  const accent = data.quotationDetails.theme.baseColor;
  const subtotal = getQuotationSubTotalValue(data);
  const total = getQuotationTotalValue(data);

  // Theme-aware colors
  const ink = isDark ? "text-dark-ink" : "text-ink";
  const inkMuted = isDark ? "text-dark-ink-muted" : "text-ink-muted";
  const inkFaint = isDark ? "text-dark-ink-faint" : "text-ink-faint";
  const surface = isDark ? "bg-dark-surface" : "bg-surface";
  const surfaceAlt = isDark ? "bg-dark-surface-alt" : "bg-surface-alt";
  const border = isDark ? "border-dark-border" : "border-border";

  return (
    <Document
      title={`Quotation ${data.quotationDetails.prefix}${data.quotationDetails.serialNumber}`}
      author={data.companyDetails.name}
      producer="Open-Bookkeeping"
    >
      <Page size="A4" style={{ ...tw(`p-12 ${surface} ${ink}`), fontFamily: "Geist" }}>
        {/* HEADER */}
        <View style={tw("flex flex-row justify-between items-start mb-10")}>
          {/* Left: Quotation Title & Number */}
          <View style={tw("flex flex-col")}>
            <Text style={tw(`text-[10px] font-medium tracking-[0.2em] uppercase ${inkFaint} mb-2`)}>
              Quotation
            </Text>
            <Text style={tw(`text-[32px] font-semibold tracking-tight leading-none ${isDark ? "text-dark-ink" : `text-[${accent}]`}`)}>
              {data.quotationDetails.prefix}{data.quotationDetails.serialNumber}
            </Text>
          </View>

          {/* Right: Logo */}
          {data.companyDetails.logo && (
            <Image
              src={data.companyDetails.logo}
              style={{ ...tw("w-24 h-16 object-contain") }}
            />
          )}
        </View>

        {/* META INFO BAR */}
        <View style={tw(`flex flex-row gap-8 pb-6 mb-8 border-b ${border}`)}>
          <View style={tw("flex flex-col gap-1")}>
            <Text style={tw(`text-[9px] font-medium tracking-wider uppercase ${inkFaint}`)}>Quote Date</Text>
            <Text style={tw(`text-[11px] font-medium ${ink}`)}>{format(data.quotationDetails.date, "MMM dd, yyyy")}</Text>
          </View>
          {data.quotationDetails.validUntil && (
            <View style={tw("flex flex-col gap-1")}>
              <Text style={tw(`text-[9px] font-medium tracking-wider uppercase ${inkFaint}`)}>Valid Until</Text>
              <Text style={tw(`text-[11px] font-medium ${ink}`)}>{format(data.quotationDetails.validUntil, "MMM dd, yyyy")}</Text>
            </View>
          )}
          {data.quotationDetails.paymentTerms && (
            <View style={tw("flex flex-col gap-1")}>
              <Text style={tw(`text-[9px] font-medium tracking-wider uppercase ${inkFaint}`)}>Terms</Text>
              <Text style={tw(`text-[11px] font-medium ${ink}`)}>{data.quotationDetails.paymentTerms}</Text>
            </View>
          )}
          <View style={tw("flex flex-col gap-1")}>
            <Text style={tw(`text-[9px] font-medium tracking-wider uppercase ${inkFaint}`)}>Currency</Text>
            <Text style={{ ...tw(`text-[11px] font-medium ${ink}`), ...mono }}>{data.quotationDetails.currency}</Text>
          </View>
        </View>

        {/* BILLING PARTIES */}
        <View style={tw("flex flex-row gap-6 mb-8")}>
          {/* From */}
          <View style={tw(`flex flex-col flex-1 p-5 rounded-lg ${surfaceAlt}`)}>
            <Text style={tw(`text-[9px] font-semibold tracking-[0.15em] uppercase ${inkFaint} mb-3`)}>From</Text>
            <Text style={tw(`text-[13px] font-semibold ${ink} mb-1`)}>{data.companyDetails.name}</Text>
            {data.companyDetails.address && (
              <Text style={tw(`text-[10px] leading-relaxed ${inkMuted}`)}>{data.companyDetails.address}</Text>
            )}
            {data.companyDetails.metadata.length > 0 && (
              <View style={tw(`flex flex-col gap-1 mt-3 pt-3 border-t ${border}`)}>
                {data.companyDetails.metadata.map((m, i) => (
                  <View key={i} style={tw("flex flex-row")}>
                    <Text style={tw(`text-[9px] w-20 ${inkFaint}`)}>{m.label}</Text>
                    <Text style={tw(`text-[9px] ${inkMuted}`)}>{m.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* To */}
          <View style={tw(`flex flex-col flex-1 p-5 rounded-lg ${surfaceAlt}`)}>
            <Text style={tw(`text-[9px] font-semibold tracking-[0.15em] uppercase ${inkFaint} mb-3`)}>Quote To</Text>
            <Text style={tw(`text-[13px] font-semibold ${ink} mb-1`)}>{data.clientDetails.name}</Text>
            {data.clientDetails.address && (
              <Text style={tw(`text-[10px] leading-relaxed ${inkMuted}`)}>{data.clientDetails.address}</Text>
            )}
            {data.clientDetails.metadata.length > 0 && (
              <View style={tw(`flex flex-col gap-1 mt-3 pt-3 border-t ${border}`)}>
                {data.clientDetails.metadata.map((m, i) => (
                  <View key={i} style={tw("flex flex-row")}>
                    <Text style={tw(`text-[9px] w-20 ${inkFaint}`)}>{m.label}</Text>
                    <Text style={tw(`text-[9px] ${inkMuted}`)}>{m.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* LINE ITEMS TABLE */}
        <View style={tw("mb-8 grow")}>
          {/* Header */}
          <View style={tw(`flex flex-row px-4 py-3 rounded-t-lg ${isDark ? "bg-dark-surface-alt" : `bg-[${accent}]`}`)}>
            <Text style={tw(`flex-1 text-[9px] font-semibold tracking-wider uppercase ${isDark ? "text-dark-ink-muted" : "text-white"}`)}>
              Description
            </Text>
            <Text style={tw(`w-16 text-[9px] font-semibold tracking-wider uppercase text-center ${isDark ? "text-dark-ink-muted" : "text-white"}`)}>
              Qty
            </Text>
            <Text style={tw(`w-24 text-[9px] font-semibold tracking-wider uppercase text-right ${isDark ? "text-dark-ink-muted" : "text-white"}`)}>
              Rate
            </Text>
            <Text style={tw(`w-24 text-[9px] font-semibold tracking-wider uppercase text-right ${isDark ? "text-dark-ink-muted" : "text-white"}`)}>
              Amount
            </Text>
          </View>

          {/* Rows */}
          <View style={tw(`border-l border-r border-b rounded-b-lg ${border}`)}>
            {data.items.map((item, i) => (
              <View
                key={i}
                style={tw(`flex flex-row items-center px-4 py-3 ${i !== data.items.length - 1 ? `border-b ${border}` : ""} ${i % 2 === 1 ? surfaceAlt : ""}`)}>
                <View style={tw("flex-1 pr-3")}>
                  <Text style={tw(`text-[11px] font-medium ${ink}`)}>{item.name}</Text>
                  {item.description && (
                    <Text style={tw(`text-[9px] mt-0.5 ${inkMuted}`)}>{item.description}</Text>
                  )}
                </View>
                <Text style={{ ...tw(`w-16 text-[11px] text-center ${ink}`), ...mono }}>{item.quantity}</Text>
                <Text style={{ ...tw(`w-24 text-[11px] text-right ${inkMuted}`), ...mono }}>
                  {formatCurrencyText(data.quotationDetails.currency, item.unitPrice)}
                </Text>
                <Text style={{ ...tw(`w-24 text-[11px] font-medium text-right ${ink}`), ...mono }}>
                  {formatCurrencyText(data.quotationDetails.currency, item.quantity * item.unitPrice)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* FOOTER */}
        <View style={tw("flex flex-row gap-8")}>
          {/* Left: Payment Info & Notes */}
          <View style={tw("flex-1 flex flex-col gap-5")}>
            {data.metadata.paymentInformation.length > 0 && (
              <View style={tw("flex flex-col")}>
                <Text style={tw(`text-[9px] font-semibold tracking-[0.15em] uppercase ${isDark ? "text-dark-ink-muted" : `text-[${accent}]`} mb-2`)}>
                  Payment Details
                </Text>
                <View style={tw(`p-4 rounded-lg ${surfaceAlt}`)}>
                  {data.metadata.paymentInformation.map((info, i) => (
                    <View key={i} style={tw(`flex flex-row ${i !== 0 ? "mt-1.5" : ""}`)}>
                      <Text style={tw(`text-[9px] w-24 ${inkFaint}`)}>{info.label}</Text>
                      <Text style={{ ...tw(`text-[9px] ${inkMuted}`), ...mono }}>{info.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {data.metadata.terms && (
              <View style={tw("flex flex-col")}>
                <Text style={tw(`text-[9px] font-semibold tracking-[0.15em] uppercase ${isDark ? "text-dark-ink-muted" : `text-[${accent}]`} mb-2`)}>
                  Terms & Conditions
                </Text>
                <Text style={tw(`text-[9px] leading-relaxed ${inkMuted}`)}>{data.metadata.terms}</Text>
              </View>
            )}

            {data.metadata.notes && (
              <View style={tw("flex flex-col")}>
                <Text style={tw(`text-[9px] font-semibold tracking-[0.15em] uppercase ${isDark ? "text-dark-ink-muted" : `text-[${accent}]`} mb-2`)}>
                  Notes
                </Text>
                <Text style={tw(`text-[9px] leading-relaxed ${inkMuted}`)}>{data.metadata.notes}</Text>
              </View>
            )}
          </View>

          {/* Right: Totals */}
          <View style={tw("w-56 flex flex-col")}>
            {/* Signature */}
            {data.companyDetails.signature && (
              <View style={tw("flex flex-col items-end mb-4")}>
                <Image
                  src={data.companyDetails.signature}
                  style={{ ...tw("w-16 h-16 object-contain rounded") }}
                />
                <Text style={tw(`text-[8px] mt-1 ${inkFaint}`)}>Authorized Signature</Text>
              </View>
            )}

            {/* Summary Box */}
            <View style={tw(`p-4 rounded-lg ${surfaceAlt}`)}>
              <View style={tw("flex flex-row justify-between items-center")}>
                <Text style={tw(`text-[10px] ${inkMuted}`)}>Subtotal</Text>
                <Text style={{ ...tw(`text-[10px] ${ink}`), ...mono }}>
                  {formatCurrencyText(data.quotationDetails.currency, subtotal)}
                </Text>
              </View>

              {data.quotationDetails.billingDetails.map((detail, i) => (
                <View key={i} style={tw("flex flex-row justify-between items-center mt-1.5")}>
                  <Text style={tw(`text-[10px] ${inkMuted}`)}>{detail.label}</Text>
                  <Text style={{ ...tw(`text-[10px] ${ink}`), ...mono }}>
                    {detail.type === "percentage" ? `${detail.value}%` : formatCurrencyText(data.quotationDetails.currency, detail.value)}
                  </Text>
                </View>
              ))}

              <View style={tw(`border-t ${border} mt-3 pt-3`)}>
                <View style={tw("flex flex-row justify-between items-center")}>
                  <Text style={tw(`text-[11px] font-semibold ${ink}`)}>Total</Text>
                  <Text style={{ ...tw(`text-[18px] font-semibold tracking-tight ${isDark ? "text-dark-ink" : `text-[${accent}]`}`), ...mono }}>
                    {formatCurrencyText(data.quotationDetails.currency, total)}
                  </Text>
                </View>
              </View>

              <View style={tw(`border-t ${border} mt-3 pt-3`)}>
                <Text style={tw(`text-[8px] ${inkFaint}`)}>Amount in words</Text>
                <Text style={tw(`text-[9px] font-medium capitalize mt-0.5 ${inkMuted}`)}>
                  {toWords(Math.round(total))} only
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default QuotationDefaultPDF;
