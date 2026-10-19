# Phosium

Phosium is an experimental browser-based desktop environment. It brings a multi-window desktop shell, a tabbed browser, a game library, and configurable proxy services together in one web app.

> **Status: alpha.** Phosium is under active development. Expect bugs, incomplete features, and breaking changes. Do not rely on a public instance to protect sensitive data.

## What it includes

- Desktop-style app windows, taskbar, and settings
- Chrome-inspired browser with tabs, bookmarks, browsing history (yes i know), and selectable search engines
- Optional system-wide proxy routing through Ultraviolet, Scramjet, or Rammerhead
- Configurable Wisp transport settings
- Phosphorous page extensions, including browser/game extension controls and best-effort ad filtering
- Game library, game hubs, and a game player with extension support

Proxy behavior depends on the selected engine, browser capabilities, and the deployment environment. The Phosphorous ad blocker is best-effort page-level filtering; it is not a browser-native network filter and cannot prevent every request.

## Requirements

- Node.js 20.19 or newer
- pnpm 12.11.2

Install dependencies from the repository root:

```sh
pnpm install
```

## Development

Run the proxy backend and web app in separate terminals. From the repository root:

```sh
pnpm dev:proxy
```

```sh
pnpm dev
```

The web app is served at `http://localhost:3000`; Vite forwards proxy requests to the backend at port `8080`.

## Build and run in production

Build all workspace packages and the web app:

```sh
pnpm build
```

Start the production server:

```sh
pnpm start
```

The server serves the built frontend from `apps/web/dist` alongside the proxy endpoints. It listens on port `8080` by default; set `PORT` to use another port.

## Deploying a hosted instance

Phosium must run as a **Node.js web service**, not as a static-only site. The backend provides the proxy assets and routes, Wisp WebSocket connections, and Rammerhead HTTP/WebSocket endpoints.

1. Build from the repository root using `pnpm install --frozen-lockfile` and `pnpm build`.
2. Start the service with `pnpm start`. Configure the hosting platform to provide its listening port through `PORT`.
3. Put the service behind HTTPS and set `PUBLIC_ORIGIN` to the public base URL, for example `https://phosium.example.com`.
4. Configure the reverse proxy to forward normal HTTP requests and WebSocket upgrades, including `/wisp/` and `/rammer/`, to the Node service.
5. Keep the frontend and proxy endpoints on the same origin so the root-scoped service worker and proxy paths work.
6. Verify `/health` and `/rammer/health`, then test the browser with each proxy engine you intend to offer.

Rammerhead session and cache data may need writable persistent storage if it should survive service restarts. The project currently disables Rammerhead cross-request localStorage synchronization because the bundled client expects an API not exposed by the installed Hammerhead version.

### Public-instance safety

The proxy backend makes outbound requests on behalf of users. An openly accessible deployment can be abused and can generate substantial bandwidth and hosting costs. Before making an instance public, add appropriate access controls, usage limits, monitoring, and abuse response procedures. Review the applicable laws and the terms of the services users can access.

## Releasing an alpha

For an alpha release such as `1.0.0-alpha.0`:

1. Push the source to GitHub and confirm the intended commit builds with `pnpm build`.
2. Create and push a version tag, for example `v1.0.0-alpha.0`.
3. Create a GitHub Release from that tag and mark it as a pre-release. Include the hosted demo URL, setup notes, known limitations, and changes since the previous release.
4. Deploy the same tagged revision as a Node.js service if you want users to try the hosted app.

Use incrementing prerelease versions for subsequent alpha releases, such as `1.0.0-alpha.1`. Phosium is a workspace application and is not currently packaged for publication to npm.

## License

No license has been specified for this repository yet. Until one is added, assume the source is not granted for reuse, redistribution, or modification beyond the permissions provided by applicable law.
