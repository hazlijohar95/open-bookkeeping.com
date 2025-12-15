import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { LogoBrandMinimal } from "@/components/brand/logo-brand";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { LINKS } from "@/constants/links";
import ThemeSwitch from "@/components/table-columns/theme-switch";
import {
  ReceiptIcon,
  UsersIcon,
  GaugeIcon,
  FingerprintIcon,
} from "@/assets/icons";

// Google Icon component
const GoogleIcon = () => (
  <svg className="size-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get the return URL from query params, default to /dashboard
  const returnUrl = searchParams.get("returnUrl");
  const redirectTo = returnUrl ? decodeURIComponent(returnUrl) : "/dashboard";

  // If already logged in, redirect to the return URL or dashboard
  useEffect(() => {
    if (user) {
      void navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, redirectTo]);

  // Don't render the login form if user is already logged in
  if (user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sign in failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: ReceiptIcon, label: "Professional Invoicing", desc: "Create and send invoices in seconds" },
    { icon: UsersIcon, label: "Customer Management", desc: "Track all your clients in one place" },
    { icon: GaugeIcon, label: "Financial Reports", desc: "Insights to grow your business" },
    { icon: FingerprintIcon, label: "Bank-grade Security", desc: "Your data is always protected" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Auth Form */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between p-6 md:p-8"
        >
          <Link to={LINKS.HOME}>
            <LogoBrandMinimal size="md" />
          </Link>
          <ThemeSwitch />
        </motion.header>

        {/* Main Content */}
        <div className="flex-1 flex items-center justify-center px-6 md:px-8 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-[380px]"
          >
            {/* Headline */}
            <div className="text-center mb-10">
              <h1 className="instrument-serif text-4xl md:text-5xl tracking-tight mb-3">
                <span className="text-muted-foreground/60 dark:text-muted-foreground/70">Welcome</span>
                <br />
                <span className="text-foreground">back.</span>
              </h1>
              <p className="text-muted-foreground text-[15px]">
                Sign in to manage your business finances
              </p>
            </div>

            {/* Auth Form */}
            <div className="space-y-4">
              {/* Google Sign In */}
              <Button
                variant="outline"
                size="lg"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full h-12 text-[14px] font-medium gap-3 border-border/60 hover:border-border hover:bg-muted/50 dark:border-border/50 dark:hover:border-border/80 cursor-pointer"
              >
                <GoogleIcon />
                {isLoading ? "Redirecting..." : "Continue with Google"}
              </Button>
            </div>

            {/* Terms */}
            <p className="mt-8 text-center text-[12px] text-muted-foreground leading-relaxed">
              By continuing, you agree to our{" "}
              <Link to={LINKS.LEGAL.PRIVACY} className="underline underline-offset-2 hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              {" "}and{" "}
              <Link to={LINKS.LEGAL.TERMS} className="underline underline-offset-2 hover:text-foreground transition-colors whitespace-nowrap">
                Terms of Service
              </Link>.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Side - Visual */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden"
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 dark:from-primary/10 dark:via-primary/5 dark:to-transparent" />

        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <svg className="w-full h-full">
            <defs>
              <pattern id="loginGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#loginGrid)" />
          </svg>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="instrument-serif text-3xl xl:text-4xl tracking-tight mb-4">
              <span className="text-primary">Bookkeeping</span> that
              <br />
              <span className="text-foreground">works for you.</span>
            </h2>
            <p className="text-muted-foreground text-[15px] max-w-md mb-10">
              Join thousands of businesses managing their finances with ease.
              Open source, beautifully designed, and completely free.
            </p>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="space-y-4"
          >
            {features.map((feature, index) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                className="flex items-start gap-4 group"
              >
                <div className="size-10 bg-background dark:bg-background/80 border border-border/60 dark:border-border/40 flex items-center justify-center shrink-0 shadow-sm group-hover:border-primary/50 transition-colors">
                  <feature.icon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-foreground">{feature.label}</p>
                  <p className="text-[13px] text-muted-foreground">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1 }}
            className="mt-12 flex items-center gap-8"
          >
            <div>
              <p className="text-2xl font-bold tabular-nums">10k+</p>
              <p className="text-[12px] text-muted-foreground">Active users</p>
            </div>
            <div className="w-px h-10 bg-border/60" />
            <div>
              <p className="text-2xl font-bold tabular-nums">50k+</p>
              <p className="text-[12px] text-muted-foreground">Invoices created</p>
            </div>
            <div className="w-px h-10 bg-border/60" />
            <div>
              <p className="text-2xl font-bold tabular-nums">99.9%</p>
              <p className="text-[12px] text-muted-foreground">Uptime</p>
            </div>
          </motion.div>
        </div>

        {/* Decorative dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="absolute -right-20 top-1/2 -translate-y-1/2 w-[500px]"
        >
          <div className="bg-background border border-border/60 dark:border-border/40 shadow-2xl shadow-black/10 dark:shadow-black/30 p-4">
            {/* Mini dashboard preview */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="size-6 bg-primary/10 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-primary">OB</span>
                </div>
                <span className="text-[11px] font-medium">Dashboard</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Revenue", value: "RM 65,500" },
                  { label: "Expenses", value: "RM 12,300" },
                  { label: "Profit", value: "RM 53,200" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-muted/50 p-2">
                    <p className="text-[8px] text-muted-foreground">{stat.label}</p>
                    <p className="text-[11px] font-semibold tabular-nums">{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="h-20 bg-muted/30 flex items-end px-2 pb-2 gap-1">
                {[40, 55, 45, 70, 60, 80, 75, 90, 85, 95].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/40 dark:bg-primary/30"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
