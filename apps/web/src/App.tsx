import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import EpoxyTransport from "@mercuryworkshop/epoxy-transport";
import LibcurlTransport from "@mercuryworkshop/libcurl-transport";
import { defaultConfigDev } from "@mercuryworkshop/scramjet";
import { config as defaultControllerConfig, Controller } from "@mercuryworkshop/scramjet-controller";
import { Desktop, PhosiumIcon } from "@repo/os-shell";
import type { WindowState } from "@repo/os-shell";
import { proxyManager } from "@repo/proxy";
import type { ProxySettings } from "@repo/proxy";
import { AboutApp } from "./components/apps/AboutApp";
import { BrowserApp } from "./components/apps/BrowserApp";
import { PanicOverlay } from "./components/PanicOverlay";
import { CalculatorApp } from "./components/apps/CalculatorApp";
import { GameApp } from "./components/apps/GameApp";
import { GamePlayerApp } from "./components/apps/GamePlayerApp";
import { ScriptsApp } from "./components/apps/ScriptsApp";
import { SettingsApp } from "./components/apps/SettingsApp";
import { TextEditorApp } from "./components/apps/TextEditorApp";
import { FilesApp } from "./components/apps/FilesApp";
import { TaskManagerApp } from "./components/apps/TaskManagerApp";
import { DesktopWidgets } from "./components/DesktopWidgets";
import { SystemContext } from "./SystemContext";
import type { AutoLaunchMode, BrowserTheme, DesktopTheme, SearchEngine } from "./SystemContext";
import { applyCloak, isCloakOption, launchAboutBlank, launchBlob } from "./lib/cloak";
import type { CloakOption } from "./lib/cloak";
import { createBareMuxCompatibleTransport } from "./lib/proxy/bareMuxTransport";
import { createTransport, registerSystemWorker } from "./lib/proxy/runtime";
import {
  parseSavedExternalPhosiumExtensions,
} from "./extensions/phosphorousExtensions";
import type { ExternalPhosiumExtension } from "./extensions/phosphorousExtensions";

function getSavedTheme(): DesktopTheme {
  if (typeof window === "undefined") return "midnight";
  const theme = localStorage.getItem("phosium_theme");
  return theme === "light" || theme === "ocean" ? theme : "midnight";
}

function getSavedBrowserTheme(): BrowserTheme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("phosium_browser_theme") === "dark" ? "dark" : "light";
}

function getSavedWallpaper(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("phosium_wallpaper");
}

function getSavedSearchEngine(): SearchEngine {
  if (typeof window === "undefined") return "google";
  const engine = localStorage.getItem("phosium_search_engine");
  return engine === "duckduckgo" || engine === "bing" || engine === "brave" ? engine : "google";
}

function getSavedCloak(): CloakOption {
  if (typeof window === "undefined") return "none";
  const saved = localStorage.getItem("phosium_cloak");
  return isCloakOption(saved) ? saved : "none";
}

function getSavedAutoLaunchMode(): AutoLaunchMode {
  if (typeof window === "undefined") return "none";
  const saved = localStorage.getItem("phosium_auto_launch");
  return saved === "about-blank" || saved === "blob" ? saved : "none";
}

function getSavedPanicKey(): string {
  if (typeof window === "undefined") return "\\";
  return localStorage.getItem("phosium_panic_key") || "\\";
}

function getSavedPanicUrl(): string {
  if (typeof window === "undefined") return "https://www.google.com/";
  const saved = localStorage.getItem("phosium_panic_url");
  if (!saved) return "https://www.google.com/";
  try {
    const url = new URL(saved);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : "https://www.google.com/";
  } catch {
    return "https://www.google.com/";
  }
}

