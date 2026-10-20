import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { Phosphorus } from "phosphorous";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import { proxyConfig } from "@repo/proxy";
import { applyPhosiumExtensionStates, registerPhosiumExtensions } from "../../extensions/phosphorousExtensions";
import { resolveAddress } from "../../lib/browser/address";
import {
  decodeRammerheadUrl,
  encodeRammerheadUrl,
  isRammerheadProxyUrl,
} from "../../lib/proxy/rammerheadClient";
import { useSystem } from "../../SystemContext";
import type { SearchEngine } from "../../SystemContext";
import type { BrowserBookmark, BrowserHistoryEntry, BrowserTab } from "../../types/browser";

let tabSequence = 0;
let historySequence = 0;
const browserHistoryKey = "phosium_browser_history";
const browserHistoryLimit = 500;

function createTab(url = ""): BrowserTab {
  return {
    id: `browser-tab-${Date.now()}-${++tabSequence}`,
    title: url ? new URL(url).hostname : "New tab",
    url,
    draft: url,
  };
}

function loadBookmarks(): BrowserBookmark[] {
  try {
    const stored = localStorage.getItem("phosium_browser_bookmarks");
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new TypeError("Saved bookmarks must be a list.");
    return parsed.filter((entry): entry is BrowserBookmark =>
      typeof entry === "object"
      && entry !== null
      && "title" in entry
      && typeof entry.title === "string"
      && "url" in entry
      && typeof entry.url === "string"
      && /^https?:\/\//i.test(entry.url),
    );
  } catch (error) {
    console.error("Could not load Phosium browser bookmarks.", error);
    return [];
  }
}

function loadHistory(): BrowserHistoryEntry[] {
  try {
    const stored = localStorage.getItem(browserHistoryKey);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new TypeError("Saved browser history must be a list.");
    return parsed.filter((entry): entry is BrowserHistoryEntry =>
      typeof entry === "object"
      && entry !== null
      && "id" in entry
      && typeof entry.id === "string"
      && "title" in entry
      && typeof entry.title === "string"
      && "url" in entry
      && typeof entry.url === "string"
      && /^https?:\/\//i.test(entry.url)
      && "visitedAt" in entry
      && typeof entry.visitedAt === "number"
      && Number.isFinite(entry.visitedAt)
      && Math.abs(entry.visitedAt) <= 8.64e15,
    ).slice(0, browserHistoryLimit);
  } catch (error) {
    console.error("Could not load Phosium browser history.", error);
    return [];
  }
}

interface BrowserFrameProps {
  tab: BrowserTab;
  active: boolean;
  onFrameChange: (tabId: string, frame: HTMLIFrameElement | null) => void;
  onFrameLoad: (tabId: string, frame: HTMLIFrameElement) => void;
}

function BrowserFrame({ tab, active, onFrameChange, onFrameLoad }: BrowserFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    onFrameChange(tab.id, iframeRef.current);
    return () => onFrameChange(tab.id, null);
  }, [onFrameChange, tab.id]);

  return (
    <iframe
      allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; gamepad; geolocation; microphone; camera"
      className="chrome-page-frame"
      onLoad={() => {
        if (iframeRef.current) onFrameLoad(tab.id, iframeRef.current);
      }}
      ref={iframeRef}
      style={{ display: active && tab.url ? "block" : "none" }}
      title={tab.title}
    />
  );
}

