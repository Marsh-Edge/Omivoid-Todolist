import { describe, it, expect } from "vitest";
import {
  MAX_HISTORY,
  emptyStack,
  popRedo,
  popUndo,
  pushEntry,
  type HistoryStack,
} from "../undoStack";

describe("pushEntry", () => {
  it("appends to past and clears the redo branch", () => {
    const stack: HistoryStack<string> = { past: ["a"], future: ["x", "y"] };
    expect(pushEntry(stack, "b")).toEqual({ past: ["a", "b"], future: [] });
  });

  it("drops the oldest entries past the cap", () => {
    let stack: HistoryStack<number> = { past: [1, 2], future: [] };
    stack = pushEntry(stack, 3, 3);
    expect(stack).toEqual({ past: [1, 2, 3], future: [] });
    stack = pushEntry(stack, 4, 2);
    expect(stack).toEqual({ past: [3, 4], future: [] });
  });

  it("does not mutate the input stack", () => {
    const stack: HistoryStack<string> = { past: ["a"], future: [] };
    pushEntry(stack, "b");
    expect(stack).toEqual({ past: ["a"], future: [] });
  });

  it("keeps everything with an unbounded cap", () => {
    let stack = emptyStack<number>();
    for (let i = 0; i < MAX_HISTORY + 5; i += 1) stack = pushEntry(stack, i, -1);
    expect(stack.past).toHaveLength(MAX_HISTORY + 5);
  });
});

describe("popUndo", () => {
  it("returns null on an empty past", () => {
    expect(popUndo(emptyStack<string>())).toBeNull();
  });

  it("moves the newest entry onto the redo branch", () => {
    const step = popUndo({ past: ["a", "b"], future: [] });
    expect(step?.entry).toBe("b");
    expect(step?.stack).toEqual({ past: ["a"], future: ["b"] });
  });

  it("prepends to an existing future", () => {
    const step = popUndo({ past: ["a", "b"], future: ["c"] });
    expect(step?.stack.future).toEqual(["b", "c"]);
  });
});

describe("popRedo", () => {
  it("returns null on an empty future", () => {
    expect(popRedo(emptyStack<string>())).toBeNull();
  });

  it("moves the front entry back onto the past branch", () => {
    const step = popRedo({ past: ["a"], future: ["b", "c"] });
    expect(step?.entry).toBe("b");
    expect(step?.stack).toEqual({ past: ["a", "b"], future: ["c"] });
  });
});

describe("undo/redo round-trip", () => {
  it("returns to the original stack after undo then redo", () => {
    const start: HistoryStack<string> = { past: ["a", "b", "c"], future: [] };
    const undone = popUndo(start);
    expect(undone).not.toBeNull();
    const redone = popRedo(undone!.stack);
    expect(redone?.entry).toBe("c");
    expect(redone?.stack).toEqual(start);
  });
});
