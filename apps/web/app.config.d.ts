import type { ProxySettings } from "@repo/proxy";
import type {
    AutoLaunchMode,
    BrowserTheme,
    DesktopTheme,
    SearchEngine,
} from "./src/SystemContext";
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
        /** Set to null to use the current host's /wisp/ endpoint. */
        wispUrl: string | null;
    };
}
