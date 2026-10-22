import { createContext, useContext } from "react";
import type { Controller } from "@mercuryworkshop/scramjet-controller";
import type { ProxySettings } from "@repo/proxy";
import type { CloakOption } from "./lib/cloak";

export type DesktopTheme = "midnight" | "light" | "ocean";
export type SearchEngine = "google" | "duckduckgo" | "bing" | "brave";
export type AutoLaunchMode = "none" | "about-blank" | "blob";

export interface GameLaunch {
  title: string;
  url: string;
}

export interface SystemContextValue {
  proxySettings: ProxySettings;
  updateProxySettings: (settings: Partial<ProxySettings>) => void;
  theme: DesktopTheme;
  setTheme: (theme: DesktopTheme) => void;
  proxyStatus: string;
  controller: Controller | null;
  serviceWorker: ServiceWorker | null;
  phosphorousEnabled: boolean;
  setPhosphorousEnabled: (enabled: boolean) => void;
  browserEnhancementsEnabled: boolean;
  setBrowserEnhancementsEnabled: (enabled: boolean) => void;
  browserGamingToolsEnabled: boolean;
  setBrowserGamingToolsEnabled: (enabled: boolean) => void;
  browserAdBlockerEnabled: boolean;
  setBrowserAdBlockerEnabled: (enabled: boolean) => void;
  gameEnhancementsEnabled: boolean;
  setGameEnhancementsEnabled: (enabled: boolean) => void;
  gameGamingToolsEnabled: boolean;
  setGameGamingToolsEnabled: (enabled: boolean) => void;
  gameAdBlockerEnabled: boolean;
  setGameAdBlockerEnabled: (enabled: boolean) => void;
  browserRequest: { id: number; url: string } | null;
  openInBrowser: (url: string) => void;
  openGame: (game: GameLaunch) => void;
  searchEngine: SearchEngine;
  setSearchEngine: (engine: SearchEngine) => void;
  cloak: CloakOption;
  setCloak: (option: CloakOption) => void;
  autoLaunchMode: AutoLaunchMode;
  setAutoLaunchMode: (mode: AutoLaunchMode) => void;
}

export const SystemContext = createContext<SystemContextValue | null>(null);

export function useSystem(): SystemContextValue {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error("System apps must be rendered inside the Phosium system provider.");
  }
  return context;
}
