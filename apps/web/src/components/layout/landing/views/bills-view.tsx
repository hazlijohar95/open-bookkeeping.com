import React, { useState } from "react";
import { Plus } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface BillsViewProps {
  formatAmount: (amount: number) => string;
  getStatusColor: (status: string) => string;
}

const BillsView = ({ formatAmount, getStatusColor }: BillsViewProps) => {
  const [selectedBill, setSelectedBill] = useState(0);

  const bills = [
    { id: "BILL-001", vendor: "Office Supplies Co", amount: 1250, status: "pending", date: "Dec 8, 2024", dueDate: "Dec 22, 2024" },
    { id: "BILL-002", vendor: "Cloud Services Ltd", amount: 2400, status: "paid", date: "Dec 5, 2024", dueDate: "Dec 19, 2024" },
    { id: "BILL-003", vendor: "Marketing Agency", amount: 5500, status: "overdue", date: "Nov 25, 2024", dueDate: "Dec 9, 2024" },
    { id: "BILL-004", vendor: "IT Hardware Shop", amount: 3200, status: "pending", date: "Dec 1, 2024", dueDate: "Dec 15, 2024" },
    { id: "BILL-005", vendor: "Insurance Provider", amount: 1800, status: "paid", date: "Nov 30, 2024", dueDate: "Dec 14, 2024" },
  ];

  const selectedBillData = bills[selectedBill]!;

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Bills</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Track your expenses and payables</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="size-3.5" />
            Add Bill
          </button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border/30 border-b border-border/40 bg-muted/5">
          {[
            { label: "Total Due", value: formatAmount(9950), color: "text-foreground" },
            { label: "Paid This Month", value: formatAmount(4200), color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Overdue", value: formatAmount(5500), color: "text-red-600 dark:text-red-400" },
          ].map((stat) => (
            <div key={stat.label} className="px-5 py-4">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</span>
              <p className={cn("text-lg font-bold tabular-nums mt-1", stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_120px_100px_80px] gap-3 px-5 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span>Bill</span>
            <span>Vendor</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/20">
            {bills.map((bill, i) => (
              <div
                key={bill.id}
                onClick={() => setSelectedBill(i)}
                className={cn(
                  "grid grid-cols-[1fr_120px_100px_80px] gap-3 px-5 py-3 cursor-pointer transition-colors items-center",
                  selectedBill === i ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                )}
              >
                <div>
                  <span className={cn("text-[12px] font-medium", selectedBill === i && "text-primary")}>{bill.id}</span>
                  <p className="text-[10px] text-muted-foreground">{bill.date}</p>
                </div>
                <span className="text-[12px] truncate">{bill.vendor}</span>
                <span className="text-[12px] font-semibold tabular-nums text-right">{formatAmount(bill.amount)}</span>
                <span className={cn("px-2 py-1 text-[9px] font-medium uppercase tracking-wide w-fit", getStatusColor(bill.status))}>{bill.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        <div className="px-5 py-4 border-b border-border/30">
          <span className="text-[14px] font-semibold">{selectedBillData.id}</span>
          <div className="mt-2">
            <span className={cn("px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide", getStatusColor(selectedBillData.status))}>
              {selectedBillData.status}
            </span>
          </div>
        </div>
        <div className="flex-1 px-5 py-4 space-y-4">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Vendor</span>
            <p className="text-[13px] font-medium mt-1">{selectedBillData.vendor}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Amount</span>
            <p className="text-2xl font-bold tabular-nums mt-1">{formatAmount(selectedBillData.amount)}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Due Date</span>
            <p className="text-[13px] font-medium mt-1">{selectedBillData.dueDate}</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border/30">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Mark as Paid
          </button>
        </div>
      </div>
    </>
  );
};

export default React.memo(BillsView);
