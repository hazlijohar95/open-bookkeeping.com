import { Link } from "react-router-dom";
import { LINKS } from "@/constants/links";
import { FilePenIcon, SparklesIcon } from "@/assets/icons";

/**
 * AI Co-Worker CTA - The signature beautiful card linking to AI Co-Worker
 */
export function AIAgentCTA() {
  return (
    <div className="px-3 py-2">
      <Link
        to={LINKS.AGENT}
        className="group relative flex items-center gap-3 overflow-hidden rounded-lg border border-border/60 bg-card p-3 transition-all duration-200 hover:border-primary/30 hover:bg-muted/50"
      >
        {/* AI-themed background pattern */}
        <svg
          className="absolute right-0 top-0 h-full w-24 text-muted-foreground/[0.03]"
          viewBox="0 0 100 80"
          fill="none"
          preserveAspectRatio="xMaxYMid slice"
        >
          {/* Neural network / AI pattern */}
          <circle cx="75" cy="15" r="3" fill="currentColor" />
          <circle cx="90" cy="25" r="2" fill="currentColor" />
          <circle cx="65" cy="30" r="2" fill="currentColor" />
          <circle cx="85" cy="40" r="3" fill="currentColor" />
          <circle cx="70" cy="50" r="2" fill="currentColor" />
          <circle cx="90" cy="55" r="2" fill="currentColor" />
          <path
            d="M75 15 L90 25 M75 15 L65 30 M90 25 L85 40 M65 30 L85 40 M85 40 L70 50 M85 40 L90 55"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.5"
          />
          {/* Sparkle accents */}
          <path
            d="M60 10 L62 14 L60 18 L58 14 Z"
            fill="currentColor"
            className="text-primary/20"
          />
          <path
            d="M95 60 L96 62 L95 64 L94 62 Z"
            fill="currentColor"
            className="text-primary/20"
          />
        </svg>

        {/* Icon with gradient accent */}
        <div className="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary/[0.12] to-primary/[0.06] text-primary transition-colors duration-200 group-hover:from-primary/[0.18] group-hover:to-primary/[0.10]">
          <SparklesIcon className="size-4" />
        </div>

        {/* Text content */}
        <div className="relative flex flex-col min-w-0">
          <span className="instrument-serif text-[15px] text-foreground">
            AI Co-Worker
          </span>
          <span className="text-[11px] text-muted-foreground">
            Smart automation
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

/**
 * Create Invoice CTA - Primary action button
 */
export function CreateInvoiceCTA() {
  return (
    <div className="px-3 pb-1">
      <Link
        to={LINKS.CREATE.INVOICE}
        className="group flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground transition-all duration-200 hover:bg-primary/90 active:scale-[0.98]"
      >
        <FilePenIcon className="size-4" />
        <span className="text-sm font-medium">New Invoice</span>
      </Link>
    </div>
  );
}
