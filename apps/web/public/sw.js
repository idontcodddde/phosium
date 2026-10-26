self.skipWaiting();
importScripts(
  '/controller/controller.sw.js',
  '/uv/uv.bundle.js',
  '/uv/uv.config.js',
  '/uv/uv.sw.js'
);

const ultraviolet = new UVServiceWorker();

// Force the waiting worker to become the active worker immediately without features losing control
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Ensures the page hooks into messaging immediately on first load
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listen for messages from the frontend to dynamically update Wisp endpoints for all engines
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'UPDATE_WISP') {
    const newWispUrl = event.data.wispUrl;

    // 1. Update Ultraviolet config if defined
    if (typeof __uv$config !== 'undefined') {
      __uv$config.wisp = newWispUrl;
    }

    // 2. Update Scramjet controller wisp setting if applicable
    if (typeof $scramjetController !== 'undefined' && typeof $scramjetController.setWisp === 'function') {
      $scramjetController.setWisp(newWispUrl);
    } else if (typeof $scramjetController !== 'undefined') {
      $scramjetController.wisp = newWispUrl;
    }
  }
  
  if (event.data && event.data.type === 'PING_WISP_HEARTBEAT') {
    console.log('[Heartbeat] Core worker pipeline awakened successfully.');
  }
});

self.addEventListener('fetch', (event) => {
  if (typeof $scramjetController !== 'undefined' && $scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
  } else if (ultraviolet.route(event)) {
    event.respondWith(ultraviolet.fetch(event));
  }
});
