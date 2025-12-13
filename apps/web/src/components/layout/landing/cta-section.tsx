import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { CircleOpenArrowRight, GithubIcon } from "@/assets/icons";
import { LINKS } from "@/constants/links";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="relative py-24 md:py-32 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-primary/[0.04]" />

        {/* Decorative orbs */}
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full bg-violet-500/[0.02] blur-3xl" />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 70%)',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
        className="relative z-10 max-w-2xl mx-auto px-6 text-center"
      >
        {/* Decorative line */}
        <div className="w-12 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent mx-auto mb-10" />

        <span className="inline-block text-xs tracking-[0.25em] uppercase text-muted-foreground mb-4 font-medium">
          Get started
        </span>

        <h2 className="instrument-serif text-3xl md:text-4xl lg:text-5xl tracking-tight mb-6">
          Ready to simplify your{" "}
          <span className="text-primary">bookkeeping</span>?
        </h2>

        <p className="text-muted-foreground text-lg mb-10 max-w-md mx-auto leading-relaxed">
          Start with local mode, no account needed. Upgrade when you're ready.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link to={LINKS.LOGIN}>
            <Button
              size="lg"
              className="h-12 sm:h-13 px-8 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all duration-300 gap-2"
            >
              Try it now
              <CircleOpenArrowRight className="-rotate-45" />
            </Button>
          </Link>
          <a
            href={LINKS.SOCIALS.GITHUB}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="lg"
              className="h-12 sm:h-13 px-8 text-base text-muted-foreground hover:text-foreground gap-2 border-border/60 hover:border-border hover:bg-muted/30"
            >
              <GithubIcon className="size-4" />
              View on GitHub
            </Button>
          </a>
        </div>

        {/* Trust badges */}
        <div className="mt-10 flex items-center justify-center gap-6 text-sm text-muted-foreground/60">
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-500/50" />
            No account required
          </span>
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-emerald-500/50" />
            Works offline
          </span>
        </div>
      </motion.div>
    </section>
  );
};

export default CTASection;
