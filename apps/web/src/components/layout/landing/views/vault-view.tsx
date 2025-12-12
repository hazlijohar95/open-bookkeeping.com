import React, { useState } from "react";
import { Upload, Eye, Download, FileTextIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const VaultView = () => {
  const [selectedFile, setSelectedFile] = useState(0);

  const files = [
    { id: 1, name: "Invoice-INV-2024-047.pdf", type: "Invoice", size: "245 KB", date: "Dec 10, 2024" },
    { id: 2, name: "Receipt-Acme-Corp.pdf", type: "Receipt", size: "128 KB", date: "Dec 8, 2024" },
    { id: 3, name: "Contract-TechStart.pdf", type: "Contract", size: "1.2 MB", date: "Dec 5, 2024" },
    { id: 4, name: "Tax-Return-2024.pdf", type: "Tax", size: "856 KB", date: "Dec 1, 2024" },
    { id: 5, name: "Bank-Statement-Nov.pdf", type: "Statement", size: "324 KB", date: "Nov 30, 2024" },
  ];

  const selectedFileData = files[selectedFile]!;

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div>
            <h1 className="text-lg font-semibold">Vault</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Secure document storage</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Upload className="size-3.5" />
            Upload File
          </button>
        </div>

        <div className="grid grid-cols-4 divide-x divide-border/30 border-b border-border/40 bg-muted/5">
          {[
            { label: "Total Files", value: "247" },
            { label: "Storage Used", value: "1.8 GB" },
            { label: "This Month", value: "23" },
            { label: "Shared", value: "12" },
          ].map((stat) => (
            <div key={stat.label} className="px-5 py-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</span>
              <p className="text-[14px] font-bold mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_80px_80px_100px] gap-3 px-5 py-2.5 border-b border-border/40 bg-muted/20 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            <span>Name</span>
            <span>Type</span>
            <span>Size</span>
            <span>Date</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/20">
            {files.map((file, i) => (
              <div
                key={file.id}
                onClick={() => setSelectedFile(i)}
                className={cn(
                  "grid grid-cols-[1fr_80px_80px_100px] gap-3 px-5 py-3 cursor-pointer transition-colors items-center",
                  selectedFile === i ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileTextIcon className="size-4 text-muted-foreground shrink-0" />
                  <span className={cn("text-[12px] font-medium truncate", selectedFile === i && "text-primary")}>{file.name}</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 bg-muted w-fit">{file.type}</span>
                <span className="text-[11px] text-muted-foreground">{file.size}</span>
                <span className="text-[11px] text-muted-foreground">{file.date}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="w-72 border-l border-border/40 bg-muted/5 flex flex-col">
        <div className="px-5 py-4 border-b border-border/30">
          <div className="size-12 bg-muted flex items-center justify-center mb-3">
            <FileTextIcon className="size-6 text-muted-foreground" />
          </div>
          <span className="text-[13px] font-semibold block truncate">{selectedFileData.name}</span>
          <span className="text-[11px] text-muted-foreground">{selectedFileData.type}</span>
        </div>
        <div className="flex-1 px-5 py-4 space-y-4">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Size</span>
            <p className="text-[13px] font-medium mt-1">{selectedFileData.size}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Uploaded</span>
            <p className="text-[13px] font-medium mt-1">{selectedFileData.date}</p>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</span>
            <p className="text-[13px] font-medium mt-1">{selectedFileData.type} Document</p>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border/30 space-y-2">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            <Eye className="size-3.5" />
            Preview
          </button>
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-[11px] font-medium border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-colors">
            <Download className="size-3.5" />
            Download
          </button>
        </div>
      </div>
    </>
  );
};

export default React.memo(VaultView);
