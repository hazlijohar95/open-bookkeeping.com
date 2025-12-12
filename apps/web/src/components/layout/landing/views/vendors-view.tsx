import React, { useState } from "react";
import { Plus } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const VendorsView = () => {
  const [selectedVendor, setSelectedVendor] = useState(0);

  const vendors = [
    { id: 1, name: "Office Supplies Co", email: "sales@officesupplies.com", category: "Office", totalPaid: 15600, bills: 8 },
    { id: 2, name: "Cloud Services Ltd", email: "billing@cloudservices.com", category: "Software", totalPaid: 28800, bills: 12 },
    { id: 3, name: "Marketing Agency", email: "accounts@marketing.com", category: "Marketing", totalPaid: 45000, bills: 6 },
    { id: 4, name: "IT Hardware Shop", email: "sales@ithardware.my", category: "Hardware", totalPaid: 22400, bills: 4 },
    { id: 5, name: "Insurance Provider", email: "claims@insurance.com", category: "Insurance", totalPaid: 21600, bills: 12 },
  ];

  const selectedVendorData = vendors[selectedVendor]!;

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Vendors</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Manage your suppliers and vendors</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="size-3.5" />
            Add Vendor
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_100px_100px_80px] gap-3 px-5 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span>Vendor</span>
            <span>Category</span>
            <span className="text-right">Total Paid</span>
            <span>Bills</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/20">
            {vendors.map((vendor, i) => (
              <div
                key={vendor.id}
                onClick={() => setSelectedVendor(i)}
                className={cn(
                  "grid grid-cols-[1fr_100px_100px_80px] gap-3 px-5 py-3 cursor-pointer transition-colors items-center",
                  selectedVendor === i ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                )}
              >
                <div>
                  <span className={cn("text-[12px] font-medium", selectedVendor === i && "text-primary")}>{vendor.name}</span>
                  <p className="text-[10px] text-muted-foreground">{vendor.email}</p>
                </div>
                <span className="text-[11px] px-2 py-0.5 bg-muted w-fit">{vendor.category}</span>
                <span className="text-[12px] font-semibold tabular-nums text-right">RM {vendor.totalPaid.toLocaleString()}</span>
                <span className="text-[12px] text-muted-foreground">{vendor.bills} bills</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        <div className="px-5 py-4 border-b border-border/30">
          <div className="size-12 bg-muted flex items-center justify-center text-[16px] font-bold text-muted-foreground mb-3">
            {selectedVendorData.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <span className="text-[14px] font-semibold">{selectedVendorData.name}</span>
          <span className="ml-2 px-2 py-0.5 text-[9px] font-medium uppercase bg-muted">{selectedVendorData.category}</span>
        </div>
        <div className="flex-1 px-5 py-4 space-y-4">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Email</span>
            <p className="text-[12px] mt-1">{selectedVendorData.email}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Paid</span>
            <p className="text-xl font-bold tabular-nums mt-1">RM {selectedVendorData.totalPaid.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Bills</span>
            <p className="text-[13px] font-medium mt-1">{selectedVendorData.bills} total</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border/30">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Add Bill
          </button>
        </div>
      </div>
    </>
  );
};

export default React.memo(VendorsView);
