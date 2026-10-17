"use client";

export interface BarListRow {
  key: string;
  label: string;
  value: number;
  /** Fill color; falls back to the primary token when empty. */
  color?: string;
}

interface BarListProps {
  rows: readonly BarListRow[];
  ariaLabel: string;
  emptyLabel: string;
}

/**
 * Hand-rolled horizontal bar list for category breakdowns (status, priority,
 * projects). Width is relative to the largest value; the numeric value is always
 * shown next to the label so the chart is readable without color alone.
 */
export function BarList({ rows, ariaLabel, emptyLabel }: BarListProps) {
  const visible = rows.filter((row) => row.value > 0);
  if (visible.length === 0) {
    return <p className="text-muted-foreground py-6 text-center text-sm">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...visible.map((row) => row.value));

  return (
    <ul aria-label={ariaLabel} className="flex flex-col gap-2">
      {visible.map((row) => (
        <li key={row.key} className="flex items-center gap-2 text-sm">
          <span className="w-28 shrink-0 truncate" title={row.label}>
            {row.label}
          </span>
          <span className="bg-muted h-2.5 min-w-0 flex-1 overflow-hidden rounded-full">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${(row.value / max) * 100}%`,
                backgroundColor: row.color || "var(--primary)",
              }}
            />
          </span>
          <span className="w-8 shrink-0 text-right tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}
