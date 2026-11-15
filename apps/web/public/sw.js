importScripts(
  "/controller/controller.sw.js",
  "/uv/uv.bundle.js",
  "/uv/uv.config.js",
  "/uv/uv.sw.js",
);

const ultraviolet = new UVServiceWorker();

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "PING_WISP_HEARTBEAT") {
    console.log("[Heartbeat] Core worker pipeline awakened successfully.");
  }
});

self.addEventListener("fetch", (event) => {
  if (typeof $scramjetController !== "undefined" && $scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
  } else if (ultraviolet.route(event)) {
    event.respondWith(ultraviolet.fetch(event));
  }
});
