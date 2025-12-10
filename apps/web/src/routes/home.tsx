import Hero from "@/components/layout/landing/hero";
import Features from "@/components/layout/landing/features";
import Showcase from "@/components/layout/landing/showcase";
import FAQ from "@/components/layout/landing/faq";
import CTASection from "@/components/layout/landing/cta-section";
import Footer from "@/components/layout/landing/footer";

export function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main>
        <Hero />
        <Features />
        <Showcase />
        <FAQ />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
