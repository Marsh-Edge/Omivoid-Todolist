import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import useAppStore from "@/store/appStore";
import useThemeStore from "@/store/themeStore";
import { t } from "@/lib/i18n";
import { CommandPalette } from "./CommandPalette";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("CommandPalette", () => {
  beforeEach(() => {
    useAppStore.setState({
      paletteOpen: true,
      activeView: "inbox",
      selectedProjectId: "proj",
      searchQuery: "",
    });
    useThemeStore.setState({ mode: "light" });
  });

  // Regression: CommandDialog must wrap its children in the cmdk <Command>
  // provider. Without it every primitive reads an undefined context and the
  // whole app crashes with "Cannot read properties of undefined (reading
  // 'subscribe')" the moment the palette opens.
  it("renders command items without crashing", async () => {
    render(<CommandPalette />);
    expect(await screen.findByText(t("paletteAddTask"))).toBeTruthy();
    expect(screen.getByText(t("viewCompleted"))).toBeTruthy();
    expect(screen.getByText(t("paletteStatistics"))).toBeTruthy();
    expect(screen.queryByText(t("paletteNoResults"))).toBeNull();
  });

  it("switches view and closes when a view item is selected", async () => {
    render(<CommandPalette />);
    fireEvent.click(await screen.findByText(t("viewCompleted")));
    await waitFor(() => expect(useAppStore.getState().paletteOpen).toBe(false));
    await waitFor(() => expect(useAppStore.getState().activeView).toBe("completed"));
    expect(useAppStore.getState().selectedProjectId).toBeNull();
  });

  it("cycles the theme from its palette action", async () => {
    render(<CommandPalette />);
    fireEvent.click(await screen.findByText(t("paletteToggleTheme")));
    await waitFor(() => expect(useThemeStore.getState().mode).toBe("dark"));
  });

  it("clears the search from its palette action", async () => {
    useAppStore.setState({ searchQuery: "abc" });
    render(<CommandPalette />);
    fireEvent.click(await screen.findByText(t("paletteClearSearch")));
    await waitFor(() => expect(useAppStore.getState().searchQuery).toBe(""));
  });
});
