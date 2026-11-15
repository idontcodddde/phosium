import { expect, test } from "@playwright/test";
import {
  measureDOMContentLoaded,
  navigateFromAddressBar,
  openProxyApp,
  replaceActiveTab,
  type DOMContentLoadedResult,
} from "./proxySupport";

const defaultSites = [
  "https://discord.com/app",
  "https://www.wikipedia.org/",
  "https://www.mozilla.org/",
  "https://github.com/",
  "https://example.com/",
  "https://youtube.com/",
];

function readPositiveInteger(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
  return value;
}

function getSites(): string[] {
  const rawSites = process.env.SITE_BENCHMARK_SITES;
  const sites = (rawSites ? rawSites.split(",") : defaultSites)
    .map((site) => site.trim())
    .filter(Boolean);
  if (sites.length === 0) throw new TypeError("SITE_BENCHMARK_SITES must include at least one URL.");
  for (const site of sites) {
    const url = new URL(site);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new TypeError(`Benchmark URL must use HTTP or HTTPS: ${site}`);
    }
  }
  return sites;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

test("worker-backed public-site DOMContentLoaded benchmark @benchmark", async ({ page }, testInfo) => {
  const sites = getSites();
  const runsPerSite = readPositiveInteger("SITE_BENCHMARK_RUNS", 5);
  const timeoutMs = readPositiveInteger("SITE_BENCHMARK_TIMEOUT_MS", 45_000);
  test.setTimeout(Math.max(120_000, sites.length * runsPerSite * timeoutMs + 60_000));

  await openProxyApp(page, "scramjet", "epoxy");
  const runs: Array<{
    site: string;
    run: number;
    durationMs: number;
    status: "loaded" | "failed";
    error?: string;
  }> = [];
  const resultsBySite = new Map<string, DOMContentLoadedResult[]>();

  for (const site of sites) {
    const siteRuns: DOMContentLoadedResult[] = [];
    for (let run = 1; run <= runsPerSite; run += 1) {
      if (run > 1) await replaceActiveTab(page);
      const result = await measureDOMContentLoaded(
        page,
        () => navigateFromAddressBar(page, site),
        timeoutMs,
      );
      siteRuns.push(result);
      runs.push({
        site,
        run,
        durationMs: Math.round(result.durationMs * 100) / 100,
        status: result.error ? "failed" : "loaded",
        ...(result.error ? { error: result.error } : {}),
      });
    }
    resultsBySite.set(site, siteRuns);
  }

  const summary = sites.map((site) => {
    const siteRuns = resultsBySite.get(site) ?? [];
    const successfulRuns = siteRuns
      .filter((run) => !run.error)
      .map((run) => run.durationMs);
    return {
      site,
      successes: successfulRuns.length,
      failures: siteRuns.length - successfulRuns.length,
      meanMs: successfulRuns.length
        ? Number((successfulRuns.reduce((total, duration) => total + duration, 0)
          / successfulRuns.length).toFixed(2))
        : null,
      medianMs: successfulRuns.length ? Number(median(successfulRuns).toFixed(2)) : null,
      minMs: successfulRuns.length ? Number(Math.min(...successfulRuns).toFixed(2)) : null,
      maxMs: successfulRuns.length ? Number(Math.max(...successfulRuns).toFixed(2)) : null,
    };
  });
  const report = {
    engine: "scramjet",
    transport: "epoxy",
    timingMetric: "domcontentloaded",
    appUrl: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    timeoutMs,
    runsPerSite,
    rawRuns: runs,
    summary,
  };
  const reportJson = JSON.stringify(report, null, 2);

  await testInfo.attach("worker-site-benchmark.json", {
    body: Buffer.from(reportJson),
    contentType: "application/json",
  });
  console.log(`Worker-backed site benchmark:\n${reportJson}`);
  expect(runs).toHaveLength(sites.length * runsPerSite);
});
