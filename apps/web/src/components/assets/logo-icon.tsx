import { cn } from "@/lib/utils";

const LogoIcon = ({ className }: { className?: string }) => {
  return (
    <img
      className={cn("h-12 w-12 object-contain hue-rotate-[-30deg]", className)}
      src="/official/logo-icon.png"
      alt="logo"
      width={500}
      height={500}
    />
  );
};

export default LogoIcon;
