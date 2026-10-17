/**
 * Pure, generic undo/redo stack math. Kept free of React and Dexie so the
 * apply/revert side effects live in `src/db/history.ts` and this module can be
 * exhaustively unit tested.
 *
 * The stack is bounded: recording past `maxSize` entries drops the oldest, so a
 * long editing session can't grow memory without limit.
 */

export interface HistoryStack<T> {
  /** Oldest → newest. The last entry is the next thing to undo. */
  past: T[];
  /** Newest → oldest. The first entry is the next thing to redo. */
  future: T[];
}

export const MAX_HISTORY = 100;

export function emptyStack<T>(): HistoryStack<T> {
  return { past: [], future: [] };
}

/** Records a new entry and invalidates the redo branch. */
export function pushEntry<T>(
  stack: HistoryStack<T>,
  entry: T,
  maxSize: number = MAX_HISTORY,
): HistoryStack<T> {
  const past = [...stack.past, entry];
  if (maxSize >= 0 && past.length > maxSize) {
    past.splice(0, past.length - maxSize);
  }
  return { past, future: [] };
}

export interface StackStep<T> {
  entry: T;
  stack: HistoryStack<T>;
}

/** Pops the newest past entry for undo (moving it onto the redo branch). */
export function popUndo<T>(stack: HistoryStack<T>): StackStep<T> | null {
  const entry = stack.past[stack.past.length - 1];
  if (entry === undefined) return null;
  return {
    entry,
    stack: { past: stack.past.slice(0, -1), future: [entry, ...stack.future] },
  };
}

/** Pops the newest redo entry (moving it back onto the past branch). */
export function popRedo<T>(stack: HistoryStack<T>): StackStep<T> | null {
  const [entry, ...rest] = stack.future;
  if (entry === undefined) return null;
  return {
    entry,
    stack: { past: [...stack.past, entry], future: rest },
  };
}
