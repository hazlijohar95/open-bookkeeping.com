import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "@/components/ui/icons";

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}

const FAQItem = ({ question, answer, isOpen, onToggle, index }: FAQItemProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
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
          "w-full flex items-center justify-between gap-4 py-6 px-1 text-left transition-all duration-300",
          "group hover:text-foreground",
          isOpen ? "text-foreground" : "text-muted-foreground"
        )}
        aria-expanded={isOpen}
      >
        <span className={cn(
          "text-base font-medium transition-colors duration-300",
          "group-hover:text-foreground"
        )}>
          {question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
          className={cn(
            "flex-shrink-0 size-8 rounded-full flex items-center justify-center transition-colors duration-300",
            isOpen
              ? "bg-primary/10 text-primary"
              : "bg-muted/50 text-muted-foreground group-hover:bg-muted group-hover:text-foreground"
          )}
        >
          <ChevronDown className="size-4" />
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
              opacity: { duration: 0.2, ease: "easeOut" }
            }}
            className="overflow-hidden"
          >
            <motion.p
              initial={{ y: -10 }}
              animate={{ y: 0 }}
              exit={{ y: -10 }}
              transition={{ duration: 0.2 }}
              className="pb-6 px-1 text-muted-foreground text-sm leading-relaxed pr-12 max-w-2xl"
            >
              {answer}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const faqs = [
  {
    question: "is this actually free?",
    answer:
      "the core features are free forever — create invoices, track expenses, manage your books. we keep the lights on with optional cloud sync and some premium features. your data stays yours, no sneaky paywalls.",
  },
  {
    question: "where does my data live?",
    answer:
      "your choice. use local mode and everything stays in your browser — we literally can't see it. want to sync across devices? create an account and we'll encrypt it in the cloud. paranoid? self-host the whole thing. we respect that.",
  },
  {
    question: "what's the catch with 'open source'?",
    answer:
      "no catch. the code is on GitHub, MIT licensed. fork it, modify it, run it on a potato if you want. we make money from hosted features, not from locking you in.",
  },
  {
    question: "I'm in Malaysia. does this handle SST?",
    answer:
      "yes! 6% service tax, 10% sales tax, SST-02 reports — all baked in. we built this in Malaysia, for Malaysian businesses. your accountant will be pleasantly surprised.",
  },
  {
    question: "how does the AI assistant work?",
    answer:
      "just type what you want. 'create invoice for Acme Corp, RM 5000' — done. 'show me overdue invoices' — there they are. it's like having an assistant who actually understands accounting. no prompt engineering degree required.",
  },
  {
    question: "is this proper double-entry bookkeeping?",
    answer:
      "absolutely. chart of accounts, journal entries, trial balance, P&L, balance sheet — the whole nine yards. your accountant can audit everything. we didn't cut corners just because it's a web app.",
  },
  {
    question: "can I export my data?",
    answer:
      "anytime, any format. PDFs for invoices, CSV for transactions, proper financial reports. your data is yours. we're not in the business of holding it hostage.",
  },
  {
    question: "what if I already use [other software]?",
    answer:
      "we get it. switching is painful. start with local mode, try it out, no commitment. when you're ready, import your existing data. we're patient.",
  },
  {
    question: "will this make me better at accounting?",
    answer:
      "legally we cannot guarantee that. but we can guarantee fewer spreadsheet nightmares and more time for actual work. that's something, right?",
  },
  {
    question: "who built this?",
    answer:
      "a small team who got tired of overpriced, overcomplicated accounting software. we think bookkeeping should be simple, affordable, and dare we say... not terrible to use.",
  },
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="relative py-24 md:py-32 px-6 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-primary/[0.015] blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-center mb-14 md:mb-16"
        >
          <span className="inline-block text-xs tracking-[0.25em] uppercase text-muted-foreground mb-4 font-medium">
            FAQ
          </span>
          <h2 className="instrument-serif text-3xl md:text-4xl lg:text-5xl tracking-tight">
            You asked, we answered
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            The stuff everyone wants to know
          </p>
        </motion.div>

        {/* FAQ Items */}
        <div className="border-t border-border/40 rounded-lg">
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

        {/* Bottom decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Still confused?{" "}
            <a
              href="mailto:support@open-bookkeeping.com"
              className="text-primary hover:underline underline-offset-4 transition-colors"
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
