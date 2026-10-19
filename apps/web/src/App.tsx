import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BareMuxConnection } from "@mercuryworkshop/bare-mux";
import EpoxyTransport from "@mercuryworkshop/epoxy-transport";
import LibcurlTransport from "@mercuryworkshop/libcurl-transport";
import { defaultConfigDev } from "@mercuryworkshop/scramjet";
import { config as defaultControllerConfig, Controller } from "@mercuryworkshop/scramjet-controller";
import { Desktop } from "@repo/os-shell";
import type { WindowState } from "@repo/os-shell";
import { proxyManager } from "@repo/proxy";
import type { ProxySettings } from "@repo/proxy";
import { BrowserApp } from "./BrowserApp";
import { GameApp } from "./GameApp";
import { GamePlayerApp } from "./GamePlayerApp";
import { SettingsApp } from "./SettingsApp";
import { SystemContext } from "./SystemContext";
import type { DesktopTheme, SearchEngine } from "./SystemContext";
import { createBareMuxCompatibleTransport } from "./bareMuxTransport";

function getSavedTheme(): DesktopTheme {
  if (typeof window === "undefined") return "midnight";
  const theme = localStorage.getItem("phosium_theme");
  return theme === "light" || theme === "ocean" ? theme : "midnight";
}

function getSavedSearchEngine(): SearchEngine {
  if (typeof window === "undefined") return "google";
  const engine = localStorage.getItem("phosium_search_engine");
  return engine === "duckduckgo" || engine === "bing" || engine === "brave" ? engine : "google";
}

function createTransport(settings: ProxySettings) {
  const wisp = new URL(settings.wispUrl);
  if (wisp.protocol !== "ws:" && wisp.protocol !== "wss:") {
    throw new TypeError("Wisp URL must use ws:// or wss://.");
  }
  if (settings.transport === "libcurl") {
    return new LibcurlTransport({ wisp: wisp.href, websocket: wisp.href });
  }
  return new EpoxyTransport({ wisp: wisp.href });
}

async function registerSystemWorker(): Promise<ServiceWorker> {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  console.log("SW registered:", registration.scope);

  const readyRegistration = await navigator.serviceWorker.ready;
  const serviceWorker = [
    navigator.serviceWorker.controller,
    readyRegistration.active,
  ].find((worker) => worker?.state === "activated")
    ?? readyRegistration.active
    ?? navigator.serviceWorker.controller;
  if (!serviceWorker) throw new Error("Service Worker registration has no active worker.");
  if (serviceWorker.state === "redundant") {
    throw new Error("Service Worker became redundant before activation.");
  }
  if (serviceWorker.state !== "activated") {
    await new Promise<void>((resolve, reject) => {
      const handleStateChange = () => {
        if (serviceWorker.state === "activated") {
          serviceWorker.removeEventListener("statechange", handleStateChange);
          resolve();
        } else if (serviceWorker.state === "redundant") {
          serviceWorker.removeEventListener("statechange", handleStateChange);
          reject(new Error("Service Worker became redundant before activation."));
        }
      };
      serviceWorker.addEventListener("statechange", handleStateChange);
      handleStateChange();
    });
  }
  return serviceWorker;
}

export default function App() {
  const [proxySettings, setProxySettings] = useState(() => proxyManager.getSettings());
  const [theme, setThemeState] = useState<DesktopTheme>(getSavedTheme);
  const [searchEngine, setSearchEngineState] = useState<SearchEngine>(getSavedSearchEngine);
  const [proxyStatus, setProxyStatus] = useState(() =>
    typeof navigator !== "undefined" && "serviceWorker" in navigator
      ? "Starting system services..."
      : "Service Workers are not supported in this browser."
  );
  const [controller, setController] = useState<Controller | null>(null);
  const [serviceWorker, setServiceWorker] = useState<ServiceWorker | null>(null);
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
  const [browserRequest, setBrowserRequest] = useState<{ id: number; url: string } | null>(null);
  const workerPromiseRef = useRef<Promise<ServiceWorker> | null>(null);
  const scramjetControllerRef = useRef<Controller | null>(null);
  const bareMuxRef = useRef<BareMuxConnection | null>(null);
  const syncRevisionRef = useRef(0);
  const browserRequestIdRef = useRef(0);
  const gameWindowIdRef = useRef(0);

  const updateProxySettings = useCallback((update: Partial<ProxySettings>) => {
    proxyManager.setSettings(update);
    setProxySettings((current) => ({ ...current, ...update }));
  }, []);

  const setTheme = useCallback((nextTheme: DesktopTheme) => {
    localStorage.setItem("phosium_theme", nextTheme);
    setThemeState(nextTheme);
  }, []);

  const setSearchEngine = useCallback((engine: SearchEngine) => {
    localStorage.setItem("phosium_search_engine", engine);
    setSearchEngineState(engine);
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
        icon: "▶",
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

  const initialWindows = useMemo<WindowState[]>(() => [
    {
      id: "browser",
      title: "Browser",
      icon: "◉",
      description: "Browse with Chrome-inspired controls",
      isOpen: true,
      isMinimized: false,
      isMaximized: false,
      zIndex: 10,
      position: { x: 95, y: 48 },
      component: <BrowserApp />,
    },
    {
      id: "games",
      title: "Games",
      icon: "G",
      description: "Browse and launch web games",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 8,
      position: { x: 130, y: 78 },
      component: <GameApp />,
    },
    {
      id: "settings",
      title: "Settings",
      icon: "⚙",
      description: "Appearance, network and browser settings",
      isOpen: false,
      isMinimized: false,
      isMaximized: false,
      zIndex: 9,
      position: { x: 165, y: 108 },
      component: <SettingsApp />,
    },
  ], []);

  return (
    <SystemContext.Provider value={{
      proxySettings,
      updateProxySettings,
      theme,
      setTheme,
      proxyStatus: proxySettings.enabled ? proxyStatus : "System-wide proxy is off.",
      controller,
      serviceWorker,
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
      browserRequest,
      openInBrowser,
      openGame,
      searchEngine,
      setSearchEngine,
    }}>
      <div className="phosium-root">
        <Desktop initialWindows={initialWindows} />
      </div>
    </SystemContext.Provider>
  );
}
