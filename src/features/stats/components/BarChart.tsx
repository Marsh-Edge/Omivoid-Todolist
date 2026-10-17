"use client";

export interface Bar {
  key: string;
  value: number;
  /** Short x-axis label (shown for a few ticks only). */
  label: string;
  /** Full label for the hover title / screen readers. */
  title: string;
}

interface BarChartProps {
  bars: readonly Bar[];
  ariaLabel: string;
  emptyLabel: string;
}

/**
 * Hand-rolled vertical bar chart (no chart dependency). Bars are proportional
 * to the max value; each carries a `title` for hover, and the container exposes
 * a single `role="img"` with a text summary for assistive tech. X-axis labels
 * are thinned to first / middle / last to avoid clutter over long ranges.
 */
export function BarChart({ bars, ariaLabel, emptyLabel }: BarChartProps) {
  if (bars.length === 0) {
    return <p className="text-muted-foreground py-8 text-center text-sm">{emptyLabel}</p>;
  }

  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  const labelIndexes = new Set([0, Math.floor((bars.length - 1) / 2), bars.length - 1]);

  return (
    <div className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`${ariaLabel}. ${total}.`}
        className="flex h-40 items-end gap-px"
      >
        {bars.map((bar, index) => {
          const pct = (bar.value / max) * 100;
          return (
            <div
              key={bar.key}
              title={bar.title}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end"
            >
              {bar.value > 0 ? (
                <div
                  className="bg-primary/70 group-hover:bg-primary w-full rounded-t-sm transition-colors"
                  style={{ height: `${Math.max(4, pct)}%` }}
                />
              ) : (
                <div className="bg-border w-full" style={{ height: "1px" }} />
              )}
              <span className="sr-only">{bar.title}</span>
              {labelIndexes.has(index) ? (
                <span className="text-muted-foreground mt-1 hidden text-[10px] tabular-nums sm:block">
                  {bar.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
