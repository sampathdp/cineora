"use client";

import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { useSite } from "@/lib/use-site";

export function ContactDetails() {
  const { site } = useSite();
  const rows = [
    { icon: MapPin, label: "Address", value: site.contact.address },
    { icon: Phone, label: "Phone", value: site.contact.phone },
    { icon: Mail, label: "Email", value: site.contact.email },
    ...(site.contact.hours ? [{ icon: Clock, label: "Hours", value: site.contact.hours }] : []),
  ];
  return (
    <ul className="mt-4 flex flex-col gap-4">
      {rows.map(({ icon: Icon, label, value }) => (
        <li key={label} className="flex gap-3 rounded-card border border-line bg-elevated p-4">
          <Icon className="mt-0.5 size-5 shrink-0 text-accent-text" aria-hidden />
          <div>
            <p className="text-sm text-muted">{label}</p>
            <p className="font-semibold">{value}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
