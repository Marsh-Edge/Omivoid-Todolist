import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { getDb, type OmivoidDatabase } from "@/db/index";
import useAppStore from "@/store/appStore";
import { t } from "@/lib/i18n";
import { FilterMenu } from "./FilterMenu";

describe("FilterMenu", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
    useAppStore.setState({ filters: {} });
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  function openMenu() {
    fireEvent.click(screen.getByRole("button", { name: t("filterButtonAria") }));
  }

  it("toggles a status filter on and off", () => {
    render(<FilterMenu />);
    openMenu();
    const done = screen.getByRole("button", { name: t("statusDone") });
    fireEvent.click(done);
    expect(useAppStore.getState().filters.status).toEqual(["done"]);
    fireEvent.click(done);
    expect(useAppStore.getState().filters.status).toBeUndefined();
  });

  it("accumulates status and priority filters", () => {
    render(<FilterMenu />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: t("statusTodo") }));
    fireEvent.click(screen.getByRole("button", { name: t("priorityHigh") }));
    const { filters } = useAppStore.getState();
    expect(filters.status).toEqual(["todo"]);
    expect(filters.priority).toEqual(["high"]);
  });

  it("clears every active filter", () => {
    useAppStore.setState({ filters: { status: ["todo"], priority: ["low"], projectId: "p1" } });
    render(<FilterMenu />);
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: t("filterClear") }));
    expect(useAppStore.getState().filters).toEqual({});
  });

  it("shows the active filter count on the trigger", () => {
    useAppStore.setState({ filters: { status: ["todo"], priority: ["low"] } });
    render(<FilterMenu />);
    expect(screen.getByText(t("filterActiveCount", { count: 2 }))).toBeTruthy();
  });
});
