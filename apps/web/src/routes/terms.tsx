import { Link } from "react-router-dom";
import { LINKS } from "@/constants/links";
import Footer from "@/components/layout/landing/footer";
import { LogoBrandMinimal } from "@/components/brand/logo-brand";

export function Terms() {
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
        <h1 className="instrument-serif text-3xl md:text-4xl mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-12">Last updated: December 2024</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Open-Bookkeeping ("the Service"), you agree to be bound
              by these Terms of Service. If you disagree with any part of these terms, you
              may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Open-Bookkeeping is an open-source bookkeeping and invoicing platform that
              allows you to create invoices, manage customers and vendors, track expenses,
              and generate financial reports. The Service is available in two modes:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>Local Mode:</strong> Free, offline-capable, data stored in your browser</li>
              <li><strong>Cloud Mode:</strong> Optional account-based features with cloud sync</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">User Responsibilities</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Maintaining the accuracy of information you enter into the Service</li>
              <li>Keeping your account credentials secure (if using cloud mode)</li>
              <li>Ensuring your use of the Service complies with applicable laws</li>
              <li>Backing up your data (especially in local mode)</li>
              <li>Any taxes, filings, or regulatory compliance related to your business</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Violate any applicable laws or regulations</li>
              <li>Engage in fraudulent accounting or invoicing practices</li>
              <li>Attempt to access other users' data or accounts</li>
              <li>Interfere with or disrupt the Service's infrastructure</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code (the source is already open)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              Open-Bookkeeping is released under the MIT License. You are free to use,
              modify, and distribute the software according to the terms of this license.
              Your business data remains entirely your property.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service is provided "as is" and "as available" without warranties of
              any kind, either express or implied, including but not limited to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Merchantability or fitness for a particular purpose</li>
              <li>Accuracy of financial calculations or reports</li>
              <li>Uninterrupted or error-free operation</li>
              <li>Compliance with specific accounting standards or tax regulations</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Important:</strong> Open-Bookkeeping is a tool to assist with
              bookkeeping. It is not a substitute for professional accounting advice.
              We recommend consulting with a qualified accountant for complex financial
              matters.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, Open-Bookkeeping and its contributors
              shall not be liable for any indirect, incidental, special, consequential, or
              punitive damages, including but not limited to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Loss of profits, data, or business opportunities</li>
              <li>Errors in financial calculations or tax filings</li>
              <li>Data loss due to browser storage limitations or clearing</li>
              <li>Service interruptions or downtime</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Data and Backups</h2>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Local Mode:</strong> Your data is stored in your browser's IndexedDB.
              This data can be lost if you clear your browser data, use private browsing,
              or switch browsers. We strongly recommend regularly exporting your data.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Cloud Mode:</strong> While we implement reasonable backup procedures,
              we recommend maintaining your own backups of important financial data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Service Modifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify, suspend, or discontinue any part of the
              Service at any time. For significant changes, we will provide reasonable
              notice and the opportunity to export your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may stop using the Service at any time. For cloud accounts, you can
              delete your account and all associated data from your settings. We may
              suspend or terminate access for violations of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws
              of Malaysia, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. We will notify you of any
              changes by posting the new Terms on this page and updating the "Last updated"
              date. Continued use of the Service after changes constitutes acceptance of
              the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms, please contact us at{" "}
              <a
                href="mailto:legal@open-bookkeeping.com"
                className="text-primary hover:underline"
              >
                legal@open-bookkeeping.com
              </a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
