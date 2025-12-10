import { LogoBrandMinimal } from "@/components/brand/logo-brand";
import { GithubIcon } from "@/assets/icons";
import { LINKS } from "@/constants/links";
import { Link } from "react-router-dom";

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

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-border/40 bg-muted/20">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-muted/30 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <LogoBrandMinimal asLink={false} size="sm" className="mb-5" />
            <p className="text-muted-foreground text-sm max-w-xs leading-relaxed mb-5">
              Open source bookkeeping for modern businesses. Free forever.
            </p>
            <a
              href={LINKS.SOCIALS.GITHUB}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
            >
              <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                <GithubIcon className="size-4" />
              </div>
            </a>
          </div>

          {/* Product Links */}
          <div>
            <span className="text-sm font-semibold mb-5 block tracking-tight">Product</span>
            <nav className="flex flex-col gap-3">
              {footerLinks.product.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors duration-200 w-fit"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Accounting Links */}
          <div>
            <span className="text-sm font-semibold mb-5 block tracking-tight">Accounting</span>
            <nav className="flex flex-col gap-3">
              {footerLinks.accounting.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors duration-200 w-fit"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Resources Links */}
          <div>
            <span className="text-sm font-semibold mb-5 block tracking-tight">Resources</span>
            <nav className="flex flex-col gap-3">
              {footerLinks.resources.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors duration-200 w-fit"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors duration-200 w-fit"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground/70 text-sm">
            &copy; {currentYear} Open-Bookkeeping. MIT License.
          </p>
          <p className="text-muted-foreground/50 text-sm">
            Made with care for small businesses
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
