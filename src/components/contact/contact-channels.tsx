"use client";

import { Mail, MessageCircle, Phone } from "lucide-react";
import { siteConfig } from "@/config/site";
import { useSite } from "@/lib/use-site";
import { cn } from "@/lib/utils";

/**
 * Call / WhatsApp / Email as large tap targets. Phone and email come from the admin site settings;
 * WhatsApp from siteConfig. `tone="accent"` is for use on an orange field.
 */
export function ContactChannels({
  tone = "default",
  className,
}: {
  tone?: "default" | "accent";
  className?: string;
}) {
  const { site } = useSite();
  const { phone, email } = site.contact;
  const channels = [
    {
      icon: Phone,
      kind: "Call",
      value: phone,
      href: `tel:${phone.replace(/[^\d+]/g, "")}`,
    },
    {
      icon: MessageCircle,
      kind: "WhatsApp",
      value: siteConfig.whatsapp.label,
      href: siteConfig.whatsapp.href,
    },
    { icon: Mail, kind: "Email", value: email, href: `mailto:${email}` },
  ];

  return (
    <ul className={cn("space-y-6", className)}>
      {channels.map(({ icon: Icon, kind, value, href }) => (
        <li key={kind}>
          <a
            href={href}
            {...(href.startsWith("http")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="group flex items-center gap-4 rounded-control outline-offset-4"
          >
            <span
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-full transition-transform group-hover:scale-110",
                tone === "accent"
                  ? "bg-on-accent text-accent"
                  : "bg-accent text-on-accent",
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-sm font-semibold",
                  tone === "default" && "text-muted",
                )}
              >
                {kind}
              </span>
              <span className="block break-all text-xl font-semibold underline-offset-4 group-hover:underline sm:text-2xl">
                {value}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
