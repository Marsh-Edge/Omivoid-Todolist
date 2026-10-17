import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { getDb, type OmivoidDatabase } from "@/db/index";
import { listSavedFilters } from "@/db/savedFilterRepository";
import useAppStore from "@/store/appStore";
import { t } from "@/lib/i18n";
import { SavedFilterMenu } from "./SavedFilterMenu";

describe("SavedFilterMenu", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
    useAppStore.setState({ filters: { priority: ["high"] } });
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  function openMenu() {
    fireEvent.click(screen.getByRole("button", { name: t("savedFiltersButtonAria") }));
  }

  it("saves the current filters under a name", async () => {
    render(<SavedFilterMenu />);
    openMenu();
    fireEvent.change(screen.getByLabelText(t("savedFilterNamePlaceholder")), {
      target: { value: "High priority" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("savedFilterSave") }));
    await waitFor(async () => {
      const saved = await listSavedFilters();
      expect(saved).toHaveLength(1);
      expect(saved[0]?.name).toBe("High priority");
      expect(saved[0]?.filters).toEqual({ priority: ["high"] });
    });
  });

  it("requires a name before saving", async () => {
    render(<SavedFilterMenu />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: t("savedFilterSave") }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(await listSavedFilters()).toHaveLength(0);
  });

  it("applies and deletes a saved filter", async () => {
    render(<SavedFilterMenu />);
    openMenu();
    fireEvent.change(screen.getByLabelText(t("savedFilterNamePlaceholder")), {
      target: { value: "High" },
    });
    fireEvent.click(screen.getByRole("button", { name: t("savedFilterSave") }));
    const applyButton = await screen.findByRole("button", {
      name: t("savedFilterApply", { name: "High" }),
    });

    useAppStore.setState({ filters: {} });
    fireEvent.click(applyButton);
    expect(useAppStore.getState().filters).toEqual({ priority: ["high"] });

    // Applying closes the menu; reopen it to delete.
    openMenu();
    fireEvent.click(
      await screen.findByRole("button", { name: t("savedFilterDelete", { name: "High" }) }),
    );
    await waitFor(async () => {
      expect(await listSavedFilters()).toHaveLength(0);
    });
  });
});
