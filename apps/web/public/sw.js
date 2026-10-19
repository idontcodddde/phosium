importScripts(
  '/controller/controller.sw.js',
  '/uv/uv.bundle.js',
  '/uv/uv.config.js',
  '/uv/uv.sw.js'
);

const ultraviolet = new UVServiceWorker();

self.addEventListener('fetch', (event) => {
  if ($scramjetController.shouldRoute(event)) {
    event.respondWith($scramjetController.route(event));
  } else if (ultraviolet.route(event)) {
    event.respondWith(ultraviolet.fetch(event));
  }
});