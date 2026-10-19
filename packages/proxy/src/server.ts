import express from "express";
import { createServer } from "http";
import type { IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { TLSSocket } from "node:tls";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import {
  createRammerhead,
  routeRhRequest,
  routeRhUpgrade,
  shouldRouteRh,
} from "@rubynetwork/rammerhead";

const app = express();
const server = createServer(app);
const publicOrigin = process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN) : null;
if (publicOrigin && publicOrigin.protocol !== "http:" && publicOrigin.protocol !== "https:") {
  throw new TypeError("PUBLIC_ORIGIN must use http:// or https://.");
}
const rammerhead = createRammerhead({
  logLevel: process.env.NODE_ENV === "production" ? "warn" : "info",
  reverseProxy: true,
  disableLocalStorageSync: true,
});

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const header = Array.isArray(value) ? value[0] : value;
  return header?.split(",")[0]?.trim();
}

function normalizeRammerheadReferer(req: IncomingMessage): void {
  const referer = firstHeaderValue(req.headers.referer);
  if (!referer) return;

  try {
    const url = new URL(referer);
    if (/^\/rammer\/[a-z0-9]{32}(?:\/|$)/i.test(url.pathname)) {
      url.pathname = url.pathname.slice("/rammer".length);
      req.headers.referer = url.href;
    }
  } catch {
    return;
  }
}

function setRammerheadOrigin(req: IncomingMessage): boolean {
  let origin: string;
  if (publicOrigin) {
    origin = publicOrigin.origin;
  } else {
    const protocol = req.socket instanceof TLSSocket ? "https:" : "http:";
    const host = firstHeaderValue(req.headers.host);
    if (!host) return false;
    try {
      origin = new URL(`${protocol}//${host}`).origin;
    } catch {
      return false;
    }
  }

  const cookies = (req.headers.cookie ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie && !cookie.toLowerCase().startsWith("origin_proxy="));
  cookies.push(`origin_proxy=${origin}`);
  req.headers.cookie = cookies.join("; ");
  normalizeRammerheadReferer(req);
  return true;
}

server.on("upgrade", (req, socket, head) => {
  if (req.url && req.url.startsWith("/wisp/")) {
    wisp.routeRequest(req, socket, head);
  } else if (req.url?.startsWith("/rammer/")) {
    req.url = req.url.slice("/rammer".length) || "/";
    if (setRammerheadOrigin(req) && shouldRouteRh(req)) {
      routeRhUpgrade(rammerhead, req, socket, head);
    } else {
      socket.destroy();
    }
  } else if (req.url && shouldRouteRh(req) && setRammerheadOrigin(req)) {
    routeRhUpgrade(rammerhead, req, socket, head);
  } else {
    socket.destroy();
  }
});

app.get("/rammer/health", (_req, res) => {
  res.json({ status: "Active", engine: "rammerhead" });
});

app.use("/rammer", (req, res, next) => {
  if (!setRammerheadOrigin(req)) {
    res.status(400).send("Rammerhead requires a valid host header.");
    return;
  }
  if (shouldRouteRh(req)) {
    routeRhRequest(rammerhead, req, res);
  } else {
    next();
  }
});

app.use((req, res, next) => {
  if (shouldRouteRh(req)) {
    if (!setRammerheadOrigin(req)) {
      res.status(400).send("Rammerhead requires a valid host header.");
      return;
    }
    routeRhRequest(rammerhead, req, res);
    return;
  }
  next();
});

// Static middleware strips its mount prefix, so /uv/uv.bundle.js maps to uvPath/uv.bundle.js.
app.get("/uv/uv.config.js", (_req, res) => {
  res.type("application/javascript").sendFile(
    fileURLToPath(new URL("../public/uv.config.js", import.meta.url))
  );
});

// Serve Scramjet on /service/ and Ultraviolet runtime files on /uv/.
app.use("/service/", express.static(scramjetPath));
app.use("/uv/", express.static(uvPath));

app.get("/health", (req, res) => {
  res.json({ status: "Active", engines: ["scramjet", "ultraviolet", "rammerhead"] });
});

const PORT = process.env.PORT || 8080;
const webDistPath = fileURLToPath(new URL("../../../apps/web/dist", import.meta.url));
if (existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
  app.get("*", (_req, res) => {
    res.sendFile(fileURLToPath(new URL("../../../apps/web/dist/index.html", import.meta.url)));
  });
}
server.listen(PORT, () => {
  console.log(`Proxy backend running at http://localhost:${PORT}`);
});
