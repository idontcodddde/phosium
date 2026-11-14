import type { AppConfig } from "./app.config.d.ts";

/**
 * Fork-specific defaults. Saved browser preferences take precedence over these
 * values, so changing this config affects new users and reset actions.
 */
export const appConfig = {
  branding: {
    name: "Phosium",
    description: "A web-based desktop environment.",
    favicon: "/favicon.png",
  },
  appearance: {
    defaultDesktopTheme: "midnight",
    defaultBrowserTheme: "light",
    defaultWallpaper: null,
  },
  browser: {
    defaultSearchEngine: "google",
    showBookmarksBar: true,
    historyLimit: 500,
    quickAccessSites: [
      { id: "qa-youtube", title: "YOUTUBE", url: "https://www.youtube.com" },
      { id: "qa-discord", title: "DISCORD", url: "https://discord.com/app" },
      {
        id: "qa-instagram",
        title: "INSTAGRAM",
        url: "https://www.instagram.com",
      },
      { id: "qa-tiktok", title: "TIKTOK", url: "https://www.tiktok.com" },
      { id: "qa-spotify", title: "SPOTIFY", url: "https://open.spotify.com" },
      { id: "qa-twitch", title: "TWITCH", url: "https://www.twitch.tv" },
    ],
  },
  privacy: {
    panicKeyEnabled: false,
    panicKey: "\\",
    panicUrl: "https://www.google.com/",
    cloak: "none",
    autoLaunchMode: "none",
  },
  features: {
    phosphorousEnabled: true,
    browserEnhancementsEnabled: true,
    browserGamingToolsEnabled: true,
    browserAdBlockerEnabled: true,
    gameEnhancementsEnabled: true,
    gameGamingToolsEnabled: true,
    gameAdBlockerEnabled: true,
  },
  startup: {
    showAlphaDisclaimer: true,
  },
  proxy: {
    enabled: true,
    engine: "scramjet",
    transport: "epoxy",
    wispUrl: null,
  },
} as const satisfies AppConfig;
