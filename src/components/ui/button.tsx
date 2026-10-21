import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "onDark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold tracking-wide transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-[0_8px_24px_-10px_var(--accent)]",
  secondary: "border border-line bg-elevated text-foreground hover:border-accent hover:text-accent-text",
  ghost: "text-foreground hover:bg-surface",
  onDark: "border border-white/40 bg-white/5 text-white backdrop-blur hover:bg-white/15",
};

const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3.5 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: CommonProps & { href: string; "aria-label"?: string }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Button({
  variant,
  size,
  className,
  children,
  type = "button",
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}
