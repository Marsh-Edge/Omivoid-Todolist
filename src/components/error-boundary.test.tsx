import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { t } from "@/lib/i18n";
import { ErrorBoundary } from "./error-boundary";

function Boom(): React.ReactNode {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("shows a friendly fallback with a reload button when a child throws", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText(t("errorBoundaryTitle"))).toBeTruthy();
    expect(screen.getByText(t("errorBoundaryBody"))).toBeTruthy();
    expect(screen.getByRole("button", { name: t("errorBoundaryReload") })).toBeTruthy();
    consoleError.mockRestore();
  });

  it("renders children when nothing has thrown", () => {
    render(
      <ErrorBoundary>
        <div>content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("content")).toBeTruthy();
  });
});
