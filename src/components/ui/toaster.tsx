"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import useToastStore, { type ToastVariant } from "@/store/toastStore";
import { t } from "@/lib/i18n";

const variantConfig: Record<ToastVariant, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "text-foreground" },
  success: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
  error: { icon: XCircle, className: "text-destructive" },
};

/** Fixed, bottom-right stack of transient messages. Mounted once in the layout. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      role="region"
      aria-label={t("notificationsAria")}
    >
      {toasts.map((item) => {
        const { icon: Icon, className } = variantConfig[item.variant];
        return (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            className="bg-popover ring-border pointer-events-auto flex items-start gap-2 rounded-lg p-3 text-sm shadow-lg ring-1 animate-in slide-in-from-bottom-2 fade-in-0 duration-200"
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-hidden="true" />
            <p className="min-w-0 flex-1 break-words">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label={t("dismiss")}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
