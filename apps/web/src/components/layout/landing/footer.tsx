import { LogoBrandMinimal } from "@/components/brand/logo-brand";
import { GithubIcon } from "@/assets/icons";
import { LINKS } from "@/constants/links";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

// ============================================================================
// FOOTER LINKS DATA
// ============================================================================

const footerLinks = {
  product: [
    { label: "Dashboard", href: LINKS.DASHBOARD },
    { label: "Create Invoice", href: LINKS.CREATE.INVOICE },
    { label: "Quotations", href: LINKS.QUOTATIONS },
    { label: "Bills", href: LINKS.BILLS },
  ],
  accounting: [
    { label: "Chart of Accounts", href: LINKS.CHART_OF_ACCOUNTS },
    { label: "Journal Entries", href: LINKS.JOURNAL_ENTRIES },
    { label: "Trial Balance", href: LINKS.TRIAL_BALANCE },
    { label: "Financial Reports", href: LINKS.PROFIT_LOSS },
  ],
  resources: [
    { label: "Blog", href: LINKS.BLOGS },
    { label: "GitHub", href: LINKS.SOCIALS.GITHUB, external: true },
    { label: "Privacy Policy", href: LINKS.LEGAL.PRIVACY },
    { label: "Terms of Service", href: LINKS.LEGAL.TERMS },
  ],
};

// ============================================================================
// LINK SECTION COMPONENT
// ============================================================================

interface LinkSectionProps {
  title: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}

const LinkSection = ({ title, links }: LinkSectionProps) => (
  <div>
    <span className="text-sm font-semibold mb-4 sm:mb-5 block tracking-tight">
      {title}
    </span>
    <nav className="flex flex-col gap-2.5 sm:gap-3">
      {links.map((link) =>
        link.external ? (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "text-muted-foreground hover:text-foreground",
              "text-sm transition-colors duration-200 w-fit",
              "py-1 -my-1", // Larger touch target
              "active:text-primary sm:active:text-foreground"
            )}
          >
            {link.label}
          </a>
        ) : (
          <Link
            key={link.href}
            to={link.href}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              "text-sm transition-colors duration-200 w-fit",
              "py-1 -my-1", // Larger touch target
              "active:text-primary sm:active:text-foreground"
            )}
          >
            {link.label}
          </Link>
        )
      )}
    </nav>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border/40 bg-muted/20">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-muted/30 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20">
        {/* Main Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 md:gap-12">
          {/* Brand - Full width on mobile */}
          <div className="col-span-2 sm:col-span-2 md:col-span-1">
            <LogoBrandMinimal asLink={false} size="sm" className="mb-4 sm:mb-5" />
            <p className="text-muted-foreground text-sm max-w-xs leading-relaxed mb-4 sm:mb-5">
              Open source bookkeeping for modern businesses. Free forever.
            </p>
            <a
              href={LINKS.SOCIALS.GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
            >
              <div className="p-2.5 sm:p-2 rounded-xl sm:rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                <GithubIcon className="size-5 sm:size-4" />
              </div>
              <span className="text-sm font-medium sm:hidden">
                View on GitHub
              </span>
            </a>
          </div>

          {/* Product Links */}
          <LinkSection title="Product" links={footerLinks.product} />

          {/* Accounting Links */}
          <LinkSection title="Accounting" links={footerLinks.accounting} />

          {/* Resources Links */}
          <LinkSection title="Resources" links={footerLinks.resources} />
        </div>

        {/* Bottom Bar */}
        <div
          className={cn(
            "mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-border/40",
            "flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4",
            "text-center sm:text-left"
          )}
        >
          <p className="text-muted-foreground/70 text-xs sm:text-sm">
            © {currentYear} Open-Bookkeeping. MIT License.
          </p>
          <p className="text-muted-foreground/50 text-xs sm:text-sm">
            Made with care for small businesses
          </p>
        </div>
      </div>

      {/* Safe area padding for mobile */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </footer>
  );
};

export default Footer;
