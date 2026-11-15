import type { ProxySettings } from "@repo/proxy";
import type { AutoLaunchMode, BrowserTheme, DesktopTheme, SearchEngine } from "./src/SystemContext";
import type { CloakOption } from "./src/lib/cloak";

export interface QuickAccessSiteConfig {
  id: string;
  title: string;
  url: string;
}

export interface AppConfig {
  branding: {
    name: string;
    description: string;
    favicon: string;
  };
  appearance: {
    defaultDesktopTheme: DesktopTheme;
    defaultBrowserTheme: BrowserTheme;
    defaultWallpaper: string | null;
  };
  browser: {
    defaultSearchEngine: SearchEngine;
    showBookmarksBar: boolean;
    historyLimit: number;
    quickAccessSites: readonly QuickAccessSiteConfig[];
  };
  privacy: {
    panicKeyEnabled: boolean;
    panicKey: string;
    panicUrl: string;
    cloak: CloakOption;
    autoLaunchMode: AutoLaunchMode;
  };
  features: {
    phosphorousEnabled: boolean;
    browserEnhancementsEnabled: boolean;
    browserGamingToolsEnabled: boolean;
    browserAdBlockerEnabled: boolean;
    gameEnhancementsEnabled: boolean;
    gameGamingToolsEnabled: boolean;
    gameAdBlockerEnabled: boolean;
  };
  startup: {
    showAlphaDisclaimer: boolean;
  };
  proxy: Pick<ProxySettings, "enabled" | "engine" | "transport"> & {
    wispUrl: string | null;
  };
}

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