export function BrowserApp() {
  const {
    proxySettings,
    controller,
    proxyStatus,
    browserEnhancementsEnabled,
    browserGamingToolsEnabled,
    browserAdBlockerEnabled,
    setBrowserGamingToolsEnabled,
    setBrowserEnhancementsEnabled,
    setBrowserAdBlockerEnabled,
    browserRequest,
    searchEngine,
    setSearchEngine,
  } = useSystem();
  const [firstTab] = useState(() => createTab());
  const [tabs, setTabs] = useState<BrowserTab[]>([firstTab]);
  const [activeTabId, setActiveTabId] = useState(firstTab.id);
  const [navigationError, setNavigationError] = useState("");
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>(loadBookmarks);
  const [history, setHistory] = useState<BrowserHistoryEntry[]>(loadHistory);
  const historyRef = useRef(history);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [showBookmarksBar, setShowBookmarksBar] = useState(
    () => localStorage.getItem("phosium_show_bookmarks_bar") !== "false",
  );
  const [extensionsOpen, setExtensionsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookmarkError, setBookmarkError] = useState("");
  const browserRef = useRef<HTMLDivElement>(null);
  const iframeRefs = useRef(new Map<string, HTMLIFrameElement>());
  const frameRefs = useRef(new Map<string, Frame>());
  const phosphorusRef = useRef<Phosphorus | null>(null);
  const extensionStateRef = useRef({
    enhancementsEnabled: browserEnhancementsEnabled,
    gamingToolsEnabled: browserGamingToolsEnabled,
    adBlockerEnabled: browserAdBlockerEnabled,
  });
  const detachRefs = useRef(new Map<string, () => void>());
  const navigatedKeys = useRef(new Map<string, string>());
  const lastBrowserRequestId = useRef(0);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const address = activeTab?.draft ?? "";

  const handleFrameChange = useCallback((tabId: string, iframe: HTMLIFrameElement | null) => {
    if (iframe) {
      iframeRefs.current.set(tabId, iframe);
      if (phosphorusRef.current && !detachRefs.current.has(tabId)) {
        detachRefs.current.set(tabId, phosphorusRef.current.attachToIframe(iframe));
      }
      return;
    }

    detachRefs.current.get(tabId)?.();
    detachRefs.current.delete(tabId);
    iframeRefs.current.delete(tabId);
    frameRefs.current.delete(tabId);
    navigatedKeys.current.delete(tabId);
  }, []);

  const saveBookmarks = useCallback((nextBookmarks: BrowserBookmark[]) => {
    try {
      localStorage.setItem("phosium_browser_bookmarks", JSON.stringify(nextBookmarks));
      setBookmarks(nextBookmarks);
      setBookmarkError("");
    } catch (error) {
      console.error("Could not save Phosium browser bookmarks.", error);
      setBookmarkError("Could not save bookmarks in this browser.");
    }
  }, []);

  const saveHistory = useCallback((nextHistory: BrowserHistoryEntry[]) => {
    const boundedHistory = nextHistory.slice(0, browserHistoryLimit);
    historyRef.current = boundedHistory;
    setHistory(boundedHistory);
    try {
      localStorage.setItem(browserHistoryKey, JSON.stringify(boundedHistory));
      setHistoryError("");
    } catch (error) {
      console.error("Could not save Phosium browser history.", error);
      setHistoryError("History is available until this browser closes, but could not be saved.");
    }
  }, []);

  const toggleBookmark = () => {
    if (!activeTab?.url) return;
    const existing = bookmarks.some((bookmark) => bookmark.url === activeTab.url);
    saveBookmarks(existing
      ? bookmarks.filter((bookmark) => bookmark.url !== activeTab.url)
      : [...bookmarks, { title: activeTab.title, url: activeTab.url }]);
  };

  const toggleBookmarksBar = () => {
    const nextVisible = !showBookmarksBar;
    setShowBookmarksBar(nextVisible);
    localStorage.setItem("phosium_show_bookmarks_bar", String(nextVisible));
    setMenuOpen(false);
  };

  const toggleExtension = (extension: "page" | "gaming" | "adblock", enabled: boolean) => {
    if (extension === "page") setBrowserEnhancementsEnabled(enabled);
    else if (extension === "gaming") setBrowserGamingToolsEnabled(enabled);
    else setBrowserAdBlockerEnabled(enabled);
  };

  const navigate = useCallback((rawUrl: string, tabId = activeTabId) => {
    try {
      const targetUrl = resolveAddress(rawUrl, searchEngine);
      setNavigationError("");
      const visitedAt = Date.now();
      saveHistory([{
        id: `history-${visitedAt}-${++historySequence}`,
        title: new URL(targetUrl).hostname,
        url: targetUrl,
        visitedAt,
      }, ...historyRef.current]);
      setHistoryOpen(false);
      setTabs((current) => current.map((tab) => tab.id === tabId
        ? { ...tab, url: targetUrl, draft: targetUrl, title: new URL(targetUrl).hostname }
        : tab));
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : String(error));
    }
  }, [activeTabId, saveHistory, searchEngine]);

  const openLinkInTab = useCallback((url: string) => {
    const tab = createTab(url);
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    navigate(url, tab.id);
  }, [navigate]);

  const getOriginalUrl = useCallback((tabId: string, rawUrl: string): string | null => {
    try {
      const iframe = iframeRefs.current.get(tabId);
      if (!iframe) return null;

      let targetUrl = rawUrl;
      if (proxySettings.enabled && proxySettings.engine === "scramjet") {
        const frame = frameRefs.current.get(tabId);
        if (frame) {
          const parsedUrl = new URL(targetUrl, window.location.href);
          const framePrefix = new URL(frame.prefix, window.location.href).pathname;
          const proxyPrefix = framePrefix.endsWith("/") ? framePrefix : `${framePrefix}/`;
          let encodedTarget: string | null = parsedUrl.pathname.startsWith(proxyPrefix)
            ? parsedUrl.pathname.slice(proxyPrefix.length)
            : null;
          if (encodedTarget === null && parsedUrl.pathname.startsWith("/service/")) {
            encodedTarget = parsedUrl.pathname.split("/").slice(4).join("/");
          }
          if (encodedTarget) {
            targetUrl = frame.context.interface.codecDecode(encodedTarget);
          }
        }
      } else if (proxySettings.enabled && proxySettings.engine === "ultraviolet") {
        const parsedUrl = new URL(targetUrl, window.location.href);
        const servicePrefix = "/uv/service/";
        if (parsedUrl.pathname.startsWith(servicePrefix)) {
          targetUrl = decodeURIComponent(parsedUrl.pathname.slice(servicePrefix.length))
            + parsedUrl.search
            + parsedUrl.hash;
        }
      } else if (proxySettings.enabled && proxySettings.engine === "rammerhead") {
        const frameWindow = iframe.contentWindow as (Window & {
          "%hammerhead%"?: {
            utils?: {
              url?: {
                parseProxyUrl?: (url: string) => { destUrl?: string } | null;
              };
            };
          };
        }) | null;
        const urlUtils = frameWindow?.["%hammerhead%"]?.utils?.url;
        const decodedUrl = decodeRammerheadUrl(
          targetUrl,
          urlUtils?.parseProxyUrl,
          urlUtils,
        );
        if (decodedUrl) {
          targetUrl = decodedUrl;
        } else if (isRammerheadProxyUrl(targetUrl)) {
          return null;
        }
      }

      const destination = new URL(targetUrl, iframe.contentWindow?.location.href);
      if (destination.protocol !== "http:" && destination.protocol !== "https:") return null;
      return destination.href;
    } catch {
      return null;
    }
  }, [proxySettings.enabled, proxySettings.engine]);

  const syncFrameNavigation = useCallback((tabId: string, iframe: HTMLIFrameElement) => {
    let frameUrl: string;
    let title: string;
    try {
      const frameWindow = iframe.contentWindow;
      if (!frameWindow) return;
      frameUrl = frameWindow.location.href;
      title = iframe.contentDocument?.title || new URL(frameUrl).hostname;
    } catch {
      return;
    }

    const destination = getOriginalUrl(tabId, frameUrl);
    if (!destination) return;
    const tab = tabs.find((current) => current.id === tabId);
    if (!tab) return;

    if (tab.url === destination) {
      if (tab.title !== title) {
        setTabs((current) => current.map((item) => item.id === tabId ? { ...item, title } : item));
      }
      return;
    }

    const readyStatus = proxySettings.engine === "rammerhead"
      ? "Rammerhead ready"
      : `${proxySettings.engine === "scramjet" ? "Scramjet" : "Ultraviolet"} ready · ${proxySettings.transport}`;
    const proxyRevision = [
      proxySettings.enabled,
      proxySettings.engine,
      proxySettings.transport,
      proxySettings.wispUrl,
      proxyStatus === readyStatus,
    ].join(":");
    navigatedKeys.current.set(tabId, `${proxyRevision}:${destination}`);

    const visitedAt = Date.now();
    saveHistory([{
      id: `history-${visitedAt}-${++historySequence}`,
      title,
      url: destination,
      visitedAt,
    }, ...historyRef.current]);
    setTabs((current) => current.map((item) => item.id === tabId
      ? { ...item, url: destination, draft: destination, title }
      : item));
  }, [
    getOriginalUrl,
    proxySettings.enabled,
    proxySettings.engine,
    proxySettings.transport,
    proxySettings.wispUrl,
    proxyStatus,
    saveHistory,
    tabs,
  ]);

  const handleFrameLoad = useCallback((tabId: string, iframe: HTMLIFrameElement) => {
    let frameDocument: Document | null;
    try {
      frameDocument = iframe.contentDocument;
    } catch {
      return;
    }
    if (!frameDocument) return;

    const handleLinkActivation = (event: MouseEvent) => {
      let target = event.target as HTMLElement | null;
      while (target && target.tagName !== "A") target = target.parentElement;
      if (!target) return;

      const anchor = target as HTMLAnchorElement;
      const opensNewTab = event.ctrlKey
        || event.metaKey
        || event.button === 1
        || anchor.target.toLowerCase() === "_blank";
      if (!opensNewTab) return;

      const destination = getOriginalUrl(tabId, anchor.href);
      if (!destination) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openLinkInTab(destination);
    };

    frameDocument.addEventListener("click", handleLinkActivation, true);
    frameDocument.addEventListener("auxclick", handleLinkActivation, true);
    syncFrameNavigation(tabId, iframe);
  }, [getOriginalUrl, openLinkInTab, syncFrameNavigation]);

  useEffect(() => {
    const navigationPoll = window.setInterval(() => {
      for (const [tabId, iframe] of iframeRefs.current) {
        syncFrameNavigation(tabId, iframe);
      }
    }, 500);
    return () => window.clearInterval(navigationPoll);
  }, [syncFrameNavigation]);

  useEffect(() => {
    const phosphorus = new Phosphorus();
    registerPhosiumExtensions(phosphorus);
    phosphorusRef.current = phosphorus;
    const detachments = detachRefs.current;

    for (const [tabId, iframe] of iframeRefs.current) {
      detachments.set(tabId, phosphorus.attachToIframe(iframe));
    }

    return () => {
      for (const detach of detachments.values()) detach();
      detachments.clear();
    };
  }, []);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "h") return;
      event.preventDefault();
      setHistoryOpen((open) => !open);
      setMenuOpen(false);
      setExtensionsOpen(false);
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, []);

  const filteredHistory = history.filter((entry) =>
    `${entry.title} ${entry.url}`.toLowerCase().includes(historySearch.trim().toLowerCase()),
  );

  useEffect(() => {
    if (phosphorusRef.current) {
      applyPhosiumExtensionStates(phosphorusRef.current, {
        enhancementsEnabled: browserEnhancementsEnabled,
        gamingToolsEnabled: browserGamingToolsEnabled,
        adBlockerEnabled: browserAdBlockerEnabled,
      });
    }
    const previous = extensionStateRef.current;
    const changed = previous.enhancementsEnabled !== browserEnhancementsEnabled
      || previous.gamingToolsEnabled !== browserGamingToolsEnabled
      || previous.adBlockerEnabled !== browserAdBlockerEnabled;
    extensionStateRef.current = {
      enhancementsEnabled: browserEnhancementsEnabled,
      gamingToolsEnabled: browserGamingToolsEnabled,
      adBlockerEnabled: browserAdBlockerEnabled,
    };
    if (!changed) return;

    for (const [tabId, iframe] of iframeRefs.current) {
      const tab = tabs.find((item) => item.id === tabId);
      if (!tab?.url) continue;
      try {
        if (proxySettings.enabled && proxySettings.engine === "scramjet") {
          frameRefs.current.get(tabId)?.reload();
        } else if (proxySettings.enabled) {
          iframe.contentWindow?.location.reload();
        } else {
          // Reloading a browser-controlled frame by URL is intentional.
          // oxlint-disable-next-line react/immutability
          iframe.src = tab.url;
        }
      } catch (error) {
        console.error(`Could not reload browser tab ${tab.title} after changing extensions.`, error);
      }
    }
  }, [
    browserEnhancementsEnabled,
    browserGamingToolsEnabled,
    browserAdBlockerEnabled,
    proxySettings.enabled,
    proxySettings.engine,
    tabs,
  ]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !browserRef.current?.contains(event.target)) {
        setExtensionsOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (proxySettings.enabled && proxySettings.engine === "scramjet" && controller) {
      for (const [tabId, iframe] of iframeRefs.current) {
        if (!frameRefs.current.has(tabId)) {
          frameRefs.current.set(tabId, controller.createFrame(iframe));
        }
      }
    }

    const readyStatus = proxySettings.engine === "rammerhead"
      ? "Rammerhead ready"
      : `${proxySettings.engine === "scramjet" ? "Scramjet" : "Ultraviolet"} ready · ${proxySettings.transport}`;
    const proxyRevision = [
      proxySettings.enabled,
      proxySettings.engine,
      proxySettings.transport,
      proxySettings.wispUrl,
      proxyStatus === readyStatus,
    ].join(":");

    for (const tab of tabs) {
      if (!tab.url) continue;
      const iframe = iframeRefs.current.get(tab.id);
      if (!iframe) continue;

      const routeKey = `${proxyRevision}:${tab.url}`;
      if (navigatedKeys.current.get(tab.id) === routeKey) continue;
      if (proxySettings.enabled && proxyStatus !== readyStatus) continue;
      if (proxySettings.enabled && proxySettings.engine === "scramjet" && !frameRefs.current.has(tab.id)) continue;

      navigatedKeys.current.set(tab.id, routeKey);
      void (async () => {
        try {
          if (!proxySettings.enabled) {
            iframe.src = tab.url;
          } else if (proxySettings.engine === "scramjet") {
            const frame = frameRefs.current.get(tab.id);
            if (!frame) return;
            frame.go(proxyConfig.getProxiedUrl(tab.url, "scramjet"));
          } else if (proxySettings.engine === "ultraviolet") {
            iframe.src = proxyConfig.getProxiedUrl(tab.url, "ultraviolet");
          } else {
            const rammerheadUrl = await encodeRammerheadUrl(tab.url);
            if (navigatedKeys.current.get(tab.id) !== routeKey) return;
            iframe.src = rammerheadUrl;
          }
        } catch (error) {
          if (navigatedKeys.current.get(tab.id) === routeKey) {
            navigatedKeys.current.delete(tab.id);
          }
          console.error(`Could not route browser tab ${tab.title}.`, error);
          // Report routing failures from the proxy/controller effect.
          // oxlint-disable-next-line react/set-state-in-effect
          setNavigationError(error instanceof Error ? error.message : String(error));
        }
      })();
    }
  }, [
    controller,
    proxySettings.enabled,
    proxySettings.engine,
    proxySettings.transport,
    proxySettings.wispUrl,
    proxyStatus,
    tabs,
  ]);

  // The one-shot launch request comes from a separate desktop app.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (!browserRequest || browserRequest.id === lastBrowserRequestId.current) return;
    lastBrowserRequestId.current = browserRequest.id;
    const tab = createTab();
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    navigate(browserRequest.url, tab.id);
  }, [browserRequest, navigate]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(address);
  };

  const handleAddressKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    navigate(event.currentTarget.value);
  };

  const addTab = () => {
    const tab = createTab();
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setNavigationError("");
  };

  useEffect(() => {
    const handleNewTabShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "t") return;
      event.preventDefault();
      const tab = createTab();
      setTabs((current) => [...current, tab]);
      setActiveTabId(tab.id);
      setNavigationError("");
    };
    window.addEventListener("keydown", handleNewTabShortcut);
    return () => window.removeEventListener("keydown", handleNewTabShortcut);
  }, []);

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) {
      const replacement = createTab();
      setTabs([replacement]);
      setActiveTabId(replacement.id);
      return;
    }
    const index = tabs.findIndex((tab) => tab.id === tabId);
    const remaining = tabs.filter((tab) => tab.id !== tabId);
    if (tabId === activeTabId) {
      const nextTab = remaining[Math.max(0, index - 1)];
      setActiveTabId(nextTab.id);
    }
    setTabs(remaining);
  };

  const goHome = () => {
    navigatedKeys.current.delete(activeTabId);
    const iframe = iframeRefs.current.get(activeTabId);
    if (iframe) iframe.src = "about:blank";
    setTabs((current) => current.map((tab) => tab.id === activeTabId
      ? { ...tab, title: "New tab", url: "", draft: "" }
      : tab));
    setNavigationError("");
  };

  const cycleSearchEngine = () => {
    const engines: SearchEngine[] = ["google", "duckduckgo", "bing", "brave"];
    const nextIndex = (engines.indexOf(searchEngine) + 1) % engines.length;
    setSearchEngine(engines[nextIndex]);
  };

  const reload = () => {
    const iframe = iframeRefs.current.get(activeTabId);
    if (!activeTab?.url || !iframe) return;
    if (proxySettings.enabled && proxySettings.engine === "scramjet") {
      frameRefs.current.get(activeTabId)?.reload();
    } else {
      iframe.contentWindow?.location.reload();
    }
  };

  const goBack = () => {
    if (proxySettings.enabled && proxySettings.engine === "scramjet") {
      frameRefs.current.get(activeTabId)?.back();
    } else {
      iframeRefs.current.get(activeTabId)?.contentWindow?.history.back();
    }
  };

  const goForward = () => {
    if (proxySettings.enabled && proxySettings.engine === "scramjet") {
      frameRefs.current.get(activeTabId)?.forward();
    } else {
      iframeRefs.current.get(activeTabId)?.contentWindow?.history.forward();
    }
  };

  return (
    <div className="chrome-browser" ref={browserRef}>
      <div
        className="chrome-tab-strip"
        onWheel={(event) => {
          const tabStrip = event.currentTarget;
          if (tabStrip.scrollWidth <= tabStrip.clientWidth || event.deltaY === 0) return;
          event.preventDefault();
          tabStrip.scrollLeft += event.deltaY || event.deltaX;
        }}
      >
        {tabs.map((tab) => (
          <div
            aria-current={tab.id === activeTabId ? "page" : undefined}
            className={`chrome-tab${tab.id === activeTabId ? " is-active" : ""}`}
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") setActiveTabId(tab.id);
            }}
            role="button"
            tabIndex={0}
          >
            <span className="chrome-tab-favicon">◉</span>
            <span className="chrome-tab-title">{tab.title}</span>
            <button
              aria-label={`Close ${tab.title}`}
              className="chrome-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
              type="button"
            >×</button>
          </div>
        ))}
        <button aria-label="New tab" className="chrome-new-tab" onClick={addTab} type="button">+</button>
      </div>
      <div className="chrome-toolbar">
        <button aria-label="Go back" className="chrome-icon-button" onClick={goBack} type="button">‹</button>
        <button aria-label="Go forward" className="chrome-icon-button" onClick={goForward} type="button">›</button>
        <button aria-label="Reload page" className="chrome-icon-button" onClick={reload} type="button">↻</button>
        <button aria-label="Home" className="chrome-icon-button chrome-home-button" onClick={goHome} type="button">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z" /></svg>
        </button>
        <form className={`chrome-address-form search-engine-${searchEngine}`} onSubmit={handleSubmit}>
          <button
            aria-label={`Change search engine (currently ${searchEngine === "brave" ? "Brave Search" : searchEngine === "duckduckgo" ? "DuckDuckGo" : searchEngine[0].toUpperCase() + searchEngine.slice(1)})`}
            className="chrome-search-engine"
            onClick={cycleSearchEngine}
            title="Click to change search engine"
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
            <span aria-hidden="true">{searchEngine === "google" ? "GGL" : searchEngine === "duckduckgo" ? "DDG" : searchEngine === "bing" ? "BING" : "BRV"}</span>
          </button>
          <span className="chrome-site-indicator">{proxySettings.enabled ? "●" : "○"}</span>
          <input
            aria-label="Address and search bar"
            onChange={(event) => setTabs((current) => current.map((tab) => tab.id === activeTabId
              ? { ...tab, draft: event.target.value }
              : tab))}
            onKeyDown={handleAddressKeyDown}
            placeholder={`Search with ${searchEngine === "duckduckgo" ? "DuckDuckGo" : searchEngine === "brave" ? "Brave" : searchEngine[0].toUpperCase() + searchEngine.slice(1)} or enter a URL`}
            value={address}
          />
          <button aria-label="Go to address" className="chrome-address-submit" type="submit">↵</button>
          <button
            aria-label={bookmarks.some((bookmark) => bookmark.url === activeTab?.url) ? "Remove bookmark" : "Bookmark page"}
            aria-pressed={bookmarks.some((bookmark) => bookmark.url === activeTab?.url)}
            className="chrome-bookmark"
            disabled={!activeTab?.url}
            onClick={toggleBookmark}
            type="button"
          >{bookmarks.some((bookmark) => bookmark.url === activeTab?.url) ? "★" : "☆"}</button>
          </form>
          <div className="chrome-toolbar-action">
            <button
              aria-expanded={extensionsOpen}
              aria-label="Extensions"
              className="chrome-extensions-button"
              onClick={() => {
                setExtensionsOpen((open) => !open);
                setMenuOpen(false);
              }}
              type="button"
            ><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 3a3 3 0 1 1 6 0v2h3a2 2 0 0 1 2 2v3h-2a3 3 0 1 0 0 6h2v3a2 2 0 0 1-2 2h-3v-2a3 3 0 1 0-6 0v2H6a2 2 0 0 1-2-2v-3h2a3 3 0 1 0 0-6H4V7a2 2 0 0 1 2-2h3V3Z" /></svg></button>
            {extensionsOpen && (
              <div aria-label="Extensions" className="chrome-extension-popup" role="dialog">
                <div className="chrome-popup-heading"><strong>Extensions</strong><span>PHOSIUM</span></div>
                <label className="chrome-extension-item">
                  <span className="extension-glyph extension-glyph-page">✦</span>
                  <span><strong>Page enhancements</strong><small>Browser tabs only · scrollbar styling</small></span>
                  <input aria-label="Browser page enhancements extension" checked={browserEnhancementsEnabled} onChange={(event) => toggleExtension("page", event.target.checked)} type="checkbox" />
                </label>
                <label className="chrome-extension-item">
                  <span className="extension-glyph extension-glyph-game">◷</span>
                  <span><strong>Gaming tools</strong><small>Browser tabs only · timer, splits and notes</small></span>
                  <input aria-label="Browser gaming tools extension" checked={browserGamingToolsEnabled} onChange={(event) => toggleExtension("gaming", event.target.checked)} type="checkbox" />
                </label>
                <label className="chrome-extension-item">
                  <span className="extension-glyph extension-glyph-page">⊘</span>
                  <span><strong>Ad blocker</strong><small>Browser tabs only · common ad domains</small></span>
                  <input aria-label="Browser ad blocker extension" checked={browserAdBlockerEnabled} onChange={(event) => toggleExtension("adblock", event.target.checked)} type="checkbox" />
                </label>
                <p className="chrome-popup-note">Extensions run only in proxied browser tabs.</p>
              </div>
            )}
          </div>
          <div className="chrome-toolbar-action">
            <button
              aria-expanded={menuOpen}
              aria-label="Browser menu"
              className="chrome-menu"
              onClick={() => {
                setMenuOpen((open) => !open);
                setExtensionsOpen(false);
              }}
              type="button"
            >⋮</button>
            {menuOpen && (
              <div aria-label="Browser menu" className="chrome-menu-popup" role="menu">
                <button onClick={() => { setMenuOpen(false); addTab(); }} role="menuitem" type="button">New tab <kbd>Ctrl+T</kbd></button>
                <button onClick={() => { setMenuOpen(false); setHistoryOpen(true); setHistorySearch(""); }} role="menuitem" type="button">History <kbd>Ctrl+H</kbd></button>
                <button onClick={toggleBookmarksBar} role="menuitem" type="button">{showBookmarksBar ? "Hide" : "Show"} bookmarks bar</button>
                <button onClick={() => { setMenuOpen(false); setExtensionsOpen(true); }} role="menuitem" type="button">Manage extensions</button>
                <button onClick={() => { setMenuOpen(false); window.dispatchEvent(new CustomEvent("phosium:focus-window", { detail: "settings" })); }} role="menuitem" type="button">Settings</button>
              </div>
            )}
          </div>
      </div>
      {showBookmarksBar && (
          <div aria-label="Bookmarks bar" className="chrome-bookmarks-bar">
            {bookmarks.map((bookmark) => (
              <button key={bookmark.url} onClick={() => navigate(bookmark.url)} title={bookmark.url} type="button">
                <span>◆</span>{bookmark.title}
              </button>
            ))}
            {bookmarks.length === 0 && <span className="chrome-bookmarks-empty">Bookmarks you add will appear here</span>}
            {bookmarkError && <span className="chrome-bookmark-error" role="alert">{bookmarkError}</span>}
          </div>
      )}
      {navigationError && <div className="chrome-error" role="alert">{navigationError}</div>}
      <div className="chrome-page">
        {historyOpen ? (
          <section aria-label="Browsing history" className="chrome-history">
            <header className="chrome-history-header">
              <div><h2>History</h2><span>{history.length} visits saved on this device</span></div>
              <button onClick={() => setHistoryOpen(false)} type="button">Done</button>
            </header>
            <label className="chrome-history-search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Search history"
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search history"
                value={historySearch}
              />
            </label>
            <div className="chrome-history-list">
              {filteredHistory.map((entry) => (
                <div className="chrome-history-entry" key={entry.id}>
                  <button className="chrome-history-visit" onClick={() => navigate(entry.url)} title={entry.url} type="button">
                    <strong>{entry.title}</strong>
                    <span>{entry.url}</span>
                    <time dateTime={new Date(entry.visitedAt).toISOString()}>{new Date(entry.visitedAt).toLocaleString()}</time>
                  </button>
                  <button
                    aria-label={`Remove ${entry.title} from history`}
                    className="chrome-history-remove"
                    onClick={() => saveHistory(history.filter((item) => item.id !== entry.id))}
                    type="button"
                  >×</button>
                </div>
              ))}
              {filteredHistory.length === 0 && (
                <p className="chrome-history-empty">{history.length ? "No history matches your search." : "Pages you visit will appear here."}</p>
              )}
            </div>
            <footer className="chrome-history-footer">
              {historyError && <span role="alert">{historyError}</span>}
              <button disabled={history.length === 0} onClick={() => saveHistory([])} type="button">Clear browsing history</button>
            </footer>
          </section>
        ) : (
          <>
            {tabs.map((tab) => (
              <BrowserFrame
                active={tab.id === activeTabId}
                key={tab.id}
                onFrameChange={handleFrameChange}
                onFrameLoad={handleFrameLoad}
                tab={tab}
              />
            ))}
            {!activeTab?.url && (
              <div className="chrome-new-tab-page">
                <div className="chrome-google-mark">Phosium</div>
                <form className="chrome-search-form" onSubmit={handleSubmit}>
                  <span>⌕</span>
                  <input
                    aria-label="Search the web"
                    onChange={(event) => setTabs((current) => current.map((tab) => tab.id === activeTabId
                      ? { ...tab, draft: event.target.value }
                      : tab))}
                    placeholder={`Search with ${searchEngine === "duckduckgo" ? "DuckDuckGo" : searchEngine === "brave" ? "Brave" : searchEngine[0].toUpperCase() + searchEngine.slice(1)} or enter a URL`}
                    value={address}
                  />
                  <button aria-label="Search" type="submit">↵</button>
                </form>
                <div className="chrome-new-tab-hint">
                  {proxySettings.enabled
                    ? proxyStatus
                    : "Proxy disabled · browsing directly"}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className="chrome-statusbar">
        <span>{proxySettings.enabled ? `Protected by ${proxySettings.engine}` : "Direct connection"}</span>
        <span>{browserGamingToolsEnabled ? "Gaming tools enabled" : browserEnhancementsEnabled ? "Phosphorous enabled" : "Phosphorous disabled"}</span>
      </div>
    </div>
  );
}
