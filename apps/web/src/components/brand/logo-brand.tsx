import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { LINKS } from "@/constants/links";

interface LogoBrandProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
}

/**
 * Premium typographic logo for Open-Bookkeeping.com
 *
 * Design: Editorial Fintech aesthetic
 * - Refined serif typography (Instrument Serif)
 * - Subtle ledger-line accent
 * - Balanced hierarchy between "Open" and "Bookkeeping"
 */
export function LogoBrand({ className, size = "md", asLink = true }: LogoBrandProps) {
  const sizeStyles = {
    sm: {
      wrapper: "gap-1.5",
      text: "text-[15px]",
      accent: "h-[14px] w-px",
      domain: "text-[13px]",
    },
    md: {
      wrapper: "gap-2",
      text: "text-[17px]",
      accent: "h-[16px] w-px",
      domain: "text-[15px]",
    },
    lg: {
      wrapper: "gap-2.5",
      text: "text-xl",
      accent: "h-[18px] w-px",
      domain: "text-base",
    },
  };

  const styles = sizeStyles[size];

  const logoContent = (
    <div className={cn("flex items-center select-none", styles.wrapper, className)}>
      {/* The "O" monogram accent */}
      <div className="relative flex items-center justify-center">
        <span className="instrument-serif font-semibold tracking-tight text-foreground" style={{ fontSize: 'inherit' }}>
          O
        </span>
        {/* Subtle ring around O - suggests openness */}
        <div className="absolute inset-0 -m-0.5 rounded-full border border-primary/20" />
      </div>

      {/* Rest of "pen" */}
      <span className={cn("instrument-serif font-semibold tracking-tight text-foreground -ml-0.5", styles.text)}>
        pen
      </span>

      {/* Vertical accent bar - like a ledger column divider */}
      <div className={cn("bg-primary/60", styles.accent)} />

      {/* Bookkeeping */}
      <span className={cn("instrument-serif font-semibold tracking-tight text-foreground", styles.text)}>
        Bookkeeping
      </span>

      {/* .com in refined style */}
      <span className={cn("instrument-serif font-medium tracking-tight text-primary", styles.domain)}>
        .com
      </span>
    </div>
  );

  if (asLink) {
    return (
      <Link to={LINKS.HOME} className="inline-flex">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}

/**
 * Alternative: Minimal stacked logo variant
 */
export function LogoBrandStacked({ className, asLink = true }: { className?: string; asLink?: boolean }) {
  const logoContent = (
    <div className={cn("flex flex-col select-none", className)}>
      <span className="instrument-serif text-lg font-semibold tracking-tight text-foreground leading-none">
        Open-Bookkeeping
      </span>
      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="h-px flex-1 bg-primary/40" />
        <span className="instrument-serif text-xs font-medium tracking-wider text-primary uppercase">
          .com
        </span>
        <div className="h-px flex-1 bg-primary/40" />
      </div>
    </div>
  );

  if (asLink) {
    return (
      <Link to={LINKS.HOME} className="inline-flex">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}

/**
 * Alternative: Clean inline with bracket accent
 */
export function LogoBrandBracket({ className, asLink = true }: { className?: string; asLink?: boolean }) {
  const logoContent = (
    <div className={cn("flex items-center select-none gap-0.5", className)}>
      <span className="text-primary/50 font-light">[</span>
      <span className="instrument-serif text-[17px] font-semibold tracking-tight text-foreground">
        Open
      </span>
      <span className="text-primary/50 font-light">]</span>
      <span className="instrument-serif text-[17px] font-semibold tracking-tight text-foreground ml-1">
        Bookkeeping
      </span>
      <span className="instrument-serif text-[17px] font-semibold tracking-tight text-primary">
        .com
      </span>
    </div>
  );

  if (asLink) {
    return (
      <Link to={LINKS.HOME} className="inline-flex">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}

/**
 * Alternative: Ultra-minimal with em-dash separator
 */
export function LogoBrandMinimal({ className, size = "md", asLink = true }: LogoBrandProps) {
  const sizeStyles = {
    sm: "text-[15px]",
    md: "text-[17px]",
    lg: "text-xl",
  };

  const logoContent = (
    <span className={cn(
      "instrument-serif font-semibold tracking-tight text-foreground select-none",
      sizeStyles[size],
      className
    )}>
      Open<span className="text-primary/40 font-light mx-0.5">—</span>Bookkeeping<span className="text-primary">.com</span>
    </span>
  );

  if (asLink) {
    return (
      <Link to={LINKS.HOME} className="inline-flex">
        {logoContent}
      </Link>
    );
  }

  return logoContent;
}

export default LogoBrand;
