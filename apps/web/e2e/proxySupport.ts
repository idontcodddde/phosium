import { performance } from "node:perf_hooks";
import { expect, type Page } from "@playwright/test";
import type { ProxyTransportType } from "@repo/proxy";

export type ProxyEngine = "scramjet" | "ultraviolet";

export interface DOMContentLoadedResult {
  durationMs: number;
  error?: string;
}

export async function openProxyApp(
  page: Page,
  engine: ProxyEngine,
  transport: ProxyTransportType = "epoxy",
): Promise<void> {
  await page.addInitScript(({ proxyEngine, transportType }) => {
    localStorage.setItem("phosium_alpha_disclaimer_acknowledged", "true");
    localStorage.setItem("system_proxy", "true");
    localStorage.setItem("proxy_engine", proxyEngine);
    localStorage.setItem("proxy_transport", transportType);
    const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
    localStorage.setItem("wisp_url", `${wsProtocol}//${location.host}/wisp/`);
  }, { proxyEngine: engine, transportType: transport });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const engineName = engine === "scramjet" ? "Scramjet" : "Ultraviolet";
  await expect(page.getByText(`${engineName} ready · ${transport}`, { exact: false }))
    .toContainText(`${engineName} ready · ${transport}`, { timeout: 90_000 });
  await page.locator("iframe.chrome-page-frame").first().waitFor({ state: "attached" });
}

export async function measureDOMContentLoaded(
  page: Page,
  navigate: () => Promise<void>,
  timeoutMs: number,
): Promise<DOMContentLoadedResult> {
  const startedAt = performance.now();
  try {
    const iframe = await page.locator("iframe.chrome-page-frame").first().elementHandle();
    const frame = await iframe?.contentFrame();
    if (!frame) throw new Error("The browser tab has no content frame.");
    const domContentLoaded = frame.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await navigate();
    await domContentLoaded;
    return { durationMs: performance.now() - startedAt };
  } catch (error) {
    return {
      durationMs: performance.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function navigateFromAddressBar(page: Page, url: string): Promise<void> {
  const address = page.getByRole("textbox", { name: "Address and search bar" });
  await address.fill(url);
  await address.press("Enter");
}

export async function replaceActiveTab(page: Page): Promise<void> {
  await page.locator(".chrome-tab-close").click();
  await page.locator("iframe.chrome-page-frame").waitFor({ state: "attached" });
}
