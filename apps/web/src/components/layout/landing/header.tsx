import { useState, useEffect } from "react";
import ThemeSwitch from "@/components/table-columns/theme-switch";
import { Button } from "@/components/ui/button";
import { CircleOpenArrowRight, GithubIcon } from "@/assets/icons";
import { LogoBrandMinimal } from "@/components/brand/logo-brand";
import { LINKS } from "@/constants/links";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const Header = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-md border-b border-border/50"
          : "bg-transparent"
      )}
    >
      <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-6">
        <LogoBrandMinimal size="sm" />

        <div className="flex items-center gap-2">
          <a
            href={LINKS.SOCIALS.GITHUB}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex"
          >
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <GithubIcon className="size-4" />
              <span className="ml-2">GitHub</span>
            </Button>
          </a>

          <ThemeSwitch />

          <Link to={LINKS.DASHBOARD}>
            <Button size="sm" className="ml-2">
              <span>Get Started</span>
              <CircleOpenArrowRight className="-rotate-45 ml-1 size-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
