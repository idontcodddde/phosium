# Phosium Web

## Fork configuration

Edit [`app.config.ts`](./app.config.ts) to customize defaults and branding for
your fork. These values apply to first-time users; settings already saved in
browser storage take precedence. The Settings app's Reset buttons use the
configured defaults. To test changed defaults, clear this site's local storage.

The config includes:

- `branding`: app name, page description, and favicon path.
- `appearance`: initial desktop and browser themes, plus an optional wallpaper
  URL or data URL.
- `browser`: search engine, bookmarks-bar visibility, history limit, and the
  start-page quick-access links.
- `privacy`: panic-key behavior and destination, cloaking preset, and
  auto-launch mode.
- `features`: default enablement for Phosphorous and its browser/game helpers.
- `startup`: whether to show the alpha disclaimer.
- `proxy`: initial proxy enablement, engine, transport, and optional Wisp URL.
  Leave `wispUrl` as `null` to use the current host's `/wisp/` endpoint.

Theme, search-engine, cloaking, launch-mode, proxy-engine, and transport values
are type-checked against the options supported by the app. Keep custom quick
access entries in the same `{ id, title, url }` shape as the examples.

## Development

Run `pnpm dev` from the repository root to start the workspace. Build this app
with:

```sh
pnpm --filter web build
```

## Tests and proxy benchmark

Run the focused unit tests and the live-browser proxy smoke tests with:

```sh
pnpm --filter web test
pnpm --filter web exec playwright install chromium
pnpm --filter web test:e2e
```

The E2E smoke tests use Chromium and load `https://example.com/` through both
Scramjet and Ultraviolet, then check YouTube through Libcurl with both engines.
Run the repeated public-site benchmark separately:

```sh
pnpm --filter web benchmark:sites
```

The benchmark uses the default Scramjet + Epoxy worker path, runs Discord,
Wikipedia, Mozilla, GitHub, example.com, and YouTube five times each, and
reports each run plus per-site mean, median, minimum, and maximum times. It
loads each sample in a fresh browser tab and measures the proxied iframe's
`DOMContentLoaded` event (not full app hydration or interactivity); results
depend on network conditions and public sites may block or time out. Configure
it with `SITE_BENCHMARK_SITES`
(comma-separated URLs), `SITE_BENCHMARK_RUNS`, and
`SITE_BENCHMARK_TIMEOUT_MS`. Set `PLAYWRIGHT_BASE_URL` to use an already-running
app instead of starting the local workspace servers.
