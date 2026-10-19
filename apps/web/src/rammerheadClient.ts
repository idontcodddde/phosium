type RammerheadEncoder = (targetUrl: string, prefix?: string) => Promise<string>;

let rammerheadLoader: Promise<RammerheadEncoder> | null = null;

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
