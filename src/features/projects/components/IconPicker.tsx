"use client";

import { Ban, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { PROJECT_ICONS } from "@/lib/projectIcons";

const ICON_OPTIONS: ReadonlyArray<{ name: string; Icon: LucideIcon }> = [
  { name: "", Icon: Ban },
  ...PROJECT_ICONS,
];

/**
 * Small, keyboard-accessible picker over the curated project icon allowlist.
 * The empty value ("") renders the "no icon" option.
 */
export function IconPicker({
  value,
  onChange,
  ariaLabel,
  noneLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  noneLabel: string;
}) {
  const selected = value || "";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="grid grid-cols-6 gap-1.5"
    >
      {ICON_OPTIONS.map(({ name, Icon }) => {
        const isSelected = selected === name;
        const label = name || noneLabel;
        return (
          <button
            key={name || "none"}
            type="button"
            onClick={() => onChange(name)}
            aria-pressed={isSelected}
            aria-label={label}
            title={label}
            className={cn(
              "flex size-7 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected && "bg-accent text-foreground ring-1 ring-ring",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
