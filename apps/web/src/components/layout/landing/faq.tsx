import { motion, AnimatePresence, useInView } from "motion/react";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "@/components/ui/icons";

// ============================================================================
// TYPES
// ============================================================================

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}

// ============================================================================
// FAQ ITEM - Mobile-optimized with larger touch targets
// ============================================================================

const FAQItem = ({
  question,
  answer,
  isOpen,
  onToggle,
  index,
}: FAQItemProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-30px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.25, 0.4, 0.25, 1],
      }}
      className={cn(
        "border-b border-border/40 last:border-b-0",
        "transition-colors duration-300",
        isOpen && "bg-muted/20"
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between gap-4",
          "py-5 sm:py-6 px-1",
          "text-left transition-all duration-300",
          "group active:bg-muted/30 sm:active:bg-transparent", // Touch feedback on mobile
          "min-h-[60px] sm:min-h-0", // Larger touch target on mobile
          isOpen ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
        aria-expanded={isOpen}
      >
        <span
          className={cn(
            "text-sm sm:text-base font-medium transition-colors duration-300",
            "group-hover:text-foreground",
            "leading-relaxed"
          )}
        >
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
          className={cn(
            "flex-shrink-0 size-8 sm:size-8 rounded-full",
            "flex items-center justify-center",
            "transition-colors duration-300",
            isOpen
              ? "bg-primary/10 text-primary"
              : "bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
          )}
        >
          <ChevronDownIcon className="size-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.3, ease: [0.25, 0.4, 0.25, 1] },
              opacity: { duration: 0.2, ease: "easeOut" },
            }}
            className="overflow-hidden"
          >
            <motion.p
              initial={{ y: -10 }}
              animate={{ y: 0 }}
              exit={{ y: -10 }}
              transition={{ duration: 0.2 }}
              className="pb-5 sm:pb-6 px-1 text-muted-foreground text-sm leading-relaxed pr-8 sm:pr-12 max-w-2xl"
            >
              {answer}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================================
// FAQ DATA
// ============================================================================

const faqs = [
  {
    question: "Is this actually free?",
    answer:
      "The core features are free forever — create invoices, track expenses, manage your books. We keep the lights on with optional cloud sync and some premium features. Your data stays yours, no sneaky paywalls.",
  },
  {
    question: "Where does my data live?",
    answer:
      "Your choice. Use local mode and everything stays in your browser — we literally can't see it. Want to sync across devices? Create an account and we'll encrypt it in the cloud. Paranoid? Self-host the whole thing. We respect that.",
  },
  {
    question: "What's the catch with 'open source'?",
    answer:
      "No catch. The code is on GitHub, MIT licensed. Fork it, modify it, run it on a potato if you want. We make money from hosted features, not from locking you in.",
  },
  {
    question: "I'm in Malaysia. Does this handle SST?",
    answer:
      "Yes! 6% service tax, 10% sales tax, SST-02 reports — all baked in. We built this in Malaysia, for Malaysian businesses. Your accountant will be pleasantly surprised.",
  },
  {
    question: "How does the AI assistant work?",
    answer:
      "Just type what you want. 'Create invoice for Acme Corp, RM 5000' — done. 'Show me overdue invoices' — there they are. It's like having an assistant who actually understands accounting.",
  },
  {
    question: "Is this proper double-entry bookkeeping?",
    answer:
      "Absolutely. Chart of accounts, journal entries, trial balance, P&L, balance sheet — the whole nine yards. Your accountant can audit everything. We didn't cut corners just because it's a web app.",
  },
  {
    question: "Can I export my data?",
    answer:
      "Anytime, any format. PDFs for invoices, CSV for transactions, proper financial reports. Your data is yours. We're not in the business of holding it hostage.",
  },
  {
    question: "What if I already use other software?",
    answer:
      "We get it. Switching is painful. Start with local mode, try it out, no commitment. When you're ready, import your existing data. We're patient.",
  },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const headerRef = useRef(null);
  const isHeaderInView = useInView(headerRef, { once: true, margin: "-100px" });

  return (
    <section
      id="faq"
      className="relative py-16 sm:py-24 md:py-32 px-4 sm:px-6 overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[800px] h-[400px] sm:h-[600px] rounded-full bg-primary/[0.02] blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Section Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isHeaderInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-center mb-10 sm:mb-14 md:mb-16"
        >
          <span className="inline-block text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.25em] uppercase text-muted-foreground mb-3 sm:mb-4 font-medium">
            FAQ
          </span>
          <h2 className="instrument-serif text-3xl sm:text-4xl lg:text-5xl tracking-tight">
            You asked, we answered
          </h2>
          <p className="mt-3 sm:mt-4 text-muted-foreground text-base sm:text-lg">
            The stuff everyone wants to know
          </p>
        </motion.div>

        {/* FAQ Items */}
        <div className="border-t border-border/40 rounded-xl sm:rounded-lg overflow-hidden">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              index={index}
            />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-10 sm:mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Still confused?{" "}
            <a
              href="mailto:support@open-bookkeeping.com"
              className="text-primary hover:underline underline-offset-4 transition-colors font-medium"
            >
              We don't bite
            </a>
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
