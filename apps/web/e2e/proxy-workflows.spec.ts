import { expect, test } from "@playwright/test";
import {
  measureDOMContentLoaded,
  navigateFromAddressBar,
  openProxyApp,
} from "./proxySupport";

test("Scramjet loads a page through the Dedicated Worker transport", async ({ page }) => {
  test.setTimeout(150_000);
  await openProxyApp(page, "scramjet");

  const result = await measureDOMContentLoaded(
    page,
    () => navigateFromAddressBar(page, "https://example.com/"),
    60_000,
  );

  expect(result.error, result.error).toBeUndefined();
  expect(result.durationMs).toBeGreaterThan(0);
});

test("Ultraviolet loads a page through the worker-backed BareMux adapter", async ({ page }) => {
  test.setTimeout(150_000);
  await openProxyApp(page, "ultraviolet");

  const result = await measureDOMContentLoaded(
    page,
    () => navigateFromAddressBar(page, "https://example.com/"),
    60_000,
  );

  expect(result.error, result.error).toBeUndefined();
  expect(result.durationMs).toBeGreaterThan(0);
});

for (const engine of ["scramjet", "ultraviolet"] as const) {
  test(`${engine} loads YouTube through Libcurl`, async ({ page }) => {
    test.setTimeout(180_000);
    await openProxyApp(page, engine, "libcurl");

    const result = await measureDOMContentLoaded(
      page,
      () => navigateFromAddressBar(page, "https://www.youtube.com/"),
      90_000,
    );

    expect(result.error, result.error).toBeUndefined();
    const frame = await page.locator("iframe.chrome-page-frame").first().elementHandle()
      .then((iframe) => iframe?.contentFrame());
    if (!frame) throw new Error("The browser tab has no content frame.");
    await expect(frame.locator("body")).not.toContainText("Internal Service Worker Error");
  });
}
