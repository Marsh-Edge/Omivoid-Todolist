"use client";

import { Check } from "lucide-react";
import { cn } from "cn";
import { PRESET_COLORS } from "@/lib/colors";

/**
 * Compact preset color picker. `""` is the "default" option (theme fallback).
 * Rendered as toggle buttons so it works with keyboard and screen readers.
 */
export function ColorSwatches({
  value,
  onChange,
  ariaLabel,
  defaultLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  defaultLabel: string;
  className?: string;
}) {
  const options = ["", ...PRESET_COLORS];
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((color) => {
        const selected = (value || "") === color;
        const label = color || defaultLabel;
        return (
          <button
            key={color || "default"}
            type="button"
            onClick={() => onChange(color)}
            aria-pressed={selected}
            aria-label={label}
            title={label}
            className={cn(
              "flex size-5 items-center justify-center rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              !color && "border-dashed bg-muted",
              selected &&
                "ring-2 ring-ring ring-offset-1 ring-offset-background",
            )}
            style={color ? { backgroundColor: color } : undefined}
          >
            {selected ? (
              <Check
                className={cn(
                  "size-3",
                  color ? "text-white" : "text-muted-foreground",
                )}
                aria-hidden="true"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
