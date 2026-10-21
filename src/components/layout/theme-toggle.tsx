"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "System theme", icon: Monitor },
];

/** Three-way segmented theme control. */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference, mounted } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("inline-flex items-center rounded-full border border-current/25 p-0.5", className)}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "grid size-8 place-items-center rounded-full transition",
              active ? "bg-accent text-on-accent" : "opacity-70 hover:opacity-100",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
