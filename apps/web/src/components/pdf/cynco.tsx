/* eslint-disable jsx-a11y/alt-text */

import { ZodCreateInvoiceSchema } from "@/zod-schemas/invoice/create-invoice";
import { Document, Page, Text, View, Image, Font } from "@react-pdf/renderer";
import { getSubTotalValue, getTotalValue } from "@/constants/pdf-helpers";
import { GEIST_MONO_FONT } from "@/constants/pdf-fonts";
import { formatCurrencyText } from "@/constants/currency";
import { createTw } from "react-pdf-tailwind";
import { toWords } from "number-to-words";
import { format } from "date-fns";
import React from "react";

// Register monospace font
Font.register({
  family: "GeistMono",
  fonts: GEIST_MONO_FONT,
});

const tw = createTw({
  theme: {
    // Override default font families to only use registered fonts
    fontFamily: {
      sans: ["GeistMono"],
      serif: ["GeistMono"],
      mono: ["GeistMono"],
    },
    extend: {
      colors: {
        "void": "#000000",
        "void-soft": "#0a0a0a",
        "void-card": "#111111",
        "void-border": "#1a1a1a",
        "void-line": "#222222",
        "ghost": "#888888",
        "smoke": "#666666",
        "ash": "#444444",
        "snow": "#ffffff",
        "snow-muted": "#e5e5e5",
      },
    },
  },
});

