import EpoxyTransport from "@mercuryworkshop/epoxy-transport";
import LibcurlTransport from "@mercuryworkshop/libcurl-transport";
import type { ProxySettings } from "@repo/proxy";

export function createTransport(settings: ProxySettings) {
  const wisp = new URL(settings.wispUrl);
  if (wisp.protocol !== "ws:" && wisp.protocol !== "wss:") {
    throw new TypeError("Wisp URL must use ws:// or wss://.");
  }
  if (settings.transport === "libcurl") {
    return new LibcurlTransport({ wisp: wisp.href, websocket: wisp.href });
  }
  return new EpoxyTransport({ wisp: wisp.href });
}

export async function registerSystemWorker(): Promise<ServiceWorker> {
  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
  console.log("SW registered:", registration.scope);

  const readyRegistration = await navigator.serviceWorker.ready;

  // Kept your fallback chain intact but added readyRegistration.active priority for immediate messaging
  const serviceWorker = readyRegistration.active ??
    [
      navigator.serviceWorker.controller,
      readyRegistration.active,
    ].find((worker) => worker?.state === "activated") ??
    readyRegistration.active ??
    navigator.serviceWorker.controller;

  if (!serviceWorker) {
    throw new Error("Service Worker registration has no active worker.");
  }

  if (serviceWorker.state === "redundant") {
    throw new Error("Service Worker became redundant before activation.");
  }

  if (serviceWorker.state !== "activated") {
    await new Promise<void>((resolve, reject) => {
      const handleStateChange = () => {
        if (serviceWorker.state === "activated") {
          serviceWorker.removeEventListener("statechange", handleStateChange);
          resolve();
        } else if (serviceWorker.state === "redundant") {
          serviceWorker.removeEventListener("statechange", handleStateChange);
          reject(
            new Error("Service Worker became redundant before activation."),
          );
        }
      };
      serviceWorker.addEventListener("statechange", handleStateChange);
      handleStateChange();
    });
  }

  const activeWorker = serviceWorker;
  if (activeWorker) {
    console.log("[Frontend] Initializing heartbeat loop...");
    // Fires once instantly so you don't have to wait 25 seconds to verify it works
    activeWorker.postMessage({ type: "PING_WISP_HEARTBEAT" });

    setInterval(() => {
      console.log("[Frontend] Firing scheduled heartbeat ping to SW...");
      activeWorker.postMessage({ type: "PING_WISP_HEARTBEAT" });
    }, 25000);
  }

  return serviceWorker;
}
