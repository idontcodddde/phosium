import EpoxyTransport from "@mercuryworkshop/epoxy-transport";
import LibcurlTransport from "@mercuryworkshop/libcurl-transport";
import type { ProxySettings, ProxyTransport } from "./index.js";

export function createProxyTransport(settings: Pick<ProxySettings, "transport" | "wispUrl">): ProxyTransport {
  const wisp = new URL(settings.wispUrl);
  if (wisp.protocol !== "ws:" && wisp.protocol !== "wss:") {
    throw new TypeError("Wisp URL must use ws:// or wss://.");
  }

  const options = settings.transport === "libcurl"
    ? { wisp: wisp.href, websocket: wisp.href }
    : { wisp: wisp.href };
  return settings.transport === "libcurl"
    ? new LibcurlTransport(options)
    : new EpoxyTransport(options);
}
