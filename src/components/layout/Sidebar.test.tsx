import type { ReactNode } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { getDb, type OmivoidDatabase } from "@/db/index";
import { createProject, getProject } from "@/db/projectRepository";
import { createTag } from "@/db/tagRepository";
import useAppStore from "@/store/appStore";
import { t } from "@/lib/i18n";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

async function flushDialogReset() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("Sidebar", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
    useAppStore.setState({ filters: {}, selectedProjectId: null, activeView: "inbox" });
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  it("renames a project through the edit dialog", async () => {
    const project = await createProject({ name: "Old name" });
    render(<Sidebar />);
    const editButton = await screen.findByRole("button", {
      name: t("editProjectAria", { name: "Old name" }),
    });
    fireEvent.click(editButton);
    await flushDialogReset();
    const input = screen.getByLabelText(t("nameLabel")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New name" } });
    fireEvent.click(screen.getByRole("button", { name: t("save") }));
    await waitFor(async () => {
      expect((await getProject(project.id))?.name).toBe("New name");
    });
  });

  it("toggles a tag filter when the tag is clicked", async () => {
    const tag = await createTag({ name: "Urgent" });
    render(<Sidebar />);
    const tagButton = await screen.findByRole("button", {
      name: t("filterByTag", { name: "Urgent" }),
    });
    fireEvent.click(tagButton);
    await waitFor(() => {
      expect(useAppStore.getState().filters.tagIds).toEqual([tag.id]);
    });
  });
});
