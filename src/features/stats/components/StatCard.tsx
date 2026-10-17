"use client";

import { cn } from "cn";
import { t, type MessageKey } from "@/lib/i18n";

interface StatCardProps {
  labelKey: MessageKey;
  value: number;
  /** Optional suffix after the number, e.g. "%". */
  suffix?: string;
  /** Emphasize (e.g. overdue when > 0). */
  tone?: "default" | "warning";
}

/** Compact headline metric. */
export function StatCard({ labelKey, value, suffix = "", tone = "default" }: StatCardProps) {
  return (
    <div className="bg-card border-border flex flex-col gap-1 rounded-lg border px-3 py-2.5">
      <span className="text-muted-foreground text-xs">{t(labelKey)}</span>
      <span
        className={cn(
          "font-heading text-xl font-semibold tabular-nums",
          tone === "warning" && value > 0 && "text-destructive",
        )}
      >
        {value}
        {suffix}
      </span>
    </div>
  );
}
