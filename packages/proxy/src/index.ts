export { createProxyTransport } from "./transports.js";
import type { BareCompatibleClient } from "@mercuryworkshop/proxy-transports";
export type ProxyTransport = BareCompatibleClient["transport"];
export {
  proxyConfig,
  proxyManager,
  type ProxyEngineType,
  type ProxySettings,
  type ProxyTransportType,
  type ProxyUrlEngineType,
} from "./settings.js";
