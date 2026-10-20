import type { SearchEngine } from "../../SystemContext";

const searchUrl: Record<SearchEngine, (query: string) => string> = {
  google: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  duckduckgo: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  bing: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  brave: (query) => `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
};

const hostPattern = /^(?:localhost(?::\d+)?|(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?|(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}(?::\d+)?)(?:[/?#][^\s]*)?$/i;

export function resolveAddress(input: string, engine: SearchEngine): string {
  const trimmed = input.trim();
  if (!trimmed) throw new TypeError("Enter a web address.");

  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) {
    const explicitUrl = new URL(trimmed);
    if (explicitUrl.protocol !== "http:" && explicitUrl.protocol !== "https:") {
      throw new TypeError("Only HTTP and HTTPS addresses are supported.");
    }
    return explicitUrl.href;
  }

  const isIpv6Address = trimmed.includes(":") && (() => {
    try {
      return new URL(`https://[${trimmed}]`).hostname !== "";
    } catch {
      return false;
    }
  })();
  if (!hostPattern.test(trimmed) && !isIpv6Address) return searchUrl[engine](trimmed);

  const target = new URL(`https://${trimmed}`);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new TypeError("Only HTTP and HTTPS addresses are supported.");
  }
  return target.href;
}
