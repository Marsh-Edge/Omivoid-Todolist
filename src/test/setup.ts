import "fake-indexeddb/auto";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom lacks browser APIs used by Radix UI and @tanstack/react-virtual.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof window.matchMedia === "undefined") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (typeof Element.prototype.scrollIntoView === "undefined") {
  Element.prototype.scrollIntoView = () => {};
}

if (typeof Element.prototype.hasPointerCapture === "undefined") {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = () => "blob:vitest";
  URL.revokeObjectURL = () => {};
}

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
