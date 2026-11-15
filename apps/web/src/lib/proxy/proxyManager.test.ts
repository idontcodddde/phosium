import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyManager } from "../../../../../packages/proxy/src/settings.js";

const storage = new Map<string, string>();

function installBrowserGlobals() {
  vi.stubGlobal("window", {
    location: {
      protocol: "https:",
      host: "phosium.example",
    },
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
}

describe("proxyManager", () => {
  beforeEach(() => {
    storage.clear();
    installBrowserGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses safe defaults for missing and invalid saved settings", () => {
    expect(proxyManager.getSettings()).toEqual({
      enabled: true,
      engine: "scramjet",
      transport: "epoxy",
      wispUrl: "wss://phosium.example/wisp/",
    });

    storage.set("proxy_engine", "unknown");
    storage.set("proxy_transport", "unknown");
    storage.set("system_proxy", "false");

    expect(proxyManager.getSettings()).toEqual({
      enabled: false,
      engine: "scramjet",
      transport: "epoxy",
      wispUrl: "wss://phosium.example/wisp/",
    });
  });

  it("persists only supplied proxy settings", () => {
    proxyManager.setSettings({
      enabled: false,
      engine: "ultraviolet",
      transport: "libcurl",
      wispUrl: "wss://edge.example/wisp/",
    });

    expect([...storage.entries()]).toEqual([
      ["system_proxy", "false"],
      ["proxy_engine", "ultraviolet"],
      ["proxy_transport", "libcurl"],
      ["wisp_url", "wss://edge.example/wisp/"],
    ]);
  });

  it("returns direct Scramjet URLs and encoded UV routes", () => {
    const target = "https://example.com/path?q=one#section";

    expect(proxyManager.getProxiedUrl(target, "scramjet")).toBe(target);
    expect(proxyManager.getProxiedUrl(target, "ultraviolet")).toBe(
      `/uv/service/${encodeURIComponent(target)}`,
    );
    expect(proxyManager.getProxiedUrl("example.com", "ultraviolet")).toBe(
      `/uv/service/${encodeURIComponent("https://example.com/")}`,
    );
  });

  it("rejects non-HTTP target URLs", () => {
    expect(() => proxyManager.getProxiedUrl("javascript://alert(1)", "ultraviolet"))
      .toThrow("Only HTTP and HTTPS addresses are supported.");
  });
});
