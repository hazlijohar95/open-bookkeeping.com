/**
 * Pay Slip PDF Template
 * Malaysian payroll pay slip with statutory deduction details
 */

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
export interface PaySlipItem {
  code: string;
  name: string;
  type: "earnings" | "deductions";
  amount: number;
}

export interface PaySlipPDFData {
  // Employee Info
  employeeCode: string;
  employeeName: string;
  department?: string | null;
  position?: string | null;
  icNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;

  // Company Info
  company?: {
    name: string;
    address?: string;
    registration?: string;
  };

  // Pay Period
  periodYear: number;
  periodMonth: number;
  payDate: string;

  // Salary Breakdown
  baseSalary: number;
  workingDays?: number | null;
  daysWorked?: number | null;

  // Additional Items
  items: PaySlipItem[];

  // Statutory Deductions
  epfEmployee: number;
  epfEmployer: number;
  socsoEmployee: number;
  socsoEmployer: number;
  eisEmployee: number;
  eisEmployer: number;
  pcb: number;

  // Totals
  totalEarnings: number;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;

  // YTD
  ytdGrossSalary?: number | null;
  ytdEpfEmployee?: number | null;
  ytdPcb?: number | null;

  // Meta
  slipNumber: string;
  currency: string;
  generatedAt: string;
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const PaySlipPDF: React.FC<{ data: PaySlipPDFData }> = ({ data }) => {
  const accent = "#2563EB"; // Blue accent

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  const periodLabel = `${monthNames[data.periodMonth - 1]} ${data.periodYear}`;

  const earnings = data.items.filter((i) => i.type === "earnings");
  const deductions = data.items.filter((i) => i.type === "deductions");

  return (
    <Document
      title={`Pay Slip - ${data.employeeName} - ${periodLabel}`}
      author={data.company?.name ?? "Open-Bookkeeping"}
      producer="Open-Bookkeeping"
    >
      <Page size="A4" style={{ ...tw("p-10 bg-surface text-ink"), fontFamily: "Geist" }}>
        {/* HEADER */}
        <View style={tw("flex flex-row justify-between items-start mb-6")}>
          <View style={tw("flex flex-col")}>
            <Text style={tw("text-[10px] font-medium tracking-[0.2em] uppercase text-ink-faint mb-2")}>
              Pay Slip
            </Text>
            <Text style={tw(`text-[24px] font-semibold tracking-tight leading-none text-[${accent}]`)}>
              {periodLabel}
            </Text>
            {data.company?.name && (
              <Text style={tw("text-[11px] text-ink-muted mt-2")}>{data.company.name}</Text>
            )}
          </View>
          <View style={tw("flex flex-col items-end")}>
            <Text style={{ ...tw("text-[11px] font-medium text-ink-muted mb-1"), ...mono }}>
              {data.slipNumber}
            </Text>
            <Text style={tw("text-[9px] text-ink-faint")}>Pay Date</Text>
            <Text style={tw("text-[11px] font-medium")}>
              {formatDate(data.payDate)}
            </Text>
          </View>
        </View>

        {/* EMPLOYEE INFO */}
        <View style={tw("flex flex-row gap-8 pb-4 mb-4 border-b border-border")}>
          <View style={tw("flex flex-col gap-1 flex-1")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint")}>
              Employee
            </Text>
            <Text style={tw("text-[12px] font-semibold")}>{data.employeeName}</Text>
            <Text style={{ ...tw("text-[10px] text-ink-muted"), ...mono }}>{data.employeeCode}</Text>
          </View>
          <View style={tw("flex flex-col gap-1")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint")}>
              IC Number
            </Text>
            <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
              {data.icNumber || "-"}
            </Text>
          </View>
          <View style={tw("flex flex-col gap-1")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint")}>
              Department
            </Text>
            <Text style={tw("text-[10px] text-ink")}>{data.department || "-"}</Text>
          </View>
          <View style={tw("flex flex-col gap-1")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint")}>
              Position
            </Text>
            <Text style={tw("text-[10px] text-ink")}>{data.position || "-"}</Text>
          </View>
        </View>

        {/* BANK DETAILS */}
        <View style={tw("flex flex-row gap-8 pb-4 mb-6 border-b border-border")}>
          <View style={tw("flex flex-col gap-1")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint")}>
              Bank
            </Text>
            <Text style={tw("text-[10px] text-ink")}>{data.bankName || "-"}</Text>
          </View>
          <View style={tw("flex flex-col gap-1")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint")}>
              Account Number
            </Text>
            <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
              {data.bankAccountNumber || "-"}
            </Text>
          </View>
          {data.workingDays && (
            <View style={tw("flex flex-col gap-1")}>
              <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint")}>
                Working Days
              </Text>
              <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                {data.daysWorked || data.workingDays} / {data.workingDays}
              </Text>
            </View>
          )}
        </View>

        {/* EARNINGS & DEDUCTIONS */}
        <View style={tw("flex flex-row gap-6 mb-6")}>
          {/* Earnings Column */}
          <View style={tw("flex-1")}>
            <View style={tw(`px-3 py-2 rounded-t-lg bg-[${accent}]`)}>
              <Text style={tw("text-[9px] font-semibold tracking-wider uppercase text-white")}>
                Earnings
              </Text>
            </View>
            <View style={tw("border-l border-r border-b rounded-b-lg border-border")}>
              {/* Base Salary */}
              <View style={tw("flex flex-row justify-between items-center px-3 py-2 border-b border-border bg-surface-alt")}>
                <Text style={tw("text-[10px] font-medium text-ink")}>Basic Salary</Text>
                <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                  {formatCurrencyText(data.currency, data.baseSalary)}
                </Text>
              </View>
              {/* Additional Earnings */}
              {earnings.map((item, i) => (
                <View
                  key={item.code}
                  style={tw(`flex flex-row justify-between items-center px-3 py-2 ${i !== earnings.length - 1 ? "border-b border-border" : ""}`)}
                >
                  <View style={tw("flex flex-col")}>
                    <Text style={tw("text-[10px] text-ink")}>{item.name}</Text>
                    <Text style={{ ...tw("text-[8px] text-ink-faint"), ...mono }}>{item.code}</Text>
                  </View>
                  <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                    {formatCurrencyText(data.currency, item.amount)}
                  </Text>
                </View>
              ))}
              {/* Total Earnings */}
              <View style={tw("flex flex-row justify-between items-center px-3 py-2 bg-surface-alt")}>
                <Text style={tw("text-[10px] font-semibold text-ink")}>Total Earnings</Text>
                <Text style={{ ...tw("text-[10px] font-semibold text-ink"), ...mono }}>
                  {formatCurrencyText(data.currency, data.totalEarnings || data.grossSalary)}
                </Text>
              </View>
            </View>
          </View>

          {/* Deductions Column */}
          <View style={tw("flex-1")}>
            <View style={tw("px-3 py-2 rounded-t-lg bg-red-600")}>
              <Text style={tw("text-[9px] font-semibold tracking-wider uppercase text-white")}>
                Deductions
              </Text>
            </View>
            <View style={tw("border-l border-r border-b rounded-b-lg border-border")}>
              {/* EPF Employee */}
              <View style={tw("flex flex-row justify-between items-center px-3 py-2 border-b border-border bg-surface-alt")}>
                <Text style={tw("text-[10px] text-ink")}>EPF (Employee)</Text>
                <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                  {formatCurrencyText(data.currency, data.epfEmployee)}
                </Text>
              </View>
              {/* SOCSO Employee */}
              <View style={tw("flex flex-row justify-between items-center px-3 py-2 border-b border-border")}>
                <Text style={tw("text-[10px] text-ink")}>SOCSO (Employee)</Text>
                <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                  {formatCurrencyText(data.currency, data.socsoEmployee)}
                </Text>
              </View>
              {/* EIS Employee */}
              <View style={tw("flex flex-row justify-between items-center px-3 py-2 border-b border-border bg-surface-alt")}>
                <Text style={tw("text-[10px] text-ink")}>EIS (Employee)</Text>
                <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                  {formatCurrencyText(data.currency, data.eisEmployee)}
                </Text>
              </View>
              {/* PCB / Tax */}
              <View style={tw("flex flex-row justify-between items-center px-3 py-2 border-b border-border")}>
                <Text style={tw("text-[10px] text-ink")}>PCB / MTD (Tax)</Text>
                <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                  {formatCurrencyText(data.currency, data.pcb)}
                </Text>
              </View>
              {/* Additional Deductions */}
              {deductions.map((item, i) => (
                <View
                  key={item.code}
                  style={tw(`flex flex-row justify-between items-center px-3 py-2 ${i !== deductions.length - 1 ? "border-b border-border" : ""} ${i % 2 === 0 ? "bg-surface-alt" : ""}`)}
                >
                  <View style={tw("flex flex-col")}>
                    <Text style={tw("text-[10px] text-ink")}>{item.name}</Text>
                    <Text style={{ ...tw("text-[8px] text-ink-faint"), ...mono }}>{item.code}</Text>
                  </View>
                  <Text style={{ ...tw("text-[10px] text-ink"), ...mono }}>
                    {formatCurrencyText(data.currency, item.amount)}
                  </Text>
                </View>
              ))}
              {/* Total Deductions */}
              <View style={tw("flex flex-row justify-between items-center px-3 py-2 bg-surface-alt")}>
                <Text style={tw("text-[10px] font-semibold text-ink")}>Total Deductions</Text>
                <Text style={{ ...tw("text-[10px] font-semibold text-ink"), ...mono }}>
                  {formatCurrencyText(data.currency, data.totalDeductions)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* NET PAY */}
        <View style={tw(`p-4 rounded-lg bg-[${accent}] mb-6`)}>
          <View style={tw("flex flex-row justify-between items-center")}>
            <Text style={tw("text-[12px] font-semibold text-white")}>NET PAY</Text>
            <Text style={{ ...tw("text-[20px] font-bold text-white"), ...mono }}>
              {formatCurrencyText(data.currency, data.netSalary)}
            </Text>
          </View>
        </View>

        {/* EMPLOYER CONTRIBUTIONS */}
        <View style={tw("mb-6")}>
          <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint mb-2")}>
            Employer Contributions (Not Deducted from Salary)
          </Text>
          <View style={tw("flex flex-row gap-4")}>
            <View style={tw("flex flex-row items-center gap-2 px-3 py-2 rounded border border-border bg-surface-alt")}>
              <Text style={tw("text-[9px] text-ink-muted")}>EPF (Employer)</Text>
              <Text style={{ ...tw("text-[10px] font-medium text-ink"), ...mono }}>
                {formatCurrencyText(data.currency, data.epfEmployer)}
              </Text>
            </View>
            <View style={tw("flex flex-row items-center gap-2 px-3 py-2 rounded border border-border bg-surface-alt")}>
              <Text style={tw("text-[9px] text-ink-muted")}>SOCSO (Employer)</Text>
              <Text style={{ ...tw("text-[10px] font-medium text-ink"), ...mono }}>
                {formatCurrencyText(data.currency, data.socsoEmployer)}
              </Text>
            </View>
            <View style={tw("flex flex-row items-center gap-2 px-3 py-2 rounded border border-border bg-surface-alt")}>
              <Text style={tw("text-[9px] text-ink-muted")}>EIS (Employer)</Text>
              <Text style={{ ...tw("text-[10px] font-medium text-ink"), ...mono }}>
                {formatCurrencyText(data.currency, data.eisEmployer)}
              </Text>
            </View>
          </View>
        </View>

        {/* YTD SUMMARY */}
        {(data.ytdGrossSalary || data.ytdEpfEmployee || data.ytdPcb) && (
          <View style={tw("mb-6")}>
            <Text style={tw("text-[9px] font-medium tracking-wider uppercase text-ink-faint mb-2")}>
              Year-to-Date Summary
            </Text>
            <View style={tw("flex flex-row gap-4")}>
              {data.ytdGrossSalary && (
                <View style={tw("flex flex-row items-center gap-2 px-3 py-2 rounded border border-border bg-surface-alt")}>
                  <Text style={tw("text-[9px] text-ink-muted")}>YTD Gross</Text>
                  <Text style={{ ...tw("text-[10px] font-medium text-ink"), ...mono }}>
                    {formatCurrencyText(data.currency, data.ytdGrossSalary)}
                  </Text>
                </View>
              )}
              {data.ytdEpfEmployee && (
                <View style={tw("flex flex-row items-center gap-2 px-3 py-2 rounded border border-border bg-surface-alt")}>
                  <Text style={tw("text-[9px] text-ink-muted")}>YTD EPF</Text>
                  <Text style={{ ...tw("text-[10px] font-medium text-ink"), ...mono }}>
                    {formatCurrencyText(data.currency, data.ytdEpfEmployee)}
                  </Text>
                </View>
              )}
              {data.ytdPcb && (
                <View style={tw("flex flex-row items-center gap-2 px-3 py-2 rounded border border-border bg-surface-alt")}>
                  <Text style={tw("text-[9px] text-ink-muted")}>YTD PCB</Text>
                  <Text style={{ ...tw("text-[10px] font-medium text-ink"), ...mono }}>
                    {formatCurrencyText(data.currency, data.ytdPcb)}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* FOOTER */}
        <View style={tw("mt-auto pt-4 border-t border-border")}>
          <Text style={tw("text-[8px] text-ink-faint text-center")}>
            This is a computer-generated pay slip. Generated on {formatDate(data.generatedAt)}.
          </Text>
          <Text style={tw("text-[8px] text-ink-faint text-center mt-1")}>
            Please verify the details and report any discrepancies to the HR department within 7 days.
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export default PaySlipPDF;