const CyncoPdf: React.FC<{ data: ZodCreateInvoiceSchema }> = ({ data }) => {
  const subtotal = getSubTotalValue(data);
  const total = getTotalValue(data);

  return (
    <Document
      title={`Invoice ${data.invoiceDetails.prefix}${data.invoiceDetails.serialNumber}`}
      author={data.companyDetails.name}
      producer="Open-Bookkeeping"
    >
      <Page size="A4" style={{ ...tw("bg-void text-snow"), fontFamily: "GeistMono" }}>
        {/* ═══════════════════════════════════════════════════════════════════
            HEADER
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row justify-between items-center p-8 pb-6 border-b border-void-line")}>
          <View style={tw("flex flex-col")}>
            <Text style={tw("text-[10px] text-ash tracking-[0.3em] uppercase mb-1")}>
              invoice
            </Text>
            <Text style={tw("text-[36px] font-medium tracking-tighter leading-none text-snow")}>
              {data.invoiceDetails.prefix}{data.invoiceDetails.serialNumber}
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
            META BAR
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row flex-wrap border-b border-void-line")}>
          <View style={tw("flex flex-col py-4 px-8 border-r border-void-line")}>
            <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-1")}>issued</Text>
            <Text style={tw("text-[11px] text-ghost")}>{format(data.invoiceDetails.date, "yyyy-MM-dd")}</Text>
          </View>
          {data.invoiceDetails.dueDate && (
            <View style={tw("flex flex-col py-4 px-8 border-r border-void-line")}>
              <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-1")}>due</Text>
              <Text style={tw("text-[11px] text-ghost")}>{format(data.invoiceDetails.dueDate, "yyyy-MM-dd")}</Text>
            </View>
          )}
          {data.invoiceDetails.paymentTerms && (
            <View style={tw("flex flex-col py-4 px-8 border-r border-void-line")}>
              <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-1")}>terms</Text>
              <Text style={tw("text-[11px] text-ghost")}>{data.invoiceDetails.paymentTerms}</Text>
            </View>
          )}
          {data.invoiceDetails.poNumber && (
            <View style={tw("flex flex-col py-4 px-8 border-r border-void-line")}>
              <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-1")}>po#</Text>
              <Text style={tw("text-[11px] text-ghost")}>{data.invoiceDetails.poNumber}</Text>
            </View>
          )}
          {data.invoiceDetails.referenceNumber && (
            <View style={tw("flex flex-col py-4 px-8 border-r border-void-line")}>
              <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-1")}>ref</Text>
              <Text style={tw("text-[11px] text-ghost")}>{data.invoiceDetails.referenceNumber}</Text>
            </View>
          )}
          <View style={tw("flex flex-col py-4 px-8")}>
            <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-1")}>currency</Text>
            <Text style={tw("text-[11px] text-ghost")}>{data.invoiceDetails.currency}</Text>
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            BILLING PARTIES
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row border-b border-void-line")}>
          {/* From */}
          <View style={tw("flex-1 p-8 border-r border-void-line")}>
            <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-4")}>from</Text>
            <Text style={tw("text-[12px] text-snow mb-1")}>{data.companyDetails.name}</Text>
            {data.companyDetails.address && (
              <Text style={tw("text-[10px] text-smoke leading-relaxed")}>{data.companyDetails.address}</Text>
            )}
            {data.companyDetails.metadata.length > 0 && (
              <View style={tw("flex flex-col gap-1 mt-4 pt-4 border-t border-void-line")}>
                {data.companyDetails.metadata.map((m, i) => (
                  <View key={i} style={tw("flex flex-row")}>
                    <Text style={tw("text-[9px] text-ash w-24")}>{m.label}</Text>
                    <Text style={tw("text-[9px] text-smoke")}>{m.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* To */}
          <View style={tw("flex-1 p-8")}>
            <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-4")}>to</Text>
            <Text style={tw("text-[12px] text-snow mb-1")}>{data.clientDetails.name}</Text>
            {data.clientDetails.address && (
              <Text style={tw("text-[10px] text-smoke leading-relaxed")}>{data.clientDetails.address}</Text>
            )}
            {data.clientDetails.metadata.length > 0 && (
              <View style={tw("flex flex-col gap-1 mt-4 pt-4 border-t border-void-line")}>
                {data.clientDetails.metadata.map((m, i) => (
                  <View key={i} style={tw("flex flex-row")}>
                    <Text style={tw("text-[9px] text-ash w-24")}>{m.label}</Text>
                    <Text style={tw("text-[9px] text-smoke")}>{m.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            LINE ITEMS
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("grow")}>
          {/* Header */}
          <View style={tw("flex flex-row px-8 py-3 bg-void-card border-b border-void-line")}>
            <Text style={tw("flex-1 text-[8px] text-ash tracking-[0.15em] uppercase")}>item</Text>
            <Text style={tw("w-12 text-[8px] text-ash tracking-[0.15em] uppercase text-center")}>qty</Text>
            <Text style={tw("w-28 text-[8px] text-ash tracking-[0.15em] uppercase text-right")}>rate</Text>
            <Text style={tw("w-32 text-[8px] text-ash tracking-[0.15em] uppercase text-right")}>amount</Text>
          </View>

          {/* Rows */}
          {data.items.map((item, i) => (
            <View
              key={i}
              style={tw(`flex flex-row items-center px-8 py-4 border-b border-void-line ${i % 2 === 1 ? "bg-void-soft" : ""}`)}>
              <View style={tw("flex-1 pr-4")}>
                <Text style={tw("text-[10px] text-snow-muted")}>{item.name}</Text>
                {item.description && (
                  <Text style={tw("text-[9px] text-ash mt-0.5")}>{item.description}</Text>
                )}
              </View>
              <Text style={tw("w-12 text-[10px] text-ghost text-center")}>{item.quantity}</Text>
              <Text style={tw("w-28 text-[10px] text-smoke text-right")}>
                {formatCurrencyText(data.invoiceDetails.currency, item.unitPrice)}
              </Text>
              <Text style={tw("w-32 text-[10px] text-snow-muted text-right")}>
                {formatCurrencyText(data.invoiceDetails.currency, item.quantity * item.unitPrice)}
              </Text>
            </View>
          ))}
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            FOOTER
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={tw("flex flex-row border-t border-void-line")}>
          {/* Left: Info */}
          <View style={tw("flex-1 border-r border-void-line")}>
            {data.metadata.paymentInformation.length > 0 && (
              <View style={tw("p-8 border-b border-void-line")}>
                <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-3")}>payment</Text>
                {data.metadata.paymentInformation.map((info, i) => (
                  <View key={i} style={tw(`flex flex-row ${i !== 0 ? "mt-1.5" : ""}`)}>
                    <Text style={tw("text-[9px] text-ash w-24")}>{info.label}</Text>
                    <Text style={tw("text-[9px] text-smoke")}>{info.value}</Text>
                  </View>
                ))}
              </View>
            )}
            {data.metadata.terms && (
              <View style={tw("p-8 border-b border-void-line")}>
                <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-2")}>terms</Text>
                <Text style={tw("text-[9px] text-smoke leading-relaxed")}>{data.metadata.terms}</Text>
              </View>
            )}
            {data.metadata.notes && (
              <View style={tw("p-8")}>
                <Text style={tw("text-[8px] text-ash tracking-[0.2em] uppercase mb-2")}>notes</Text>
                <Text style={tw("text-[9px] text-smoke leading-relaxed")}>{data.metadata.notes}</Text>
              </View>
            )}
          </View>

          {/* Right: Totals */}
          <View style={tw("w-72")}>
            {/* Signature */}
            {data.companyDetails.signature && (
              <View style={tw("flex flex-row justify-end border-b border-void-line")}>
                <View style={tw("p-4 border-l border-void-line")}>
                  <Image
                    src={data.companyDetails.signature}
                    style={{ ...tw("w-14 h-14 object-contain") }}
                  />
                </View>
              </View>
            )}

            {/* Summary */}
            <View style={tw("p-8")}>
              <View style={tw("flex flex-row justify-between items-center")}>
                <Text style={tw("text-[9px] text-ash")}>subtotal</Text>
                <Text style={tw("text-[9px] text-ghost")}>{formatCurrencyText(data.invoiceDetails.currency, subtotal)}</Text>
              </View>

              {data.invoiceDetails.billingDetails.map((detail, i) => (
                <View key={i} style={tw("flex flex-row justify-between items-center mt-2")}>
                  <Text style={tw("text-[9px] text-ash")}>{detail.label.toLowerCase()}</Text>
                  <Text style={tw("text-[9px] text-ghost")}>
                    {detail.type === "percentage" ? `${detail.value}%` : formatCurrencyText(data.invoiceDetails.currency, detail.value)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Total */}
            <View style={tw("flex flex-row justify-between items-center p-8 bg-void-card border-t border-void-line")}>
              <Text style={tw("text-[10px] text-smoke")}>total</Text>
              <Text style={tw("text-[22px] font-medium tracking-tight text-snow")}>
                {formatCurrencyText(data.invoiceDetails.currency, total)}
              </Text>
            </View>

            {/* Words */}
            <View style={tw("p-8 pt-4 border-t border-void-line")}>
              <Text style={tw("text-[8px] text-ash tracking-[0.15em] uppercase mb-1")}>in words</Text>
              <Text style={tw("text-[9px] text-smoke capitalize")}>{toWords(Math.round(total))}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default CyncoPdf;
