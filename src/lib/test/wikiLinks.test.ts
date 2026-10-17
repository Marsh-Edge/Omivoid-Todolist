import { describe, it, expect } from "vitest";
import {
  extractWikiLinks,
  findBacklinks,
  normalizeTitle,
  replaceWikiLinks,
  taskIdFromHref,
  TASK_LINK_PREFIX,
  type BacklinkSource,
} from "../wikiLinks";

describe("normalizeTitle", () => {
  it("trims and lowercases", () => {
    expect(normalizeTitle("  Buy Milk ")).toBe("buy milk");
  });
});

describe("extractWikiLinks", () => {
  it("extracts unique targets in order, preserving casing", () => {
    const notes = "See [[Buy Milk]] and [[Ship It]]. Then [[buy milk]] again.";
    expect(extractWikiLinks(notes)).toEqual(["Buy Milk", "Ship It"]);
  });

  it("ignores empty and malformed brackets", () => {
    expect(extractWikiLinks("[[ ]] [[a[b]] plain [x]")).toEqual([]);
  });

  it("returns nothing when there are no links", () => {
    expect(extractWikiLinks("just some notes")).toEqual([]);
  });
});

describe("replaceWikiLinks", () => {
  const resolve = (title: string) => (title.toLowerCase() === "buy milk" ? "id-1" : null);

  it("rewrites resolvable links into internal markdown links", () => {
    const result = replaceWikiLinks("See [[Buy Milk]].", resolve);
    expect(result).toBe(`See [Buy Milk](${TASK_LINK_PREFIX}id-1).`);
  });

  it("leaves unresolved links verbatim", () => {
    const result = replaceWikiLinks("See [[Nope]].", resolve);
    expect(result).toBe("See [[Nope]].");
  });
});

describe("taskIdFromHref", () => {
  it("decodes the target id", () => {
    expect(taskIdFromHref(`${TASK_LINK_PREFIX}abc-123`)).toBe("abc-123");
  });

  it("returns null for external or missing hrefs", () => {
    expect(taskIdFromHref("https://example.com")).toBeNull();
    expect(taskIdFromHref(undefined)).toBeNull();
  });
});

describe("findBacklinks", () => {
  const tasks: BacklinkSource[] = [
    { id: "a", title: "Buy Milk", notes: "" },
    { id: "b", title: "Groceries", notes: "Remember [[Buy milk]] on the way" },
    { id: "c", title: "Other", notes: "No links here" },
    { id: "d", title: "Shopping", notes: "Also [[Buy Milk]]" },
  ];

  it("finds tasks that reference the title, case-insensitively", () => {
    expect(findBacklinks(tasks, "Buy Milk").map((t) => t.id)).toEqual(["b", "d"]);
  });

  it("returns empty for a blank or unmatched title", () => {
    expect(findBacklinks(tasks, "   ")).toEqual([]);
    expect(findBacklinks(tasks, "Missing")).toEqual([]);
  });
});
