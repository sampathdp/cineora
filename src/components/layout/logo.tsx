import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label={`${siteConfig.name} home`} className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid size-9 place-items-center rounded-md bg-accent text-on-accent">
        <Clapperboard className="size-5" aria-hidden />
      </span>
      <span className="display text-2xl tracking-[0.12em]">{siteConfig.name}</span>
    </Link>
  );
}
