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
    activeWorker.postMessage({ type: "PING_WISP_HEARTBEAT" });

    setInterval(() => {
      console.log("[Frontend] Firing scheduled heartbeat ping to SW...");
      activeWorker.postMessage({ type: "PING_WISP_HEARTBEAT" });
    }, 25000);
  }

  return serviceWorker;
}