export default function App() {
  const [proxySettings, setProxySettings] = useState(() => proxyManager.getSettings());
  const [showAlphaDisclaimer, setShowAlphaDisclaimer] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("phosium_alpha_disclaimer_acknowledged") !== "true";
    } catch (error) {
      console.error("Could not check whether the alpha disclaimer was acknowledged.", error);
      return true;
    }
  });
  const [theme, setThemeState] = useState<DesktopTheme>(getSavedTheme);
  const [browserTheme, setBrowserThemeState] = useState<BrowserTheme>(getSavedBrowserTheme);
  const [wallpaper, setWallpaperState] = useState<string | null>(getSavedWallpaper);
  const [searchEngine, setSearchEngineState] = useState<SearchEngine>(getSavedSearchEngine);
  const [cloak, setCloakState] = useState<CloakOption>(getSavedCloak);
  const [autoLaunchMode, setAutoLaunchModeState] = useState<AutoLaunchMode>(getSavedAutoLaunchMode);
  const [panicKeyEnabled, setPanicKeyEnabledState] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("phosium_panic_key_enabled") === "true",
  );
  const [panicKey, setPanicKeyState] = useState<string>(getSavedPanicKey);
  const [panicUrl, setPanicUrlState] = useState<string>(getSavedPanicUrl);
  const [panicActive, setPanicActive] = useState(false);
  const [proxyStatus, setProxyStatus] = useState(() =>
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? "Starting system services..."
      : "Service Workers are not supported in this browser."
  );
  const [controller, setController] = useState<Controller | null>(null);
  const [serviceWorker, setServiceWorker] = useState<ServiceWorker | null>(null);
  const [phosphorousEnabled, setPhosphorousEnabledState] = useState(
    () => typeof window === "undefined" || localStorage.getItem("phosium_phosphorous_enabled") !== "false"
  );
  const [browserEnhancementsEnabled, setBrowserEnhancementsEnabledState] = useState(
    () => typeof window === "undefined" || localStorage.getItem("phosium_enhancements") !== "false"
  );
  const [browserGamingToolsEnabled, setBrowserGamingToolsEnabledState] = useState(
    () => typeof window === "undefined" || localStorage.getItem("phosium_gaming_tools") !== "false"
  );
  const [browserAdBlockerEnabled, setBrowserAdBlockerEnabledState] = useState(
    () => typeof window === "undefined" || localStorage.getItem("phosium_ad_blocker") !== "false"
  );
  const [gameEnhancementsEnabled, setGameEnhancementsEnabledState] = useState(
    () => typeof window === "undefined" || (
      localStorage.getItem("phosium_game_enhancements")
      ?? localStorage.getItem("phosium_enhancements")
    ) !== "false"
  );
  const [gameGamingToolsEnabled, setGameGamingToolsEnabledState] = useState(
    () => typeof window === "undefined" || (
      localStorage.getItem("phosium_game_gaming_tools")
      ?? localStorage.getItem("phosium_gaming_tools")
    ) !== "false"
  );
  const [gameAdBlockerEnabled, setGameAdBlockerEnabledState] = useState(
    () => typeof window === "undefined" || (
      localStorage.getItem("phosium_game_ad_blocker")
      ?? localStorage.getItem("phosium_ad_blocker")
    ) !== "false"
  );
  const [externalExtensions, setExternalExtensionsState] = useState<ExternalPhosiumExtension[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return parseSavedExternalPhosiumExtensions(localStorage.getItem("phosium_external_extensions"));
    } catch (error) {
      console.error("Unable to load saved external extensions:", error);
      return [];
    }
  });
  const [browserRequest, setBrowserRequest] = useState<{ id: number; url: string } | null>(null);
  const workerPromiseRef = useRef<Promise<ServiceWorker> | null>(null);
  const scramjetControllerRef = useRef<Controller | null>(null);
  const bareMuxRef = useRef<BareMuxConnection | null>(null);
  const syncRevisionRef = useRef(0);
  const browserRequestIdRef = useRef(0);
  const gameWindowIdRef = useRef(0);
  const startupLaunchRef = useRef({ mode: autoLaunchMode, cloak });
  const didAutoLaunchRef = useRef(false);

  const updateProxySettings = useCallback((update: Partial<ProxySettings>) => {
    proxyManager.setSettings(update);
    setProxySettings((current) => ({ ...current, ...update }));
  }, []);

  const setBrowserTheme = useCallback((nextTheme: BrowserTheme) => {
    localStorage.setItem("phosium_browser_theme", nextTheme);
    setBrowserThemeState(nextTheme);
  }, []);

  const acknowledgeAlphaDisclaimer = useCallback(() => {
    try {
      localStorage.setItem("phosium_alpha_disclaimer_acknowledged", "true");
    } catch (error) {
      console.error("Could not save the alpha disclaimer acknowledgment.", error);
    }
    setShowAlphaDisclaimer(false);
  }, []);

  const setTheme = useCallback((nextTheme: DesktopTheme) => {
    localStorage.setItem("phosium_theme", nextTheme);
    setThemeState(nextTheme);
  }, []);

  const setWallpaper = useCallback((image: string | null) => {
    if (image === null) localStorage.removeItem("phosium_wallpaper");
    else localStorage.setItem("phosium_wallpaper", image);
    setWallpaperState(image);
  }, []);

  const setSearchEngine = useCallback((engine: SearchEngine) => {
    localStorage.setItem("phosium_search_engine", engine);
    setSearchEngineState(engine);
  }, []);

  const setCloak = useCallback((option: CloakOption) => {
    localStorage.setItem("phosium_cloak", option);
    setCloakState(option);
  }, []);

  const setAutoLaunchMode = useCallback((mode: AutoLaunchMode) => {
    localStorage.setItem("phosium_auto_launch", mode);
    setAutoLaunchModeState(mode);
  }, []);

  const setPanicKeyEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem("phosium_panic_key_enabled", String(enabled));
    setPanicKeyEnabledState(enabled);
  }, []);

  const setPanicKey = useCallback((key: string) => {
    localStorage.setItem("phosium_panic_key", key);
    setPanicKeyState(key);
  }, []);

  const setPanicUrl = useCallback((url: string) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new TypeError("The panic destination must use HTTP or HTTPS.");
    }
    localStorage.setItem("phosium_panic_url", parsedUrl.href);
    setPanicUrlState(parsedUrl.href);
  }, []);

  const setPhosphorousEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem("phosium_phosphorous_enabled", String(enabled));
    setPhosphorousEnabledState(enabled);
  }, []);

  const setBrowserEnhancementsEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem("phosium_enhancements", String(enabled));
    setBrowserEnhancementsEnabledState(enabled);
  }, []);

  const setBrowserGamingToolsEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem("phosium_gaming_tools", String(enabled));
    setBrowserGamingToolsEnabledState(enabled);
  }, []);

  const setBrowserAdBlockerEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem("phosium_ad_blocker", String(enabled));
    setBrowserAdBlockerEnabledState(enabled);
  }, []);

  const setGameEnhancementsEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem("phosium_game_enhancements", String(enabled));
    setGameEnhancementsEnabledState(enabled);
  }, []);

  const setGameGamingToolsEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem("phosium_game_gaming_tools", String(enabled));
    setGameGamingToolsEnabledState(enabled);
  }, []);

  const setGameAdBlockerEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem("phosium_game_ad_blocker", String(enabled));
    setGameAdBlockerEnabledState(enabled);
  }, []);

  const setExternalExtensions = useCallback((extensions: ExternalPhosiumExtension[]) => {
    try {
      localStorage.setItem("phosium_external_extensions", JSON.stringify(extensions));
      setExternalExtensionsState(extensions);
    } catch (error) {
      console.error("Unable to save external extensions:", error);
      throw error;
    }
  }, []);

  const openInBrowser = useCallback((url: string) => {
    setBrowserRequest({ id: ++browserRequestIdRef.current, url });
    window.dispatchEvent(new CustomEvent("phosium:focus-window", { detail: "browser" }));
  }, []);

  const openGame = useCallback(({ title, url }: { title: string; url: string }) => {
    const instance = ++gameWindowIdRef.current;
    window.dispatchEvent(new CustomEvent("phosium:open-window", {
      detail: {
        id: `game-${instance}`,
        title,
        icon: <PhosiumIcon name="gamepad-2" />,
        description: `Play ${title}`,
        isOpen: true,
        isMinimized: false,
        isMaximized: false,
        zIndex: 20 + instance,
        position: { x: 115 + (instance % 5) * 28, y: 58 + (instance % 5) * 24 },
        component: <GamePlayerApp title={title} url={url} />,
      } satisfies WindowState,
    }));
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    const initializeWorker = async () => {
      try {
        workerPromiseRef.current ??= registerSystemWorker();
        const worker = await workerPromiseRef.current;
        if (!cancelled) setServiceWorker(worker);
      } catch (error) {
        workerPromiseRef.current = null;
        console.error("Service Worker registration failed:", error);
        if (!cancelled) {
          setProxyStatus(error instanceof Error ? error.message : String(error));
        }
      }
    };

    if (document.readyState === "complete") {
      void initializeWorker();
    } else {
      window.addEventListener("load", initializeWorker, { once: true });
    }
    return () => {
      cancelled = true;
      window.removeEventListener("load", initializeWorker);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    applyCloak(cloak);
  }, [cloak]);

  useEffect(() => {
    if (window.self !== window.top) return;
    if (didAutoLaunchRef.current) return;
    didAutoLaunchRef.current = true;

    const { mode, cloak: startupCloak } = startupLaunchRef.current;
    if (mode === "about-blank") void launchAboutBlank(startupCloak);
    if (mode === "blob") void launchBlob(startupCloak);
  }, []);

  useEffect(() => {
    const revision = ++syncRevisionRef.current;
    let cancelled = false;
    const syncProxy = async () => {
      if (!proxySettings.enabled) {
        return;
      }

      try {
        if (proxySettings.engine === "rammerhead") {
          const response = await fetch("/rammer/health");
          if (!response.ok) {
            throw new Error(`Rammerhead health check failed with HTTP ${response.status}.`);
          }
          if (!cancelled && revision === syncRevisionRef.current) {
            setProxyStatus("Rammerhead ready");
          }
          return;
        }

        if (!serviceWorker) return;
        if (proxySettings.engine === "scramjet") {
          let scramjetController = scramjetControllerRef.current;
          if (!scramjetController) {
            scramjetController = new Controller({
              serviceworker: serviceWorker,
              transport: createTransport(proxySettings),
              config: {
                ...defaultControllerConfig,
                prefix: "/service/",
                scramjetPath: "/scramjet/scramjet.js",
                injectPath: "/controller/controller.inject.js",
                wasmPath: "/scramjet/scramjet.wasm",
              },
              scramjetConfig: defaultConfigDev,
            });
            scramjetControllerRef.current = scramjetController;
            await scramjetController.wait();
          } else {
            scramjetController.setTransport(createTransport(proxySettings));
          }
          if (!cancelled && revision === syncRevisionRef.current) {
            setController(scramjetController);
            setProxyStatus(`Scramjet ready · ${proxySettings.transport}`);
          }
          return;
        }

        const bareMux = bareMuxRef.current ?? new BareMuxConnection("/bare-mux/worker.js");
        bareMuxRef.current = bareMux;
        const wisp = new URL(proxySettings.wispUrl);
        if (wisp.protocol !== "ws:" && wisp.protocol !== "wss:") {
          throw new TypeError("Wisp URL must use ws:// or wss://.");
        }
        const transportOptions = proxySettings.transport === "libcurl"
          ? { wisp: wisp.href, websocket: wisp.href }
          : { wisp: wisp.href };
        const transport = proxySettings.transport === "libcurl"
          ? new LibcurlTransport(transportOptions)
          : new EpoxyTransport(transportOptions);
        await transport.init();
        await bareMux.setRemoteTransport(
          createBareMuxCompatibleTransport(transport),
          `phosium-${proxySettings.transport}`,
        );
        if (!cancelled && revision === syncRevisionRef.current) {
          setProxyStatus(`Ultraviolet ready · ${proxySettings.transport}`);
        }
      } catch (error) {
        console.error("Proxy configuration failed:", error);
        if (!cancelled && revision === syncRevisionRef.current) {
          setProxyStatus(error instanceof Error ? error.message : String(error));
        }
      }
    };

    void syncProxy();
    return () => {
      cancelled = true;
    };
  }, [proxySettings, serviceWorker]);

  useEffect(() => {
    if (!panicKeyEnabled || !panicKey) return;
    const handlePanicKey = (event: KeyboardEvent) => {
      if (event.key !== panicKey) return;
      const target = event.target;
      if (target instanceof HTMLElement
        && (target.isContentEditable || target.matches("input, textarea, select, [data-panic-key-capture]"))) return;
      event.preventDefault();
      setPanicActive((active) => !active);
    };
    const handlePanicToggle = () => setPanicActive((active) => !active);
    window.addEventListener("keydown", handlePanicKey);
    window.addEventListener("phosium:panic-toggle", handlePanicToggle);
    return () => {
      window.removeEventListener("keydown", handlePanicKey);
      window.removeEventListener("phosium:panic-toggle", handlePanicToggle);
    };
  }, [panicKey, panicKeyEnabled]);

  const initialWindows = useMemo<WindowState[]>(() => [
    {
      id: "browser",
      title: "Browser",
      icon: <PhosiumIcon name="globe" />,
      description: "Browse with Chrome-inspired controls",
      isOpen: true,
      isMinimized: false,
      isMaximized: false,
      zIndex: 10,
      position: { x: 95, y: 48 },
      component: <BrowserApp />,
    },
    {
      id: "files",
      title: "Files",
      icon: <PhosiumIcon name="folder" />,
      description: "Browse virtual file system records",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 14,
      position: { x: 305, y: 228 },
      component: <FilesApp />,
    },
    {
      id: "games",
      title: "Games",
      icon: <PhosiumIcon name="gamepad-2" />,
      description: "Browse and launch web games",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 8,
      position: { x: 130, y: 78 },
      component: <GameApp />,
    },
    {
      id: "text-editor",
      title: "Text Editor",
      icon: <PhosiumIcon name="file-text" />,
      description: "Create and save documents to VFS",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 11,
      position: { x: 200, y: 138 },
      component: <TextEditorApp />,
    },
    {
      id: "calculator",
      title: "Math Studio",
      icon: <PhosiumIcon name="calculator" />,
      description: "Graph, solve, and explore functions",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 12,
      position: { x: 235, y: 168 },
      component: <CalculatorApp />,
    },
    {
      id: "about",
      title: "About",
      icon: <PhosiumIcon name="info" />,
      description: "System details and versions",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 13,
      position: { x: 270, y: 198 },
      component: <AboutApp />,
    },
    {
      id: "settings",
      title: "Settings",
      icon: <PhosiumIcon name="settings" />,
      description: "Appearance, network and browser settings",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 9,
      position: { x: 165, y: 108 },
      component: <SettingsApp />,
    },
    {
      id: "scripts",
      title: "Scripts",
      icon: <PhosiumIcon name="braces" />,
      description: "Manage page behavior scripts",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 16,
      position: { x: 345, y: 180 },
      component: <ScriptsApp />,
    },
    {
      id: "task-manager",
      title: "Task Manager",
      icon: <PhosiumIcon name="hard-drive" />,
      description: "View and end running apps",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 15,
      position: { x: 315, y: 120 },
      component: <TaskManagerApp />,
    },
  ], []);

  return (
    <SystemContext.Provider value={{
      proxySettings,
      updateProxySettings,
      theme,
      setTheme,
      browserTheme,
      setBrowserTheme,
      wallpaper,
      setWallpaper,
      proxyStatus: proxySettings.enabled ? proxyStatus : "System-wide proxy is off.",
      controller,
      serviceWorker,
      phosphorousEnabled,
      setPhosphorousEnabled,
      browserEnhancementsEnabled,
      setBrowserEnhancementsEnabled,
      browserGamingToolsEnabled,
      setBrowserGamingToolsEnabled,
      browserAdBlockerEnabled,
      setBrowserAdBlockerEnabled,
      gameEnhancementsEnabled,
      setGameEnhancementsEnabled,
      gameGamingToolsEnabled,
      setGameGamingToolsEnabled,
      gameAdBlockerEnabled,
      setGameAdBlockerEnabled,
      externalExtensions,
      setExternalExtensions,
      browserRequest,
      openInBrowser,
      openGame,
      searchEngine,
      setSearchEngine,
      cloak,
      setCloak,
      autoLaunchMode,
      setAutoLaunchMode,
      panicKeyEnabled,
      setPanicKeyEnabled,
      panicKey,
      setPanicKey,
      panicUrl,
      setPanicUrl,
    }}>
      <div
        className="phosium-root"
        style={wallpaper ? { "--desktop-wallpaper": `url("${wallpaper}")` } as CSSProperties : undefined}
      >
        <Desktop initialWindows={initialWindows} />
        <DesktopWidgets />
        <PanicOverlay
          active={panicActive}
          panicKey={panicKey}
          panicKeyEnabled={panicKeyEnabled}
          url={panicUrl}
          onToggle={() => setPanicActive((active) => !active)}
        />
        {showAlphaDisclaimer && (
          <div className="alpha-disclaimer-overlay">
            <section aria-labelledby="alpha-disclaimer-title" aria-modal="true" className="alpha-disclaimer" role="dialog">
              <span className="alpha-disclaimer-mark"><PhosiumIcon name="sparkles" /></span>
              <p className="alpha-disclaimer-eyebrow">EARLY ACCESS</p>
              <h1 id="alpha-disclaimer-title">Phosium is in alpha</h1>
              <p>Phosium is still being developed, so you may run into bugs or unfinished features. Thanks for testing it lol!</p>
              <p>If you find a problem, please report it on our <a href="https://github.com/idontcodddde/phosium/issues" rel="noreferrer" target="_blank">GitHub issues page</a>.</p>
              <button autoFocus onClick={acknowledgeAlphaDisclaimer} type="button">Got it, continue</button>
            </section>
          </div>
        )}
      </div>
    </SystemContext.Provider>
  );
}