import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { Phosphorus } from "phosphorous";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import { proxyConfig } from "@repo/proxy";
import { PhosiumIcon } from "@repo/os-shell";
import { applyPhosiumExtensionStates, registerPhosiumExtensions } from "../../extensions/phosphorousExtensions";
import { decodeScramjetAddress, resolveAddress } from "../../lib/browser/address";
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
const quickAccessKey = "phosium_quick_access_sites";

interface QuickAccessSite {
  id: string;
  title: string;
  url: string;
}

interface BookmarkContextMenu {
  bookmark: BrowserBookmark;
  x: number;
  y: number;
}

const defaultQuickAccessSites: QuickAccessSite[] = [
  { id: "qa-youtube", title: "YOUTUBE", url: "https://www.youtube.com" },
  { id: "qa-discord", title: "DISCORD", url: "https://discord.com/app" },
  { id: "qa-instagram", title: "INSTAGRAM", url: "https://www.instagram.com" },
  { id: "qa-tiktok", title: "TIKTOK", url: "https://www.tiktok.com" },
  { id: "qa-spotify", title: "SPOTIFY", url: "https://open.spotify.com" },
  { id: "qa-twitch", title: "TWITCH", url: "https://www.twitch.tv" },
];

function loadQuickAccessSites(): QuickAccessSite[] {
  try {
    const stored = localStorage.getItem(quickAccessKey);
    if (!stored) return defaultQuickAccessSites;
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return defaultQuickAccessSites;
    return parsed.filter((item): item is QuickAccessSite =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      typeof item.id === "string" &&
      "title" in item &&
      typeof item.title === "string" &&
      "url" in item &&
      typeof item.url === "string"
    );
  } catch (error) {
    console.error("Could not load quick access sites.", error);
    return defaultQuickAccessSites;
  }
}

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
    phosphorousEnabled,
    browserTheme,
    externalExtensions,
    browserEnhancementsEnabled,
    browserGamingToolsEnabled,
    browserAdBlockerEnabled,
    setBrowserGamingToolsEnabled,
    setBrowserEnhancementsEnabled,
    setBrowserAdBlockerEnabled,
    setExternalExtensions,
    browserRequest,
    searchEngine,
    setSearchEngine,
    panicKeyEnabled,
    panicKey,
  } = useSystem();
  const [firstTab] = useState(() => createTab());
  const [tabs, setTabs] = useState<BrowserTab[]>([firstTab]);
  const [activeTabId, setActiveTabId] = useState(firstTab.id);
  const [navigationError, setNavigationError] = useState("");
  const [bookmarks, setBookmarks] = useState<BrowserBookmark[]>(loadBookmarks);
  const [quickAccessSites, setQuickAccessSites] = useState<QuickAccessSite[]>(loadQuickAccessSites);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newQaTitle, setNewQaTitle] = useState("");
  const [newQaUrl, setNewQaUrl] = useState("");
  const [activeMenuSiteId, setActiveMenuSiteId] = useState<string | null>(null);
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
  const [bookmarkContextMenu, setBookmarkContextMenu] = useState<BookmarkContextMenu | null>(null);
  const [editingBookmark, setEditingBookmark] = useState<BrowserBookmark | null>(null);
  const [bookmarkTitleDraft, setBookmarkTitleDraft] = useState("");
  const [bookmarkUrlDraft, setBookmarkUrlDraft] = useState("");
  const browserRef = useRef<HTMLDivElement>(null);
  const iframeRefs = useRef(new Map<string, HTMLIFrameElement>());
  const frameRefs = useRef(new Map<string, Frame>());
  const phosphorusRef = useRef<Phosphorus | null>(null);
  const panicSettingsRef = useRef({ enabled: panicKeyEnabled, key: panicKey });
  const panicKeyDocumentsRef = useRef(new WeakSet<Document>());
  const extensionStateRef = useRef({
    phosphorousEnabled,
    enhancementsEnabled: browserEnhancementsEnabled,
    gamingToolsEnabled: browserGamingToolsEnabled,
    adBlockerEnabled: browserAdBlockerEnabled,
    externalExtensions,
  });

  useEffect(() => {
    panicSettingsRef.current = { enabled: panicKeyEnabled, key: panicKey };
  }, [panicKeyEnabled, panicKey]);
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

  const saveQuickAccess = useCallback((nextSites: QuickAccessSite[]) => {
    try {
      localStorage.setItem(quickAccessKey, JSON.stringify(nextSites));
      setQuickAccessSites(nextSites);
    } catch (error) {
      console.error("Could not save quick access sites.", error);
    }
  }, []);

  const handleAddQuickAccess = (e: FormEvent) => {
    e.preventDefault();
    if (!newQaUrl.trim()) return;
    const formattedUrl = resolveAddress(newQaUrl, searchEngine);
    let title = newQaTitle.trim();
    if (!title) {
      try {
        title = new URL(formattedUrl).hostname.toUpperCase();
      } catch {
        title = "SITE";
      }
    }
    const newSite: QuickAccessSite = {
      id: `qa-${Date.now()}`,
      title,
      url: formattedUrl,
    };
    saveQuickAccess([...quickAccessSites, newSite]);
    setNewQaTitle("");
    setNewQaUrl("");
    setIsAddModalOpen(false);
  };

  const deleteQuickAccessSite = (id: string) => {
    saveQuickAccess(quickAccessSites.filter((site) => site.id !== id));
    setActiveMenuSiteId(null);
  };

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

  const toggleExternalExtension = (id: string, enabled: boolean) => {
    setExternalExtensions(externalExtensions.map((extension) =>
      extension.id === id ? { ...extension, enabled } : extension,
    ));
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
      if (proxySettings.engine === "scramjet") {
        const frame = frameRefs.current.get(tabId);
        if (frame) {
          targetUrl = decodeScramjetAddress(
            targetUrl,
            window.location.href,
            frame.prefix,
            (encodedTarget) => frame.context.interface.codecDecode(encodedTarget),
          );
        }
      } else if (proxySettings.engine === "ultraviolet") {
        const parsedUrl = new URL(targetUrl, window.location.href);
        const servicePrefix = "/uv/service/";
        if (parsedUrl.pathname.startsWith(servicePrefix)) {
          targetUrl = decodeURIComponent(parsedUrl.pathname.slice(servicePrefix.length))
            + parsedUrl.search
            + parsedUrl.hash;
        }
      } else if (proxySettings.engine === "rammerhead") {
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
  }, [proxySettings.engine]);

  const getCurrentBookmarkTarget = useCallback((): { url: string; title: string } | null => {
    if (!activeTab?.url) return null;
    const iframe = iframeRefs.current.get(activeTab.id);
    let frameUrl = activeTab.url;
    let pageTitle = activeTab.title;
    try {
      if (iframe?.contentWindow) {
        frameUrl = iframe.contentWindow.location.href;
        pageTitle = iframe.contentDocument?.title || pageTitle;
      }
    } catch {
      // The tab URL remains the last known destination when the frame is cross-origin.
    }

    const decodedUrl = getOriginalUrl(activeTab.id, frameUrl);
    let targetUrl = decodedUrl ?? activeTab.url;
    try {
      const framePrefix = frameRefs.current.get(activeTab.id)?.prefix;
      const isLocalProxyRoute = (rawUrl: string) => {
        const current = new URL(rawUrl, window.location.href);
        return current.origin === window.location.origin
          && (current.pathname.startsWith("/uv/service/")
            || isRammerheadProxyUrl(current.href)
            || (framePrefix !== undefined
              && current.pathname.startsWith(new URL(framePrefix, window.location.href).pathname)));
      };
      if (!decodedUrl && (isLocalProxyRoute(frameUrl) || isLocalProxyRoute(targetUrl))) return null;
      const current = new URL(targetUrl, window.location.href);
      if (current.protocol !== "http:" && current.protocol !== "https:") return null;
      targetUrl = current.href;
      if (!pageTitle || pageTitle === "localhost" || pageTitle === window.location.hostname) {
        pageTitle = current.hostname;
      }
    } catch {
      return null;
    }
    return { url: targetUrl, title: pageTitle };
  }, [activeTab, getOriginalUrl]);

  const toggleBookmark = () => {
    const target = getCurrentBookmarkTarget();
    if (!target) {
      setBookmarkError("Could not decode this page's address to a bookmark.");
      return;
    }
    const existing = bookmarks.some((bookmark) => bookmark.url === target.url);
    saveBookmarks(existing
      ? bookmarks.filter((bookmark) => bookmark.url !== target.url)
      : [...bookmarks, target]);
  };

  const saveEditedBookmark = (event: FormEvent) => {
    event.preventDefault();
    if (!editingBookmark) return;
    try {
      const url = resolveAddress(bookmarkUrlDraft, searchEngine);
      const updatedBookmark = { title: bookmarkTitleDraft.trim() || new URL(url).hostname, url };
      saveBookmarks(bookmarks.map((bookmark) => bookmark.url === editingBookmark.url ? updatedBookmark : bookmark));
      setEditingBookmark(null);
    } catch (error) {
      setBookmarkError(error instanceof Error ? error.message : "Could not update bookmark.");
    }
  };

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
    const destinationHost = new URL(destination).hostname;
    if (!title || title === "localhost" || title === window.location.hostname) title = destinationHost;
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
    if (!panicKeyDocumentsRef.current.has(frameDocument)) {
      frameDocument.addEventListener("keydown", (event) => {
        const panic = panicSettingsRef.current;
        if (!panic.enabled || event.key !== panic.key) return;
        const target = event.target as Element | null;
        if (target?.closest("input, textarea, select, [contenteditable]")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.dispatchEvent(new Event("phosium:panic-toggle"));
      });
      panicKeyDocumentsRef.current.add(frameDocument);
    }
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
    if (!phosphorousEnabled) return;

    const phosphorus = new Phosphorus();
    registerPhosiumExtensions(phosphorus, externalExtensions);
    phosphorusRef.current = phosphorus;
    const detachments = detachRefs.current;

    for (const [tabId, iframe] of iframeRefs.current) {
      detachments.set(tabId, phosphorus.attachToIframe(iframe));
    }

    return () => {
      for (const detach of detachments.values()) detach();
      detachments.clear();
      phosphorusRef.current = null;
    };
  }, [phosphorousEnabled, externalExtensions]);

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== "h") return;
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
        phosphorousEnabled,
        externalExtensions,
      });
    }
    const previous = extensionStateRef.current;
    const changed = previous.phosphorousEnabled !== phosphorousEnabled
      || previous.enhancementsEnabled !== browserEnhancementsEnabled
      || previous.gamingToolsEnabled !== browserGamingToolsEnabled
      || previous.adBlockerEnabled !== browserAdBlockerEnabled
      || previous.externalExtensions !== externalExtensions;
    extensionStateRef.current = {
      phosphorousEnabled,
      enhancementsEnabled: browserEnhancementsEnabled,
      gamingToolsEnabled: browserGamingToolsEnabled,
      adBlockerEnabled: browserAdBlockerEnabled,
      externalExtensions,
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
    phosphorousEnabled,
    browserEnhancementsEnabled,
    browserGamingToolsEnabled,
    browserAdBlockerEnabled,
    externalExtensions,
    proxySettings.enabled,
    proxySettings.engine,
    tabs,
  ]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!browserRef.current?.contains(event.target)) {
        setExtensionsOpen(false);
        setMenuOpen(false);
        setActiveMenuSiteId(null);
      }
      if (!(event.target instanceof Element) || !event.target.closest(".chrome-bookmark-context-menu")) {
        setBookmarkContextMenu(null);
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

  const openBookmark = (rawUrl: string) => {
    const decodedUrl = activeTab ? getOriginalUrl(activeTab.id, rawUrl) : null;
    try {
      const savedUrl = new URL(rawUrl, window.location.href);
      const framePrefix = activeTab ? frameRefs.current.get(activeTab.id)?.prefix : undefined;
      const isLocalProxyRoute = savedUrl.origin === window.location.origin
        && (savedUrl.pathname.startsWith("/uv/service/")
          || isRammerheadProxyUrl(savedUrl.href)
          || (framePrefix !== undefined
            && savedUrl.pathname.startsWith(new URL(framePrefix, window.location.href).pathname)));
      if (isLocalProxyRoute && !decodedUrl) {
        setNavigationError("Could not decode this bookmark with the selected proxy.");
        return;
      }
    } catch {
      setNavigationError("This bookmark has an invalid address.");
      return;
    }
    navigate(decodedUrl ?? rawUrl);
  };

  const isActiveTabBookmarked = Boolean(
    activeTab?.url && bookmarks.some((bookmark) => bookmark.url === activeTab.url),
  );

  return (
    <div className="chrome-browser" data-browser-theme={browserTheme} ref={browserRef}>
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
            <span className="chrome-tab-favicon"><PhosiumIcon name="globe" /></span>
            <span className="chrome-tab-title">{tab.title}</span>
            <button
              aria-label={`Close ${tab.title}`}
              className="chrome-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                closeTab(tab.id);
              }}
              type="button"
            ><PhosiumIcon name="x" /></button>
          </div>
        ))}
        <button aria-label="New tab" className="chrome-new-tab" onClick={addTab} type="button"><PhosiumIcon name="plus" /></button>
      </div>
      <div className="chrome-toolbar">
        <button aria-label="Go back" className="chrome-icon-button" onClick={goBack} type="button"><PhosiumIcon name="chevron-left" /></button>
        <button aria-label="Go forward" className="chrome-icon-button" onClick={goForward} type="button"><PhosiumIcon name="chevron-right" /></button>
        <button aria-label="Reload page" className="chrome-icon-button" onClick={reload} type="button"><PhosiumIcon name="rotate-cw" /></button>
        <button aria-label="Home" className="chrome-icon-button chrome-home-button" onClick={goHome} type="button">
          <PhosiumIcon name="home" />
        </button>
        <form className={`chrome-address-form search-engine-${searchEngine}`} onSubmit={handleSubmit}>
          <button
            aria-label={`Change search engine (currently ${searchEngine === "brave" ? "Brave Search" : searchEngine === "duckduckgo" ? "DuckDuckGo" : searchEngine[0].toUpperCase() + searchEngine.slice(1)})`}
            className="chrome-search-engine"
            onClick={cycleSearchEngine}
            title="Click to change search engine"
            type="button"
          >
            <PhosiumIcon name="search" />
            <span aria-hidden="true">{searchEngine === "google" ? "GGL" : searchEngine === "duckduckgo" ? "DDG" : searchEngine === "bing" ? "BING" : "BRV"}</span>
          </button>
          <PhosiumIcon className={`chrome-site-indicator${proxySettings.enabled ? " is-protected" : ""}`} name={proxySettings.enabled ? "shield-check" : "globe"} size={14} />
          <input
            aria-label="Address and search bar"
            onChange={(event) => setTabs((current) => current.map((tab) => tab.id === activeTabId
              ? { ...tab, draft: event.target.value }
              : tab))}
            onKeyDown={handleAddressKeyDown}
            placeholder={`Search with ${searchEngine === "duckduckgo" ? "DuckDuckGo" : searchEngine === "brave" ? "Brave" : searchEngine[0].toUpperCase() + searchEngine.slice(1)} or enter a URL`}
            value={address}
          />
          <button aria-label="Go to address" className="chrome-address-submit" type="submit"><PhosiumIcon name="corner-down-left" /></button>
          <button
            aria-label={isActiveTabBookmarked ? "Remove bookmark" : "Bookmark page"}
            aria-pressed={isActiveTabBookmarked}
            className="chrome-bookmark"
            disabled={!activeTab?.url}
            onClick={toggleBookmark}
            type="button"
          ><PhosiumIcon name="star" className={isActiveTabBookmarked ? "is-bookmarked" : undefined} /></button>
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
          ><PhosiumIcon name="puzzle" /></button>
          {extensionsOpen && (
            <div aria-label="Extensions" className="chrome-extension-popup" role="dialog">
              <div className="chrome-popup-heading"><strong>Extensions</strong><span>PHOSIUM</span></div>
              <label className="chrome-extension-item">
                <span className="extension-glyph extension-glyph-page"><PhosiumIcon name="sparkles" /></span>
                <span><strong>Page enhancements</strong><small>Browser tabs only · scrollbar styling</small></span>
                <input aria-label="Browser page enhancements extension" checked={browserEnhancementsEnabled} disabled={!phosphorousEnabled} onChange={(event) => toggleExtension("page", event.target.checked)} type="checkbox" />
              </label>
              <label className="chrome-extension-item">
                <span className="extension-glyph extension-glyph-game"><PhosiumIcon name="clock-3" /></span>
                <span><strong>Gaming tools</strong><small>Browser tabs only · timer, splits and notes</small></span>
                <input aria-label="Browser gaming tools extension" checked={browserGamingToolsEnabled} disabled={!phosphorousEnabled} onChange={(event) => toggleExtension("gaming", event.target.checked)} type="checkbox" />
              </label>
              <label className="chrome-extension-item">
                <span className="extension-glyph extension-glyph-page"><PhosiumIcon name="shield-check" /></span>
                <span><strong>Ad blocker</strong><small>Browser tabs only · common ad domains</small></span>
                <input aria-label="Browser ad blocker extension" checked={browserAdBlockerEnabled} disabled={!phosphorousEnabled} onChange={(event) => toggleExtension("adblock", event.target.checked)} type="checkbox" />
              </label>
              {externalExtensions.length > 0 && (
                <>
                  <div className="chrome-extension-section-heading">External extensions</div>
                  {externalExtensions.map((extension) => (
                    <label className="chrome-extension-item" key={extension.id}>
                      <span className="extension-glyph extension-glyph-external"><PhosiumIcon name="command" /></span>
                      <span>
                        <strong>{extension.name}</strong>
                        <small>{extension.type?.toUpperCase() ?? "EXTENSION"} · {extension.id}</small>
                      </span>
                      <input
                        aria-label={`Browser ${extension.name} extension`}
                        checked={extension.enabled}
                        disabled={!phosphorousEnabled}
                        onChange={(event) => toggleExternalExtension(extension.id, event.target.checked)}
                        type="checkbox"
                      />
                    </label>
                  ))}
                </>
              )}
              <p className="chrome-popup-note">{phosphorousEnabled ? "Extensions run only in proxied browser tabs." : "Phosphorous is turned off in Settings."}</p>
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
          ><PhosiumIcon name="ellipsis" /></button>
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
            <button
              key={bookmark.url}
              onClick={() => openBookmark(bookmark.url)}
              onContextMenu={(event) => {
                event.preventDefault();
                const bounds = browserRef.current?.getBoundingClientRect();
                if (!bounds) return;
                setBookmarkContextMenu({
                  bookmark,
                  x: event.clientX - bounds.left,
                  y: event.clientY - bounds.top,
                });
              }}
              title={bookmark.url}
              type="button"
            >
              <PhosiumIcon name="bookmark" />{bookmark.title}
            </button>
          ))}
          {bookmarks.length === 0 && <span className="chrome-bookmarks-empty">Bookmarks you add will appear here</span>}
          {bookmarkError && <span className="chrome-bookmark-error" role="alert">{bookmarkError}</span>}
        </div>
      )}
      {bookmarkContextMenu && (
        <div
          className="chrome-bookmark-context-menu"
          role="menu"
          style={{ left: bookmarkContextMenu.x, top: bookmarkContextMenu.y }}
        >
          <button role="menuitem" type="button" onClick={() => {
            setBookmarkTitleDraft(bookmarkContextMenu.bookmark.title);
            setBookmarkUrlDraft(bookmarkContextMenu.bookmark.url);
            setEditingBookmark(bookmarkContextMenu.bookmark);
            setBookmarkContextMenu(null);
          }}>Edit bookmark</button>
          <button role="menuitem" type="button" onClick={() => {
            saveBookmarks(bookmarks.filter((bookmark) => bookmark.url !== bookmarkContextMenu.bookmark.url));
            setBookmarkContextMenu(null);
          }}>Delete bookmark</button>
        </div>
      )}
      {editingBookmark && (
        <div className="chrome-qa-modal-overlay">
          <form className="chrome-qa-modal" onSubmit={saveEditedBookmark}>
            <h3>Edit bookmark</h3>
            <input
              aria-label="Bookmark title"
              onChange={(event) => setBookmarkTitleDraft(event.target.value)}
              placeholder="Bookmark title"
              value={bookmarkTitleDraft}
            />
            <input
              aria-label="Bookmark URL"
              onChange={(event) => setBookmarkUrlDraft(event.target.value)}
              placeholder="https://example.com"
              required
              value={bookmarkUrlDraft}
            />
            {bookmarkError && <span className="chrome-bookmark-error" role="alert">{bookmarkError}</span>}
            <div className="chrome-qa-modal-actions">
              <button onClick={() => setEditingBookmark(null)} type="button">Cancel</button>
              <button className="primary" type="submit">Save bookmark</button>
            </div>
          </form>
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
              <PhosiumIcon name="search" />
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
                  ><PhosiumIcon name="x" /></button>
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
                  <PhosiumIcon name="search" />
                  <input
                    aria-label="Search the web"
                    onChange={(event) => setTabs((current) => current.map((tab) => tab.id === activeTabId
                      ? { ...tab, draft: event.target.value }
                      : tab))}
                    placeholder={`Search with ${searchEngine === "duckduckgo" ? "DuckDuckGo" : searchEngine === "brave" ? "Brave" : searchEngine[0].toUpperCase() + searchEngine.slice(1)} or enter a URL`}
                    value={address}
                  />
                  <button aria-label="Search" type="submit"><PhosiumIcon name="corner-down-left" /></button>
                </form>

                {/* Quick Access Sites Grid */}
                <div className="chrome-quick-access-container">
                  <div className="chrome-quick-access-grid">
                    {quickAccessSites.map((site) => {
                      let domain = "";
                      try {
                        domain = new URL(site.url).hostname;
                      } catch {
                        domain = site.url;
                      }
                      const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

                      return (
                        <div key={site.id} className="chrome-quick-access-wrapper">
                          <button
                            className="chrome-quick-access-item"
                            onClick={() => navigate(site.url)}
                            type="button"
                          >
                            <div className="chrome-quick-access-icon">
                              <img
                                src={faviconUrl}
                                alt=""
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const parent = e.currentTarget.parentElement;
                                  if (parent && !parent.querySelector(".qa-fallback")) {
                                    const span = document.createElement("span");
                                    span.className = "qa-fallback";
                                    span.textContent = site.title.charAt(0);
                                    parent.appendChild(span);
                                  }
                                }}
                              />
                            </div>
                            <span className="chrome-quick-access-label">{site.title}</span>
                          </button>
                          <button
                            className="chrome-qa-menu-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuSiteId(activeMenuSiteId === site.id ? null : site.id);
                            }}
                            type="button"
                            aria-label="Options"
                          >
                            <PhosiumIcon name="ellipsis" />
                          </button>
                          {activeMenuSiteId === site.id && (
                            <div className="chrome-qa-context-menu">
                              <button
                                onClick={() => deleteQuickAccessSite(site.id)}
                                type="button"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="chrome-quick-access-wrapper">
                      <button
                        className="chrome-quick-access-item chrome-quick-access-add"
                        onClick={() => setIsAddModalOpen(true)}
                        type="button"
                        title="Add quick access site"
                      >
                        <div className="chrome-quick-access-icon">
                          <PhosiumIcon name="plus" className="chrome-qa-plus-icon" size={24} />
                        </div>
                        <span className="chrome-quick-access-label">ADD</span>
                      </button>
                    </div>
                  </div>
                </div>

                {isAddModalOpen && (
                  <div className="chrome-qa-modal-overlay">
                    <form className="chrome-qa-modal" onSubmit={handleAddQuickAccess}>
                      <h3>Add Quick Access Site</h3>
                      <input
                        type="text"
                        placeholder="Site Title (e.g. YouTube)"
                        value={newQaTitle}
                        onChange={(e) => setNewQaTitle(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="URL (e.g. https://youtube.com)"
                        value={newQaUrl}
                        onChange={(e) => setNewQaUrl(e.target.value)}
                        required
                      />
                      <div className="chrome-qa-modal-actions">
                        <button type="button" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                        <button type="submit" className="primary">Add</button>
                      </div>
                    </form>
                  </div>
                )}

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
        <span>{phosphorousEnabled ? "Phosphorous enabled" : "Phosphorous disabled"}</span>
      </div>
    </div>
  );
}