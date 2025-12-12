import React, { useState } from "react";
import { Plus, SearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const CustomersView = () => {
  const [selectedCustomer, setSelectedCustomer] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const customers = [
    { id: 1, name: "Acme Corporation", email: "billing@acme.com", phone: "+60 12-345 6789", totalSpent: 45000, invoices: 12, status: "active" },
    { id: 2, name: "TechStart Sdn Bhd", email: "accounts@techstart.my", phone: "+60 13-456 7890", totalSpent: 28500, invoices: 8, status: "active" },
    { id: 3, name: "Global Trading Co", email: "finance@globaltrading.com", phone: "+60 14-567 8901", totalSpent: 15200, invoices: 5, status: "inactive" },
    { id: 4, name: "Marina Bay Hotel", email: "ap@marinabay.com", phone: "+60 15-678 9012", totalSpent: 62000, invoices: 15, status: "active" },
    { id: 5, name: "Sunrise Cafe", email: "owner@sunrisecafe.my", phone: "+60 16-789 0123", totalSpent: 8400, invoices: 4, status: "active" },
    { id: 6, name: "Digital Agency MY", email: "finance@digitalagency.my", phone: "+60 17-890 1234", totalSpent: 34600, invoices: 9, status: "active" },
  ];

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCustomerData = filteredCustomers[selectedCustomer] || filteredCustomers[0];

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Customers</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Manage your customer relationships</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="size-3.5" />
            Add Customer
          </button>
        </div>

        {/* SearchIcon */}
        <div className="px-5 py-3 border-b border-border/40">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="SearchIcon customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-[12px] bg-muted/30 border border-border/40 focus:border-primary/50 focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_140px_100px_80px] gap-3 px-5 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span>Customer</span>
            <span>Contact</span>
            <span className="text-right">Total Spent</span>
            <span>Status</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/20">
            {filteredCustomers.map((customer, i) => (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(i)}
                className={cn(
                  "grid grid-cols-[1fr_140px_100px_80px] gap-3 px-5 py-3 cursor-pointer transition-colors items-center",
                  selectedCustomer === i ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                )}
              >
                <div>
                  <span className={cn("text-[12px] font-medium", selectedCustomer === i && "text-primary")}>{customer.name}</span>
                  <p className="text-[10px] text-muted-foreground">{customer.invoices} invoices</p>
                </div>
                <span className="text-[11px] text-muted-foreground truncate">{customer.email}</span>
                <span className="text-[12px] font-semibold tabular-nums text-right">RM {customer.totalSpent.toLocaleString()}</span>
                <span className={cn(
                  "px-2 py-1 text-[9px] font-medium uppercase tracking-wide w-fit",
                  customer.status === "active" ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                )}>
                  {customer.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        {selectedCustomerData && (
          <>
            <div className="px-5 py-4 border-b border-border/30">
              <div className="size-12 bg-primary/10 flex items-center justify-center text-[16px] font-bold text-primary mb-3">
                {selectedCustomerData.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <span className="text-[14px] font-semibold">{selectedCustomerData.name}</span>
              <span className={cn(
                "ml-2 px-2 py-0.5 text-[9px] font-medium uppercase",
                selectedCustomerData.status === "active" ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"
              )}>
                {selectedCustomerData.status}
              </span>
            </div>
            <div className="flex-1 px-5 py-4 space-y-4 overflow-y-auto">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Email</span>
                <p className="text-[12px] mt-1">{selectedCustomerData.email}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Phone</span>
                <p className="text-[12px] mt-1">{selectedCustomerData.phone}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Spent</span>
                <p className="text-xl font-bold tabular-nums mt-1">RM {selectedCustomerData.totalSpent.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Invoices</span>
                <p className="text-[13px] font-medium mt-1">{selectedCustomerData.invoices} total</p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border/30 space-y-2">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                Create Invoice
              </button>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                View History
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default React.memo(CustomersView);
