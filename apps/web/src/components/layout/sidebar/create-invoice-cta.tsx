import { Link } from "react-router-dom";
import { LINKS } from "@/constants/links";
import { FilePenIcon } from "@/assets/icons";

export function CreateInvoiceCTA() {
  return (
    <div className="px-3 py-2">
      <Link
        to={LINKS.CREATE.INVOICE}
        className="group relative flex items-center gap-3 overflow-hidden rounded-lg border border-border/60 bg-card p-3 transition-all duration-200 hover:border-primary/30 hover:bg-muted/50"
      >
        {/* Minimal aesthetic background illustration */}
        <svg
          className="absolute right-0 top-0 h-full w-24 text-muted-foreground/[0.03]"
          viewBox="0 0 100 80"
          fill="none"
          preserveAspectRatio="xMaxYMid slice"
        >
          {/* Abstract minimal lines */}
          <path
            d="M60 10 L90 10 M70 20 L95 20 M65 30 L85 30"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="60" y="45" width="30" height="2" rx="1" fill="currentColor" />
          <rect x="70" y="52" width="20" height="2" rx="1" fill="currentColor" />
          <rect x="65" y="59" width="25" height="2" rx="1" fill="currentColor" />
          {/* Corner accent */}
          <path
            d="M85 5 L95 5 L95 15"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary/10"
          />
        </svg>

        {/* Icon with subtle purple accent */}
        <div className="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-primary transition-colors duration-200 group-hover:bg-primary/[0.12]">
          <FilePenIcon className="size-4" />
        </div>

        {/* Text content */}
        <div className="relative flex flex-col min-w-0">
          <span className="instrument-serif text-[15px] text-foreground">
            New Invoice
          </span>
          <span className="text-[11px] text-muted-foreground">
            Create & send
          </span>
        </div>

        {/* Subtle arrow */}
        <svg
          className="ml-auto size-4 text-muted-foreground/40 transition-all duration-200 group-hover:text-primary/60 group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
