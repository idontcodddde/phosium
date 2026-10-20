type RammerheadEncoder = (targetUrl: string, prefix?: string) => Promise<string>;

export interface RammerheadParsedUrl {
  destUrl?: string;
}

export type RammerheadUrlParser = (url: string) => RammerheadParsedUrl | null | undefined;

let rammerheadLoader: Promise<RammerheadEncoder> | null = null;

export function decodeRammerheadUrl(
  proxyUrl: string,
  parseProxyUrl: RammerheadUrlParser | undefined,
  parserContext?: object,
): string | null {
  if (!parseProxyUrl) return null;

  try {
    const destination = parseProxyUrl.call(parserContext, proxyUrl)?.destUrl;
    if (!destination) return null;

    const url = new URL(destination);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function isRammerheadProxyUrl(rawUrl: string): boolean {
  try {
    const { pathname } = new URL(rawUrl, window.location.href);
    return /^\/[a-f\d]{32}(?:!|\/)/i.test(pathname)
      && pathname.includes("/_rhsm")
      && pathname.includes("://");
  } catch {
    return false;
  }
}

export async function encodeRammerheadUrl(targetUrl: string): Promise<string> {
  rammerheadLoader ??= import("@rubynetwork/rammerhead-browser")
    .then((module) => module.RammerheadEncode);
  const encode = await rammerheadLoader;
  // Rammerhead's injected client reads its session ID from the first path segment.
  const proxyUrl = await encode(targetUrl);
  const absoluteProxyUrl = proxyUrl.startsWith("/") ? proxyUrl : `/${proxyUrl}`;
  if (!/^\/[a-z0-9]{32}(?:\/|$)/i.test(absoluteProxyUrl)) {
    throw new Error("Rammerhead returned an invalid proxied URL.");
  }
  return absoluteProxyUrl;
}
