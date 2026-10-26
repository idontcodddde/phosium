importScripts(
  '/controller/controller.sw.js',
  '/uv/uv.bundle.js',
  '/uv/uv.config.js',
  '/uv/uv.sw.js'
);

const ultraviolet = new UVServiceWorker();

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
});

self.addEventListener('fetch', (event) => {
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
  } else if (ultraviolet.route(event)) {
    event.respondWith(ultraviolet.fetch(event));
  }
});