"use client";

import dynamic from "next/dynamic";
import { t } from "@/lib/i18n";

// The dashboard (and every chart) is its own route chunk, so none of it enters
// the initial task-view bundle.
const StatsView = dynamic(() => import("@/features/stats/components/StatsView"), {
  ssr: false,
  loading: () => <div className="text-muted-foreground text-sm">{t("loadingTasks")}</div>,
});

export default function StatsPage() {
  return <StatsView />;
}
