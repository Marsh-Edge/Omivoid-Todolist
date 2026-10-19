import { describe, expect, it } from "vitest";
import { isAllowedPermission, isAllowedRequest } from "../requestGuard";

describe("isAllowedRequest", () => {
  it("allows loopback http(s) in any form", () => {
    expect(isAllowedRequest("http://127.0.0.1:41739/_next/static/x.js")).toBe(true);
    expect(isAllowedRequest("http://localhost:41739/")).toBe(true);
    expect(isAllowedRequest("http://[::1]:41739/")).toBe(true);
    expect(isAllowedRequest("https://127.0.0.1/anything")).toBe(true);
  });

  it("cancels every request that would leave the machine", () => {
    expect(isAllowedRequest("https://example.com/")).toBe(false);
    expect(isAllowedRequest("http://127.0.0.1.evil.com/")).toBe(false);
    expect(isAllowedRequest("https://analytics.example/collect")).toBe(false);
    expect(isAllowedRequest("http://10.0.0.5/")).toBe(false);
    expect(isAllowedRequest("https://localhost.evil.com/")).toBe(false);
  });

  it("cancels websockets, which always imply a server", () => {
    expect(isAllowedRequest("ws://127.0.0.1:41739/")).toBe(false);
    expect(isAllowedRequest("wss://example.com/")).toBe(false);
  });

  it("allows non-network schemes that never hit the wire", () => {
    expect(isAllowedRequest("blob:http://127.0.0.1:41739/abc")).toBe(true);
    expect(isAllowedRequest("data:text/plain,hi")).toBe(true);
    expect(isAllowedRequest("devtools://devtools/bundled/inspector.html")).toBe(true);
  });

  it("cancels unparseable URLs", () => {
    expect(isAllowedRequest("not a url")).toBe(false);
    expect(isAllowedRequest("")).toBe(false);
  });
});

describe("isAllowedPermission", () => {
  it("grants only notifications (due-task reminders)", () => {
    expect(isAllowedPermission("notifications")).toBe(true);
  });

  it("denies every other permission", () => {
    for (const permission of [
      "media",
      "geolocation",
      "clipboard-read",
      "display-capture",
      "openExternal",
      "idle-detection",
      "hid",
      "serial",
      "usb",
    ]) {
      expect(isAllowedPermission(permission)).toBe(false);
    }
  });
});
