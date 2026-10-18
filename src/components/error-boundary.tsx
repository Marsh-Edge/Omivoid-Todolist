"use client";

import { Component, type ReactNode } from "react";
import { t } from "@/lib/i18n";

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-2 p-4 text-center">
          <h1 className="text-lg font-semibold">{t("errorBoundaryTitle")}</h1>
          <p className="text-muted-foreground text-sm">{t("errorBoundaryBody")}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
