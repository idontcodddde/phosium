import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

const rammerheadRootRoutes = new Set([
  "/rammerhead.js",
  "/hammerhead.js",
  "/transport-worker.js",
  "/task.js",
  "/iframe-task.js",
  "/worker-hammerhead.js",
  "/messaging",
  "/sessionexists",
  "/deletesession",
  "/newsession",
  "/editsession",
  "/needpassword",
  "/syncLocalStorage",
  "/api/shuffleDict",
  "/mainport",
]);

function isRammerheadRequest(url = "/"): boolean {
  const pathname = new URL(url, "http://localhost").pathname;
  return rammerheadRootRoutes.has(pathname) || /^\/[a-z0-9]{32}(?:\/|!|$)/i.test(pathname);
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/@mercuryworkshop/scramjet/dist/*",
          dest: "scramjet",
          rename: { stripBase: true },
        },
        {
          src: "node_modules/@mercuryworkshop/scramjet-controller/dist/*",
          dest: "controller",
          rename: { stripBase: true },
        },
        {
          src: "node_modules/@mercuryworkshop/epoxy-tls/full/epoxy.wasm",
          dest: command === "build" ? "assets" : "node_modules/.vite/deps",
          rename: { stripBase: true, name: "epoxy.wasm" },
        },
        {
          src: "node_modules/@mercuryworkshop/epoxy-tls/full/epoxy.wasm",
          dest: "transports/epoxy",
          rename: { stripBase: true, name: "epoxy.wasm" },
        },
        {
          src: [
            "node_modules/@titaniumnetwork-dev/ultraviolet/dist/uv.bundle.js",
            "node_modules/@titaniumnetwork-dev/ultraviolet/dist/uv.client.js",
            "node_modules/@titaniumnetwork-dev/ultraviolet/dist/uv.handler.js",
            "node_modules/@titaniumnetwork-dev/ultraviolet/dist/uv.sw.js",
          ],
          dest: "uv",
          rename: { stripBase: true },
        },
        {
          src: "../../packages/proxy/public/uv.config.js",
          dest: "uv",
          rename: { stripBase: true },
        },
        {
          src: "node_modules/@mercuryworkshop/bare-mux/dist/worker.js",
          dest: "bare-mux",
          rename: { stripBase: true, name: "worker.js" },
        },
        {
          src: "node_modules/@mercuryworkshop/epoxy-transport/dist/index.mjs",
          dest: "transports/epoxy",
          rename: { stripBase: true, name: "index.mjs" },
        },
        {
          src: "node_modules/@mercuryworkshop/libcurl-transport/dist/index.mjs",
          dest: "transports/libcurl",
          rename: { stripBase: true, name: "index.mjs" },
        },
      ],
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      "/service": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/wisp": {
        target: "http://localhost:8080",
        ws: true,
        changeOrigin: true,
      },
      "/rammer": {
        target: "http://localhost:8080",
        ws: true,
        changeOrigin: false,
      },
      "/": {
        target: "http://localhost:8080",
        ws: true,
        changeOrigin: false,
        bypass: (req) => isRammerheadRequest(req.url) ? undefined : req.url,
      },
    },
  },
}));
