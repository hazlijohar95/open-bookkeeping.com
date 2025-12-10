import { Link } from "react-router-dom";
import { LINKS } from "@/constants/links";
import Footer from "@/components/layout/landing/footer";
import { LogoBrandMinimal } from "@/components/brand/logo-brand";

export function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to={LINKS.HOME}>
            <LogoBrandMinimal size="sm" asLink={false} />
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16 md:py-24">
        <h1 className="instrument-serif text-3xl md:text-4xl mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-12">Last updated: December 2024</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              Open-Bookkeeping ("we", "our", or "us") is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, and safeguard your information
              when you use our bookkeeping and invoicing platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Information We Collect</h2>

            <h3 className="text-lg font-medium mt-6 mb-3">Local Mode</h3>
            <p className="text-muted-foreground leading-relaxed">
              When using Open-Bookkeeping in local mode, all your data is stored exclusively
              in your browser's local storage (IndexedDB). We do not have access to, collect,
              or store any of your business data, invoices, customer information, or financial records.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Cloud Mode (Optional)</h3>
            <p className="text-muted-foreground leading-relaxed">
              If you choose to create an account and use cloud sync, we collect:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Email address (for authentication)</li>
              <li>Business data you choose to sync (invoices, customers, etc.)</li>
              <li>Basic usage analytics (optional, can be disabled)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              For cloud users, we use your information to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Provide and maintain the service</li>
              <li>Sync your data across devices</li>
              <li>Send important service updates (no marketing without consent)</li>
              <li>Improve our platform based on aggregate usage patterns</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>All data is encrypted in transit (TLS/SSL)</li>
              <li>Cloud data is encrypted at rest</li>
              <li>We use Supabase for secure authentication and database storage</li>
              <li>Regular security audits and updates</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              Local mode: Data persists in your browser until you clear it.
              <br />
              Cloud mode: We retain your data as long as your account is active.
              You can export or delete your data at any time from your account settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the following third-party services:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Supabase - Authentication and database (cloud mode only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Access your personal data</li>
              <li>Export your data in standard formats (CSV, PDF)</li>
              <li>Delete your account and all associated data</li>
              <li>Opt out of analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Open Source</h2>
            <p className="text-muted-foreground leading-relaxed">
              Open-Bookkeeping is open source. You can review our code, self-host the
              application, and verify exactly how your data is handled. Visit our{" "}
              <a
                href={LINKS.SOCIALS.GITHUB}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub repository
              </a>{" "}
              for full transparency.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of
              any changes by posting the new Privacy Policy on this page and updating the
              "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy, please contact us at{" "}
              <a
                href="mailto:privacy@open-bookkeeping.com"
                className="text-primary hover:underline"
              >
                privacy@open-bookkeeping.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
