import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDb, type OmivoidDatabase } from "@/db/index";
import { createTask, setTaskCompleted } from "@/db/taskRepository";
import useAppStore from "@/store/appStore";
import { t } from "@/lib/i18n";
import { TaskList } from "./TaskList";

// The virtualizer relies on a sized scroll element, which jsdom does not provide.
// Render every item instead so row content can be asserted.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 44,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 44,
        size: 44,
      })),
  }),
}));

describe("TaskList", () => {
  let db: OmivoidDatabase;

  beforeEach(async () => {
    db = getDb();
    await db.delete();
    await db.open();
    useAppStore.setState({
      activeView: "inbox",
      selectedProjectId: null,
      searchQuery: "",
      filters: {},
      sortBy: "order",
      sortDir: "asc",
      groupBy: "none",
      viewMode: "list",
      expandedTaskIds: new Set<string>(),
    });
  });

  afterEach(async () => {
    if (db.isOpen()) await db.close();
  });

  it("renders a row for each inbox task", async () => {
    await createTask({ title: "Buy milk" });
    await createTask({ title: "Walk dog" });
    render(<TaskList />);
    expect(await screen.findByText("Buy milk")).toBeTruthy();
    expect(screen.getByText("Walk dog")).toBeTruthy();
  });

  it("shows the inbox empty state when there are no tasks", async () => {
    render(<TaskList />);
    expect(await screen.findByText(t("emptyViewInbox"))).toBeTruthy();
  });

  it("renders subtask rows when the parent is expanded", async () => {
    const parent = await createTask({ title: "Parent task" });
    await createTask({ title: "Child task", parentId: parent.id });
    useAppStore.setState({ expandedTaskIds: new Set<string>([parent.id]) });
    render(<TaskList />);
    expect(await screen.findByText("Parent task")).toBeTruthy();
    expect(await screen.findByText("Child task")).toBeTruthy();
  });

  it("renders finished subtasks in the Completed view", async () => {
    const parent = await createTask({ title: "Parent done" });
    const child = await createTask({ title: "Child done", parentId: parent.id });
    await setTaskCompleted(parent.id, true);
    await setTaskCompleted(child.id, true);
    useAppStore.setState({ activeView: "completed" });
    render(<TaskList />);
    expect(await screen.findByText("Parent done")).toBeTruthy();
    expect(screen.getByText("Child done")).toBeTruthy();
  });

  it("keeps the Completed view flat — an expanded done parent never duplicates its child", async () => {
    const parent = await createTask({ title: "Parent flat" });
    const child = await createTask({ title: "Child flat", parentId: parent.id });
    await setTaskCompleted(parent.id, true);
    await setTaskCompleted(child.id, true);
    useAppStore.setState({
      activeView: "completed",
      expandedTaskIds: new Set<string>([parent.id]),
    });
    render(<TaskList />);
    expect(await screen.findByText("Child flat")).toBeTruthy();
    expect(screen.getAllByText("Child flat")).toHaveLength(1);
    expect(screen.getAllByText("Parent flat")).toHaveLength(1);
  });
});
