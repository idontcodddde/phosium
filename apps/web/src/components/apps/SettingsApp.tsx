import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { DesktopTheme } from "../../SystemContext";
import { CLOAK_OPTIONS, getCustomCloakConfig, setCustomCloakConfig, applyCloak, launchAboutBlank, launchBlob } from "../../lib/cloak";
import type { CloakOption } from "../../lib/cloak";
import { useSystem } from "../../SystemContext";
import { PhosiumIcon } from "@repo/os-shell";
import { parseExternalPhosiumExtension } from "../../extensions/phosphorousExtensions";
import { appConfig } from "../../../app.config";
import { defaultConfigDev } from "@mercuryworkshop/scramjet";
import type { ScramjetFlags } from "@mercuryworkshop/scramjet";
import type { ProxyEngineType, ProxyTransportType } from "@repo/proxy";

interface WispServer {
  id: string;
  name: string;
  url: string;
  ping: number | null;
  isCustom?: boolean;
  isLocal?: boolean;
}

interface SettingsProfile {
  id: string;
  name: string;
  settings: Record<string, unknown>;
}

const PRESET_SWATCHES = [
  "#0f1117", "#181b24", "#1e2230", "#212532", "#2a2f3e", "#3b82f6",
  "#6366f1", "#818cf8", "#ec4899", "#10b981", "#f59e0b", "#ef4444",
  "#ffffff", "#000000", "#111827", "#1f2937", "#374151", "#4b5563"
];

function CustomColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleHexChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange(val);
    }
  };

  return (
    <div className="custom-palette-field" ref={containerRef} style={{ position: "relative" }}>
      <span>{label}</span>
      <button
        type="button"
        className="custom-color-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="custom-color-swatch-preview" style={{ backgroundColor: value }} />
        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{value.toUpperCase()}</span>
      </button>

      {isOpen && (
        <div className="custom-color-popover">
          <div className="custom-color-popover-header">Presets</div>
          <div className="custom-color-presets">
            {PRESET_SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                className="custom-color-preset-btn"
                style={{ backgroundColor: hex }}
                onClick={() => {
                  onChange(hex);
                  setHexInput(hex);
                  setIsOpen(false);
                }}
              />
            ))}
          </div>
          <div className="custom-color-hex-row">
            <span>HEX</span>
            <input
              type="text"
              className="custom-color-hex-input"
              value={hexInput}
              onChange={handleHexChange}
              maxLength={7}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const scramjetFlagLabels: Record<keyof ScramjetFlags, string> = {
  syncxhr: "Synchronous XHR",
  disableComputedWrap: "Disable computed wrapping",
  rewriterLogs: "Rewriter logs",
  captureErrors: "Capture errors",
  cleanErrors: "Clean errors",
  scramitize: "Scramitize",
  sourcemaps: "Source maps",
  destructureRewrites: "Destructure rewrites",
  allowInvalidJs: "Allow invalid JavaScript",
  allowFailedIntercepts: "Allow failed intercepts",
  debugTrampolines: "Debug trampolines",
  debugSourceURL: "Debug source URLs",
  encapsulateWorkers: "Encapsulate workers",
};

function defaultWispUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/wisp/`;
}

function getSavedWispServers(): WispServer[] {
  const localUrl = defaultWispUrl();
  try {
    const saved = localStorage.getItem("phosium_wisp_servers");
    if (saved) {
      const parsed: WispServer[] = JSON.parse(saved);
      if (parsed.some((server) => server.isLocal)) {
        return parsed.map((server) => server.isLocal ? { ...server, url: localUrl } : server);
      }
      return [
        { id: "local-host", name: "Local Host Wisp", url: localUrl, ping: null, isLocal: true },
        ...parsed,
      ];
    }
  } catch (error) {
    console.error("Unable to load saved Wisp servers:", error);
  }

  return [{ id: "local-host", name: "Local Host Wisp", url: localUrl, ping: null, isLocal: true }];
}

function ResetButton({ setting, onReset }: { setting: string; onReset: () => void }) {
  return (
    <button
      aria-label={`Reset ${setting}`}
      className="settings-reset-button"
      onClick={onReset}
      type="button"
    >
      Reset
    </button>
  );
}

function SignalIcon({ ping }: { ping: number | null }) {
  const color = ping === null || ping >= 600
    ? "#f87171"
    : ping < 300
      ? "#4ade80"
      : "#fbbf24";
  return <PhosiumIcon name="wifi" size={20} style={{ flexShrink: 0, color }} />;
}

function measurePing(url: string): Promise<number> {
  return new Promise((resolve) => {
    const startTime = performance.now();
    try {
      const ws = new WebSocket(url);
      let finished = false;
      const cleanup = (latency: number) => {
        if (finished) return;
        finished = true;
        try {
          ws.close();
        } catch (error) {
          console.error("Unable to close Wisp ping connection:", error);
        }
        resolve(latency);
      };

      ws.onopen = () => cleanup(Math.round(performance.now() - startTime));
      ws.onerror = () => cleanup(999);
      setTimeout(() => cleanup(999), 3500);
    } catch (error) {
      console.error("Unable to test Wisp server:", error);
      resolve(999);
    }
  });
}

function triggerJsonDownload(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SettingsApp() {
  const {
    theme,
    setTheme,
    browserTheme,
    setBrowserTheme,
    wallpaper,
    setWallpaper,
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
    proxySettings,
    updateProxySettings,
    proxyStatus,
    scramjetFlags,
    updateScramjetFlags,
  } = useSystem();

  const [activeTab, setActiveTab] = useState<string>("appearance");
  const [panicDestinationDraft, setPanicDestinationDraft] = useState(panicUrl);
  const [panicDestinationError, setPanicDestinationError] = useState("");
  const [isCapturingPanicKey, setIsCapturingPanicKey] = useState(false);
  const [wallpaperError, setWallpaperError] = useState("");
  const [externalExtensionError, setExternalExtensionError] = useState("");
  const [externalExtensionUrl, setExternalExtensionUrl] = useState("");
  const [isLoadingExternalExtension, setIsLoadingExternalExtension] = useState(false);

  // Custom Cloak states
  const [customCloakTitleDraft, setCustomCloakTitleDraft] = useState(() => getCustomCloakConfig().title);
  const [customCloakIconDraft, setCustomCloakIconDraft] = useState(() => getCustomCloakConfig().favicon);
  const [customCloakAppliedMsg, setCustomCloakAppliedMsg] = useState("");

  // Custom Theme Palette states
  const [customBg, setCustomBg] = useState(() => localStorage.getItem("phosium_custom_bg") || "#0f1117");
  const [customSurface, setCustomSurface] = useState(() => localStorage.getItem("phosium_custom_surface") || "#181b24");
  const [customAccent, setCustomAccent] = useState(() => localStorage.getItem("phosium_custom_accent") || "#818cf8");
  const [customText, setCustomText] = useState(() => localStorage.getItem("phosium_custom_text") || "#f1f5f9");

  // User-Agent custom setting state
  const [userAgentProfile, setUserAgentProfile] = useState<string>(() => {
    return localStorage.getItem("phosium_user_agent_profile") || "default";
  });

  // Proxy states
  const [wispServers, setWispServers] = useState<WispServer[]>(getSavedWispServers);
  const [isAddingWisp, setIsAddingWisp] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [addError, setAddError] = useState("");
  const [flagsError, setFlagsError] = useState("");
  const [profileStatusError, setProfileStatusError] = useState("");
  const [profileStatusMessage, setProfileStatusMessage] = useState("");

  const handleUserAgentChange = (preset: string) => {
    setUserAgentProfile(preset);
    localStorage.setItem("phosium_user_agent_profile", preset);
    window.dispatchEvent(new Event("phosium:user-agent-updated"));
  };

  const handleApplyCustomCloak = () => {
    setCustomCloakConfig({
      title: customCloakTitleDraft,
      favicon: customCloakIconDraft,
    });
    if (cloak === "custom") {
      applyCloak("custom");
    }
    setCustomCloakAppliedMsg("Custom cloak applied successfully!");
    setTimeout(() => setCustomCloakAppliedMsg(""), 3000);
  };

  const handleSaveCustomPalette = (bg: string, surface: string, accent: string, text: string) => {
    const palette = { bg, surface, accent, text };
    localStorage.setItem("phosium_custom_palette", JSON.stringify(palette));
    localStorage.setItem("phosium_custom_bg", bg);
    localStorage.setItem("phosium_custom_surface", surface);
    localStorage.setItem("phosium_custom_accent", accent);
    localStorage.setItem("phosium_custom_text", text);
    window.dispatchEvent(new Event("phosium:custom-palette-updated"));
  };

  const collectCurrentSettings = useCallback(() => ({
    theme,
    browserTheme,
    wallpaper,
    phosphorousEnabled,
    browserEnhancementsEnabled,
    browserGamingToolsEnabled,
    browserAdBlockerEnabled,
    gameEnhancementsEnabled,
    gameGamingToolsEnabled,
    gameAdBlockerEnabled,
    externalExtensions,
    searchEngine,
    cloak,
    autoLaunchMode,
    panicKeyEnabled,
    panicKey,
    panicUrl,
    proxySettings,
    scramjetFlags,
    userAgentProfile,
    customCloakTitle: customCloakTitleDraft,
    customCloakIcon: customCloakIconDraft,
    customBg,
    customSurface,
    customAccent,
    customText,
    wispServers: wispServers.filter((s) => !s.isLocal),
  }), [
    theme,
    browserTheme,
    wallpaper,
    phosphorousEnabled,
    browserEnhancementsEnabled,
    browserGamingToolsEnabled,
    browserAdBlockerEnabled,
    gameEnhancementsEnabled,
    gameGamingToolsEnabled,
    gameAdBlockerEnabled,
    externalExtensions,
    searchEngine,
    cloak,
    autoLaunchMode,
    panicKeyEnabled,
    panicKey,
    panicUrl,
    proxySettings,
    scramjetFlags,
    userAgentProfile,
    customCloakTitleDraft,
    customCloakIconDraft,
    customBg,
    customSurface,
    customAccent,
    customText,
    wispServers,
  ]);

  // Profiles states (persisted with active profile ID)
  const [activeProfileId, setActiveProfileId] = useState<string>(() => {
    return localStorage.getItem("phosium_active_profile_id") || "default";
  });

  const [profiles, setProfiles] = useState<SettingsProfile[]>(() => {
    try {
      const saved = localStorage.getItem("phosium_settings_profiles");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error("Could not load profiles", e);
    }
    return [{
      id: "default",
      name: "Default Profile",
      settings: {},
    }];
  });

  const [newProfileName, setNewProfileName] = useState("");
  const testingServerIdsRef = useRef(new Set<string>());
  const isSwitchingProfileRef = useRef(false);

  useEffect(() => {
    if (isSwitchingProfileRef.current) return;
    const currentSnapshot = collectCurrentSettings();
    setProfiles((prev) =>
      prev.map((profile) =>
        profile.id === activeProfileId
          ? { ...profile, settings: currentSnapshot }
          : profile
      )
    );
  }, [activeProfileId, collectCurrentSettings]);

  useEffect(() => {
    try {
      localStorage.setItem("phosium_settings_profiles", JSON.stringify(profiles));
      localStorage.setItem("phosium_active_profile_id", activeProfileId);
    } catch (error) {
      console.error("Unable to save profiles:", error);
    }
  }, [profiles, activeProfileId]);

  useEffect(() => {
    try {
      localStorage.setItem("phosium_wisp_servers", JSON.stringify(wispServers));
      window.dispatchEvent(new CustomEvent("phosium:wisp-servers-updated"));
    } catch (error) {
      console.error("Unable to save Wisp servers:", error);
    }
  }, [wispServers]);

  useEffect(() => {
    const serversToTest = wispServers.filter((server) =>
      server.ping === null && !testingServerIdsRef.current.has(server.id)
    );
    for (const server of serversToTest) {
      testingServerIdsRef.current.add(server.id);
      void measurePing(server.url).then((ping) => {
        testingServerIdsRef.current.delete(server.id);
        setWispServers((current) =>
          current.map((entry) => entry.id === server.id ? { ...entry, ping } : entry)
        );
      });
    }
  }, [wispServers]);

  const handleWallpaperChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setWallpaperError("Choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setWallpaperError("Choose an image smaller than 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setWallpaperError("Unable to read this image.");
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setWallpaperError("Unable to read this image.");
        return;
      }
      try {
        setWallpaper(reader.result);
        setWallpaperError("");
      } catch (error) {
        console.error("Unable to save desktop wallpaper:", error);
        setWallpaperError("Unable to save this image. Try a smaller file.");
      }
    };
    reader.readAsDataURL(file);
  };

  const updateExternalExtensions = (extensions: typeof externalExtensions) => {
    try {
      setExternalExtensions(extensions);
      setExternalExtensionError("");
    } catch (error) {
      setExternalExtensionError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleExternalExtensionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoadingExternalExtension(true);
    try {
      const input = externalExtensionUrl.trim();
      const urlInput = /^[a-z][a-z\d+.-]*:\/\//i.test(input) || input.startsWith("/")
        ? input
        : `http://${input}`;
      const url = new URL(urlInput, window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new TypeError("Manifest URLs must use HTTP or HTTPS.");
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not load manifest (HTTP ${response.status}).`);
      }
      const manifestText = await response.text();
      if (manifestText.length > 300 * 1024) {
        throw new TypeError("Manifest files must be 300 KB or smaller.");
      }

      const extension = parseExternalPhosiumExtension(JSON.parse(manifestText));
      if (externalExtensions.some((installed) => installed.id === extension.id)) {
        throw new TypeError(`An extension with id "${extension.id}" is already installed.`);
      }
      updateExternalExtensions([...externalExtensions, extension]);
      setExternalExtensionUrl("");
    } catch (error) {
      console.error("Unable to load external extension manifest:", error);
      setExternalExtensionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingExternalExtension(false);
    }
  };

  const savePanicDestination = (event: FormEvent) => {
    event.preventDefault();
    try {
      setPanicUrl(panicDestinationDraft.trim());
      setPanicDestinationError("");
    } catch (error) {
      console.error("Unable to save panic destination:", error);
      setPanicDestinationError(error instanceof Error ? error.message : "Enter a valid HTTP or HTTPS URL.");
    }
  };

  const handleSelectWispServer = (server: WispServer) => {
    updateProxySettings({ wispUrl: server.url });
  };

  const handleAddWispSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const trimmedUrl = newServerUrl.trim();
      const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedUrl)
        ? trimmedUrl
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${trimmedUrl}`;
      const parsed = new URL(candidate);
      if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
        throw new TypeError("Wisp URL must use ws:// or wss://.");
      }
      if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";

      const server: WispServer = {
        id: `custom-${Date.now()}`,
        name: newServerName.trim() || "Custom Wisp",
        url: parsed.href,
        ping: null,
        isCustom: true,
      };
      setWispServers((current) => [...current, server]);
      setNewServerName("");
      setNewServerUrl("");
      setIsAddingWisp(false);
      setAddError("");
    } catch (error) {
      setAddError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleDeleteServer = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (wispServers.length <= 1) return;
    const server = wispServers.find((entry) => entry.id === id);
    if (!server || server.isLocal) return;

    const remaining = wispServers.filter((entry) => entry.id !== id);
    setWispServers(remaining);
    if (server.url === proxySettings.wispUrl && remaining.length > 0) {
      handleSelectWispServer(remaining[0]);
    }
  };

  const handleScramjetFlagChange = (flag: keyof ScramjetFlags, enabled: boolean) => {
    try {
      updateScramjetFlags({ ...scramjetFlags, [flag]: enabled });
      setFlagsError("");
    } catch (error) {
      console.error("Unable to save Scramjet flags:", error);
      setFlagsError(error instanceof Error ? error.message : String(error));
    }
  };

  const resetScramjetFlags = () => {
    try {
      updateScramjetFlags({ ...defaultConfigDev.flags });
      setFlagsError("");
    } catch (error) {
      console.error("Unable to reset Scramjet flags:", error);
      setFlagsError(error instanceof Error ? error.message : String(error));
    }
  };

  const applySettingsData = (parsed: Record<string, unknown>) => {
    if (parsed.theme) setTheme(parsed.theme as DesktopTheme);
    if (parsed.browserTheme) setBrowserTheme(parsed.browserTheme as "light" | "dark");
    if (parsed.wallpaper !== undefined) setWallpaper(parsed.wallpaper as string | null);
    if (parsed.phosphorousEnabled !== undefined) setPhosphorousEnabled(parsed.phosphorousEnabled as boolean);
    if (parsed.browserEnhancementsEnabled !== undefined) setBrowserEnhancementsEnabled(parsed.browserEnhancementsEnabled as boolean);
    if (parsed.browserGamingToolsEnabled !== undefined) setBrowserGamingToolsEnabled(parsed.browserGamingToolsEnabled as boolean);
    if (parsed.browserAdBlockerEnabled !== undefined) setBrowserAdBlockerEnabled(parsed.browserAdBlockerEnabled as boolean);
    if (parsed.gameEnhancementsEnabled !== undefined) setGameEnhancementsEnabled(parsed.gameEnhancementsEnabled as boolean);
    if (parsed.gameGamingToolsEnabled !== undefined) setGameGamingToolsEnabled(parsed.gameGamingToolsEnabled as boolean);
    if (parsed.gameAdBlockerEnabled !== undefined) setGameAdBlockerEnabled(parsed.gameAdBlockerEnabled as boolean);
    if (Array.isArray(parsed.externalExtensions)) setExternalExtensions(parsed.externalExtensions);
    if (parsed.searchEngine) setSearchEngine(parsed.searchEngine as "google" | "duckduckgo" | "bing" | "brave" | "yahoo");
    if (parsed.cloak) setCloak(parsed.cloak as CloakOption);
    if (parsed.autoLaunchMode) setAutoLaunchMode(parsed.autoLaunchMode as "none" | "about-blank" | "blob");
    if (parsed.panicKeyEnabled !== undefined) setPanicKeyEnabled(parsed.panicKeyEnabled as boolean);
    if (parsed.panicKey) setPanicKey(parsed.panicKey as string);
    if (parsed.panicUrl) {
      setPanicUrl(parsed.panicUrl as string);
      setPanicDestinationDraft(parsed.panicUrl as string);
    }
    if (parsed.proxySettings) updateProxySettings(parsed.proxySettings as Parameters<typeof updateProxySettings>[0]);
    if (parsed.scramjetFlags) updateScramjetFlags(parsed.scramjetFlags as ScramjetFlags);
    if (typeof parsed.userAgentProfile === "string") handleUserAgentChange(parsed.userAgentProfile);
    if (typeof parsed.customCloakTitle === "string") {
      setCustomCloakTitleDraft(parsed.customCloakTitle);
      setCustomCloakConfig({ title: parsed.customCloakTitle });
    }
    if (typeof parsed.customCloakIcon === "string") {
      setCustomCloakIconDraft(parsed.customCloakIcon);
      setCustomCloakConfig({ favicon: parsed.customCloakIcon });
    }
    if (typeof parsed.customBg === "string" && typeof parsed.customSurface === "string" && typeof parsed.customAccent === "string" && typeof parsed.customText === "string") {
      setCustomBg(parsed.customBg);
      setCustomSurface(parsed.customSurface);
      setCustomAccent(parsed.customAccent);
      setCustomText(parsed.customText);
      handleSaveCustomPalette(parsed.customBg, parsed.customSurface, parsed.customAccent, parsed.customText);
    }
    if (Array.isArray(parsed.wispServers)) {
      const localUrl = defaultWispUrl();
      const merged = [
        { id: "local-host", name: "Local Host Wisp", url: localUrl, ping: null, isLocal: true },
        ...parsed.wispServers.filter((s: WispServer) => !s.isLocal),
      ];
      setWispServers(merged);
    }
  };

  const handleCreateProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    const newProfile: SettingsProfile = {
      id: `profile-${Date.now()}`,
      name: newProfileName.trim(),
      settings: collectCurrentSettings(),
    };
    setProfiles((prev) => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
    setNewProfileName("");
    setProfileStatusError("");
    setProfileStatusMessage(`Created and switched to "${newProfile.name}".`);
  };

  const handleSwitchProfile = (profile: SettingsProfile) => {
    isSwitchingProfileRef.current = true;
    setActiveProfileId(profile.id);
    if (Object.keys(profile.settings).length > 0) {
      applySettingsData(profile.settings);
    }
    setProfileStatusError("");
    setProfileStatusMessage(`Switched to "${profile.name}".`);
    window.setTimeout(() => {
      isSwitchingProfileRef.current = false;
    }, 50);
  };

  const handleDeleteProfile = (id: string) => {
    if (profiles.length <= 1) return;
    const nextProfiles = profiles.filter((p) => p.id !== id);
    setProfiles(nextProfiles);
    if (activeProfileId === id && nextProfiles[0]) {
      handleSwitchProfile(nextProfiles[0]);
    }
  };

  const handleExportSingleProfile = (profile: SettingsProfile) => {
    try {
      const slug = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "profile";
      const payload = {
        type: "phosium-profile",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        profile: {
          name: profile.name,
          settings: profile.id === activeProfileId ? collectCurrentSettings() : profile.settings,
        },
      };
      triggerJsonDownload(payload, `phosium-profile-${slug}.json`);
      setProfileStatusError("");
    } catch (error) {
      console.error("Unable to export profile:", error);
      setProfileStatusError("Failed to export profile.");
    }
  };

  const handleExportAllProfiles = () => {
    try {
      const syncedProfiles = profiles.map((p) =>
        p.id === activeProfileId ? { ...p, settings: collectCurrentSettings() } : p
      );
      const payload = {
        type: "phosium-profiles-bundle",
        version: "1.0",
        exportedAt: new Date().toISOString(),
        profiles: syncedProfiles,
      };
      triggerJsonDownload(payload, `phosium-all-profiles-${new Date().toISOString().slice(0, 10)}.json`);
      setProfileStatusError("");
    } catch (error) {
      console.error("Unable to export all profiles:", error);
      setProfileStatusError("Failed to export profiles bundle.");
    }
  };

  const handleImportProfiles = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => setProfileStatusError("Unable to read the selected JSON file.");
    reader.onload = () => {
      try {
        const content = reader.result;
        if (typeof content !== "string") throw new Error("Invalid file content.");
        const parsed = JSON.parse(content) as Record<string, unknown>;

        if (parsed.type === "phosium-profiles-bundle" && Array.isArray(parsed.profiles)) {
          const importedList: SettingsProfile[] = parsed.profiles
            .filter((item): item is SettingsProfile =>
              typeof item === "object" && item !== null && typeof (item as SettingsProfile).name === "string"
            )
            .map((item, idx) => ({
              id: `profile-${Date.now()}-${idx}`,
              name: item.name,
              settings: typeof item.settings === "object" && item.settings !== null ? item.settings : {},
            }));

          if (importedList.length === 0) throw new Error("No valid profiles found in file.");
          setProfiles((prev) => [...prev, ...importedList]);
          handleSwitchProfile(importedList[0]);
          setProfileStatusMessage(`Imported ${importedList.length} profile(s).`);
          setProfileStatusError("");
          return;
        }

        if (parsed.type === "phosium-profile" && typeof parsed.profile === "object" && parsed.profile !== null) {
          const rawProfile = parsed.profile as { name?: string; settings?: Record<string, unknown> };
          const importedProfile: SettingsProfile = {
            id: `profile-${Date.now()}`,
            name: rawProfile.name || "Imported Profile",
            settings: typeof rawProfile.settings === "object" && rawProfile.settings !== null ? rawProfile.settings : {},
          };
          setProfiles((prev) => [...prev, importedProfile]);
          handleSwitchProfile(importedProfile);
          setProfileStatusMessage(`Imported profile "${importedProfile.name}".`);
          setProfileStatusError("");
          return;
        }

        const legacyProfile: SettingsProfile = {
          id: `profile-${Date.now()}`,
          name: file.name.replace(/\.json$/i, "") || "Imported Settings",
          settings: parsed,
        };
        setProfiles((prev) => [...prev, legacyProfile]);
        handleSwitchProfile(legacyProfile);
        setProfileStatusMessage(`Imported "${legacyProfile.name}" as a new profile.`);
        setProfileStatusError("");
      } catch (error) {
        console.error("Unable to parse imported file:", error);
        setProfileStatusError("Invalid or corrupted profile JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const panicKeyLabel = panicKey === "\\" ? "Backslash (\\)" : panicKey === " " ? "Space" : panicKey;

  return (
    <main className="settings-app">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-title">System Settings</div>
        <button className={`settings-nav-item${activeTab === "appearance" ? " is-selected" : ""}`} onClick={() => setActiveTab("appearance")} type="button">Appearance</button>
        <button className={`settings-nav-item${activeTab === "panic-key" ? " is-selected" : ""}`} onClick={() => setActiveTab("panic-key")} type="button">Panic key</button>
        <button className={`settings-nav-item${activeTab === "network" ? " is-selected" : ""}`} onClick={() => setActiveTab("network")} type="button">Network & Proxy</button>
        <button className={`settings-nav-item${activeTab === "enhancements" ? " is-selected" : ""}`} onClick={() => setActiveTab("enhancements")} type="button">Extensions</button>
        <button className={`settings-nav-item${activeTab === "search" ? " is-selected" : ""}`} onClick={() => setActiveTab("search")} type="button">Search engine</button>
        <button className={`settings-nav-item${activeTab === "cloaking" ? " is-selected" : ""}`} onClick={() => setActiveTab("cloaking")} type="button">Cloaking</button>
        <button className={`settings-nav-item${activeTab === "profiles" ? " is-selected" : ""}`} onClick={() => setActiveTab("profiles")} type="button">Profiles</button>
        <div className="settings-sidebar-footer">Phosium OS · Web Edition</div>
      </aside>
      <div className="settings-content">
        {activeTab === "appearance" && (
          <section className="settings-section">
            <div className="settings-eyebrow">PERSONALIZATION</div>
            <h1>Appearance</h1>
            <p className="settings-description">Choose how your Phosium desktop looks.</p>
            <div className="settings-card theme-options" role="radiogroup" aria-label="Desktop theme">
              {([
                ["midnight", "Midnight", "Deep slate with violet accents"],
                ["light", "Cloud", "Soft neutral surfaces"],
                ["ocean", "Ocean", "Cool blue glass and sea tones"],
                ["custom", "Custom", "Choose your own custom color palette"],
              ] as const).map(([value, title, description]) => (
                <button
                  aria-checked={theme === value}
                  className={`theme-option theme-option-${value}${theme === value ? " is-selected" : ""}`}
                  key={value}
                  onClick={() => setTheme(value as DesktopTheme)}
                  role="radio"
                  type="button"
                >
                  <span className="theme-preview"><i /><i /><i /></span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>

            {theme === "custom" && (
              <div className="custom-palette-card">
                <h3 className="settings-subheading" style={{ margin: "0 0 4px 0" }}>Custom Palette Colors</h3>
                <p className="settings-description" style={{ marginBottom: "12px" }}>Customize your desktop variables with presets or hex codes.</p>
                <div className="custom-palette-grid">
                  <CustomColorPicker
                    label="Background Color"
                    value={customBg}
                    onChange={(hex) => {
                      setCustomBg(hex);
                      handleSaveCustomPalette(hex, customSurface, customAccent, customText);
                    }}
                  />
                  <CustomColorPicker
                    label="Surface Color"
                    value={customSurface}
                    onChange={(hex) => {
                      setCustomSurface(hex);
                      handleSaveCustomPalette(customBg, hex, customAccent, customText);
                    }}
                  />
                  <CustomColorPicker
                    label="Accent Color"
                    value={customAccent}
                    onChange={(hex) => {
                      setCustomAccent(hex);
                      handleSaveCustomPalette(customBg, customSurface, hex, customText);
                    }}
                  />
                  <CustomColorPicker
                    label="Text Color"
                    value={customText}
                    onChange={(hex) => {
                      setCustomText(hex);
                      handleSaveCustomPalette(customBg, customSurface, customAccent, hex);
                    }}
                  />
                </div>
              </div>
            )}

            <div className="settings-reset-row">
              <ResetButton setting="desktop theme" onReset={() => setTheme(appConfig.appearance.defaultDesktopTheme)} />
            </div>
            <h2 className="settings-subheading">Browser appearance</h2>
            <p className="settings-description">Choose a browser theme independent of your Phosium desktop theme.</p>
            <div className="settings-card theme-options browser-theme-options" role="radiogroup" aria-label="Browser theme">
              {([
                ["light", "Light", "Bright browser controls and start page"],
                ["dark", "Dark", "Dim browser controls and start page"],
              ] as const).map(([value, title, description]) => (
                <button
                  aria-checked={browserTheme === value}
                  className={`theme-option${browserTheme === value ? " is-selected" : ""}`}
                  key={value}
                  onClick={() => setBrowserTheme(value)}
                  role="radio"
                  type="button"
                >
                  <span className={`theme-preview browser-theme-preview browser-theme-preview-${value}`}>
                    <i /><i /><i />
                  </span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
            <div className="settings-reset-row">
              <ResetButton setting="browser theme" onReset={() => setBrowserTheme(appConfig.appearance.defaultBrowserTheme)} />
            </div>
            <div className="settings-card wallpaper-card">
              <div className="wallpaper-card-copy">
                <strong>Desktop wallpaper</strong>
                <p>Choose an image from your device. Images up to 2 MB are saved on this browser.</p>
              </div>
              <div className="wallpaper-preview" style={wallpaper ? { backgroundImage: `url("${wallpaper}")` } : undefined}>
                {!wallpaper && <span>No custom image</span>}
              </div>
              <div className="wallpaper-actions">
                <label className="settings-save-button wallpaper-upload">
                  Choose image
                  <input type="file" accept="image/*" onChange={handleWallpaperChange} />
                </label>
                {wallpaper && <button className="wallpaper-remove" type="button" onClick={() => {
                  try {
                    setWallpaper(null);
                    setWallpaperError("");
                  } catch (error) {
                    console.error("Unable to clear desktop wallpaper:", error);
                    setWallpaperError("Unable to remove the wallpaper.");
                  }
                }}>Remove wallpaper</button>}
              </div>
              {wallpaperError && <span className="settings-error" role="alert">{wallpaperError}</span>}
            </div>
          </section>
        )}

        {activeTab === "panic-key" && (
          <section className="settings-section">
            <div className="settings-eyebrow">QUICK EXIT</div>
            <h1>Panic key</h1>
            <p className="settings-description">Show a full-screen website over Phosium. Press the panic key again to return; cross-origin pages may block the shortcut, so use Return to Phosium if needed. Some sites block iframe embedding.</p>
            <div className="settings-card settings-toggle-row">
              <div>
                <strong>Enable panic key</strong>
                <p>Disabled by default. When enabled, the chosen key opens the website below in a full-screen overlay.</p>
              </div>
              <label className="switch">
                <input
                  aria-label="Enable panic key"
                  checked={panicKeyEnabled}
                  onChange={(event) => setPanicKeyEnabled(event.target.checked)}
                  type="checkbox"
                />
                <span />
              </label>
            </div>
            <div className="settings-card panic-key-settings">
              <div className="settings-field">
                <span>Activation key</span>
                <div className="settings-control-row">
                  <button
                    aria-label={isCapturingPanicKey ? "Press a key to use as the panic key" : `Panic key: ${panicKeyLabel}. Click to change`}
                    className="settings-save-button panic-key-capture"
                    data-panic-key-capture
                    onClick={() => setIsCapturingPanicKey(true)}
                    onKeyDown={(event) => {
                      if (!isCapturingPanicKey) return;
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setIsCapturingPanicKey(false);
                        return;
                      }
                      if (["Alt", "Control", "Meta", "Shift"].includes(event.key)) return;
                      event.preventDefault();
                      setPanicKey(event.key);
                      setIsCapturingPanicKey(false);
                    }}
                    type="button"
                  >
                    {isCapturingPanicKey ? "Press any key…" : panicKeyLabel}
                  </button>
                  <small>Click the button, then press a key.</small>
                </div>
              </div>
              <form className="settings-field" onSubmit={savePanicDestination}>
                <label htmlFor="panic-destination">Website shown in panic overlay</label>
                <div className="settings-control-row panic-destination-row">
                  <input
                    id="panic-destination"
                    onChange={(event) => setPanicDestinationDraft(event.target.value)}
                    placeholder="https://www.google.com/"
                    type="url"
                    value={panicDestinationDraft}
                  />
                  <button className="settings-save-button" type="submit">Save website</button>
                </div>
                {panicDestinationError && <span className="settings-error" role="alert">{panicDestinationError}</span>}
              </form>
            </div>
          </section>
        )}

        {activeTab === "network" && (
          <section className="settings-section">
            <div className="settings-eyebrow">CONNECTIVITY</div>
            <h1>Network & Proxy</h1>
            <p className="settings-description">Configure the proxy engine, connection, and Scramjet feature flags.</p>
            <div className="settings-card settings-toggle-row">
              <div>
                <strong>System-wide proxy</strong>
                <p>Route Phosium app traffic through the selected proxy.</p>
              </div>
              <div className="settings-control-actions">
                <label className="switch">
                  <input
                    aria-label="System-wide proxy"
                    checked={proxySettings.enabled}
                    onChange={(event) => updateProxySettings({ enabled: event.target.checked })}
                    type="checkbox"
                  />
                  <span />
                </label>
                <ResetButton setting="system-wide proxy" onReset={() => updateProxySettings({ enabled: true })} />
              </div>
            </div>

            <div className="settings-card settings-form-card">
              <div className="settings-field">
                <span>Proxy engine</span>
                <div className="settings-control-row">
                  <select
                    aria-label="Proxy engine"
                    disabled={!proxySettings.enabled}
                    onChange={(event) => updateProxySettings({ engine: event.target.value as ProxyEngineType })}
                    value={proxySettings.engine}
                  >
                    <option value="scramjet">Scramjet</option>
                    <option value="ultraviolet">Ultraviolet</option>
                    <option value="rammerhead">Rammerhead</option>
                  </select>
                  <ResetButton setting="proxy engine" onReset={() => updateProxySettings({ engine: "scramjet" })} />
                </div>
              </div>

              <div className="settings-field">
                <span>User-Agent Profile</span>
                <div className="settings-control-row">
                  <select
                    aria-label="User-Agent profile"
                    value={userAgentProfile}
                    onChange={(event) => handleUserAgentChange(event.target.value)}
                  >
                    <option value="default">Default (System)</option>
                    <optgroup label="Desktop">
                      <option value="chrome-windows">Google Chrome (Windows)</option>
                      <option value="chrome-mac">Google Chrome (macOS)</option>
                      <option value="chrome-linux">Google Chrome (Linux)</option>
                      <option value="firefox-windows">Mozilla Firefox (Windows)</option>
                      <option value="firefox-mac">Mozilla Firefox (macOS)</option>
                      <option value="safari-mac">Apple Safari (macOS)</option>
                      <option value="edge-windows">Microsoft Edge (Windows)</option>
                    </optgroup>
                    <optgroup label="Mobile">
                      <option value="iphone">Mobile Safari (iPhone)</option>
                      <option value="ipad">Mobile Safari (iPad)</option>
                      <option value="android-chrome">Google Chrome (Android)</option>
                      <option value="android-firefox">Mozilla Firefox (Android)</option>
                    </optgroup>
                  </select>
                  <ResetButton setting="User-Agent profile" onReset={() => handleUserAgentChange("default")} />
                </div>
              </div>

              {proxySettings.engine === "scramjet" && (
                <div className="settings-field">
                  <div className="settings-control-row proxy-flags-heading">
                    <span>Scramjet feature flags</span>
                    <ResetButton setting="Scramjet flags" onReset={resetScramjetFlags} />
                  </div>
                  <p className="proxy-flags-description">Flag changes are saved on this browser and apply to newly loaded pages. Refresh open proxied pages to apply them.</p>
                  <div className="proxy-flag-list">
                    {(Object.keys(scramjetFlagLabels) as (keyof ScramjetFlags)[]).map((flag) => (
                      <label className="settings-toggle-row proxy-flag-row" key={flag}>
                        <span>
                          <strong>{scramjetFlagLabels[flag]}</strong>
                          <small>{flag}</small>
                        </span>
                        <span className="switch">
                          <input
                            aria-label={scramjetFlagLabels[flag]}
                            checked={scramjetFlags[flag]}
                            onChange={(event) => handleScramjetFlagChange(flag, event.target.checked)}
                            type="checkbox"
                          />
                          <span />
                        </span>
                      </label>
                    ))}
                  </div>
                  {flagsError && <span className="settings-error" role="alert">{flagsError}</span>}
                </div>
              )}

              {proxySettings.engine === "ultraviolet" && (
                <p className="proxy-engine-note">This Ultraviolet version does not expose configurable feature flags.</p>
              )}
              {proxySettings.engine === "rammerhead" && (
                <p className="proxy-engine-note">Rammerhead uses the configured local server and does not expose feature flags.</p>
              )}

              {proxySettings.engine !== "rammerhead" && (
                <>
                  <div className="settings-field">
                    <span>Wisp transport</span>
                    <div className="settings-control-row">
                      <select
                        aria-label="Wisp transport"
                        disabled={!proxySettings.enabled}
                        onChange={(event) => updateProxySettings({ transport: event.target.value as ProxyTransportType })}
                        value={proxySettings.transport}
                      >
                        <option value="epoxy">Epoxy</option>
                        <option value="libcurl">Libcurl.js</option>
                      </select>
                      <ResetButton setting="Wisp transport" onReset={() => updateProxySettings({ transport: "epoxy" })} />
                    </div>
                  </div>
                  <div className="settings-field">
                    <span>Wisp servers & latency</span>
                    <div className="proxy-wisp-list">
                      {wispServers.map((server) => {
                        const isSelected = proxySettings.wispUrl === server.url;
                        const canDelete = !server.isLocal && wispServers.length > 1;
                        return (
                          <div className={`proxy-wisp-server${isSelected ? " is-selected" : ""}`} key={server.id}>
                            <button
                              aria-pressed={isSelected}
                              className="proxy-wisp-select"
                              disabled={!proxySettings.enabled}
                              onClick={() => handleSelectWispServer(server)}
                              type="button"
                            >
                              <SignalIcon ping={server.ping} />
                              <span className="proxy-wisp-details">
                                <strong>{server.name}</strong>
                                <small>{server.url}</small>
                                <small>{server.ping !== null ? `${server.ping}ms` : "Measuring ping..."}</small>
                              </span>
                            </button>
                            {canDelete && (
                              <button
                                aria-label={`Delete ${server.name}`}
                                className="proxy-wisp-delete"
                                onClick={(event) => handleDeleteServer(server.id, event)}
                                title="Delete Wisp server"
                                type="button"
                              >
                                <PhosiumIcon name="trash-2" size={16} />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {!isAddingWisp ? (
                        <button
                          className="proxy-add-wisp"
                          disabled={!proxySettings.enabled}
                          onClick={() => setIsAddingWisp(true)}
                          type="button"
                        >
                          + Add Wisp Server
                        </button>
                      ) : (
                        <form className="proxy-add-wisp-form" onSubmit={handleAddWispSubmit}>
                          <input
                            onChange={(event) => setNewServerName(event.target.value)}
                            placeholder="Server name"
                            required
                            value={newServerName}
                          />
                          <input
                            onChange={(event) => setNewServerUrl(event.target.value)}
                            placeholder="Wisp URL (wss://.../wisp/)"
                            required
                            value={newServerUrl}
                          />
                          {addError && <small className="settings-error" role="alert">{addError}</small>}
                          <div className="proxy-add-wisp-actions">
                            <button onClick={() => setIsAddingWisp(false)} type="button">Cancel</button>
                            <button type="submit">Save Server</button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="proxy-status">
              <span className={proxySettings.enabled ? "status-dot is-on" : "status-dot"} />
              {proxyStatus}
            </div>
          </section>
        )}

        {activeTab === "enhancements" && (
          <section className="settings-section">
            <div className="settings-eyebrow">PHOSPHOROUS</div>
            <h1>Extension settings</h1>
            <p className="settings-description">Enable or disable Phosphorous, then manage its extensions separately for browser tabs and game windows.</p>
            <div className="settings-card settings-toggle-row">
              <div>
                <strong>Phosphorous</strong>
                <p>Master switch for all Phosphorous extensions in browser tabs and game windows.</p>
              </div>
              <div className="settings-control-actions">
                <label className="switch">
                  <input
                    aria-label="Phosphorous"
                    checked={phosphorousEnabled}
                    onChange={(event) => setPhosphorousEnabled(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                </label>
                <ResetButton setting="Phosphorous" onReset={() => setPhosphorousEnabled(appConfig.features.phosphorousEnabled)} />
              </div>
            </div>
            <h2 className="settings-subheading">Browser</h2>
            <div className="settings-card settings-toggle-row">
              <div>
                <strong>Page enhancements</strong>
                <p>Enable lightweight styling and browser helpers in browser tabs.</p>
              </div>
              <div className="settings-control-actions">
                <label className="switch">
                  <input
                    aria-label="Browser page enhancements"
                    checked={browserEnhancementsEnabled}
                    disabled={!phosphorousEnabled}
                    onChange={(event) => setBrowserEnhancementsEnabled(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                </label>
                <ResetButton setting="browser page enhancements" onReset={() => setBrowserEnhancementsEnabled(appConfig.features.browserEnhancementsEnabled)} />
              </div>
            </div>
            <div className="settings-card settings-toggle-row">
              <div>
                <strong>Gaming tools overlay</strong>
                <p>Show a speedrun timer and notes in browser tabs only.</p>
              </div>
              <div className="settings-control-actions">
                <label className="switch">
                  <input
                    aria-label="Browser gaming tools overlay"
                    checked={browserGamingToolsEnabled}
                    disabled={!phosphorousEnabled}
                    onChange={(event) => setBrowserGamingToolsEnabled(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                </label>
                <ResetButton setting="browser gaming tools" onReset={() => setBrowserGamingToolsEnabled(appConfig.features.browserGamingToolsEnabled)} />
              </div>
            </div>
            <div className="settings-card settings-toggle-row">
              <div>
                <strong>Ad blocker</strong>
                <p>Best-effort page filtering for common ad networks and known ad containers. Requests may begin before the extension runs.</p>
              </div>
              <div className="settings-control-actions">
                <label className="switch">
                  <input
                    aria-label="Browser ad blocker"
                    checked={browserAdBlockerEnabled}
                    disabled={!phosphorousEnabled}
                    onChange={(event) => setBrowserAdBlockerEnabled(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                </label>
                <ResetButton setting="browser ad blocker" onReset={() => setBrowserAdBlockerEnabled(appConfig.features.browserAdBlockerEnabled)} />
              </div>
            </div>
            <h2 className="settings-subheading">Game windows</h2>
            <div className="settings-card settings-toggle-row">
              <div>
                <strong>Page enhancements</strong>
                <p>Enable Phosphorous styling in game windows, independent of browser settings.</p>
              </div>
              <div className="settings-control-actions">
                <label className="switch">
                  <input
                    aria-label="Game page enhancements"
                    checked={gameEnhancementsEnabled}
                    disabled={!phosphorousEnabled}
                    onChange={(event) => setGameEnhancementsEnabled(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                </label>
                <ResetButton setting="game page enhancements" onReset={() => setGameEnhancementsEnabled(appConfig.features.gameEnhancementsEnabled)} />
              </div>
            </div>
            <div className="settings-card settings-toggle-row">
              <div>
                <strong>Ad blocker</strong>
                <p>Best-effort page filtering for common ad networks and known ad containers. Requests may begin before the extension runs.</p>
              </div>
              <div className="settings-control-actions">
                <label className="switch">
                  <input
                    aria-label="Game ad blocker"
                    checked={gameAdBlockerEnabled}
                    disabled={!phosphorousEnabled}
                    onChange={(event) => setGameAdBlockerEnabled(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                </label>
                <ResetButton setting="game ad blocker" onReset={() => setGameAdBlockerEnabled(appConfig.features.gameAdBlockerEnabled)} />
              </div>
            </div>
            <div className="settings-card settings-toggle-row">
              <div>
                <strong>Gaming tools overlay</strong>
                <p>Show the speedrun timer and notes in game windows only.</p>
              </div>
              <div className="settings-control-actions">
                <label className="switch">
                  <input
                    aria-label="Game gaming tools overlay"
                    checked={gameGamingToolsEnabled}
                    disabled={!phosphorousEnabled}
                    onChange={(event) => setGameGamingToolsEnabled(event.target.checked)}
                    type="checkbox"
                  />
                  <span />
                </label>
                <ResetButton setting="game gaming tools" onReset={() => setGameGamingToolsEnabled(appConfig.features.gameGamingToolsEnabled)} />
              </div>
            </div>
            <h2 className="settings-subheading">External extensions</h2>
            <p className="settings-description">
              Enter a URL to a Phosphorous manifest JSON file. JavaScript and HTML extensions run in the matched page, so only load manifests you trust.
            </p>
            <div className="settings-card external-extensions-card">
              <form className="external-extension-url-form" onSubmit={(event) => void handleExternalExtensionSubmit(event)}>
                <input
                  aria-label="External extension manifest URL"
                  autoComplete="url"
                  inputMode="url"
                  onChange={(event) => setExternalExtensionUrl(event.target.value)}
                  placeholder="http://localhost:3000/examples/extensions/my-manifest.json"
                  required
                  type="text"
                  value={externalExtensionUrl}
                />
                <button className="settings-save-button" disabled={isLoadingExternalExtension} type="submit">
                  {isLoadingExternalExtension ? "Loading…" : "Load manifest"}
                </button>
              </form>
              {externalExtensions.length === 0 ? (
                <p className="external-extensions-empty">No external extensions installed.</p>
              ) : externalExtensions.map((extension) => (
                <div className="settings-toggle-row external-extension-row" key={extension.id}>
                  <div>
                    <strong>{extension.name}</strong>
                    <p>{extension.id} · {extension.type}</p>
                  </div>
                  <div className="settings-control-actions">
                    <label className="switch">
                      <input
                        aria-label={`Enable ${extension.name}`}
                        checked={extension.enabled}
                        disabled={!phosphorousEnabled}
                        onChange={(event) => {
                          updateExternalExtensions(externalExtensions.map((installed) =>
                            installed.id === extension.id
                              ? { ...installed, enabled: event.target.checked }
                              : installed,
                          ));
                        }}
                        type="checkbox"
                      />
                      <span />
                    </label>
                    <button
                      aria-label={`Remove ${extension.name}`}
                      className="settings-reset-button"
                      onClick={() => updateExternalExtensions(externalExtensions.filter((installed) => installed.id !== extension.id))}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {externalExtensionError && <span className="settings-error" role="alert">{externalExtensionError}</span>}
          </section>
        )}

        {activeTab === "search" && (
          <section className="settings-section">
            <div className="settings-eyebrow">BROWSER</div>
            <h1>Search engine</h1>
            <p className="settings-description">Choose which search provider opens when you enter words instead of a web address.</p>
            <div className="settings-card settings-form-card">
              <div className="settings-field">
                <span>Default search engine</span>
                <div className="settings-control-row">
                  <select
                    aria-label="Default search engine"
                    onChange={(event) => setSearchEngine(event.target.value as typeof searchEngine)}
                    value={searchEngine}
                  >
                    <option value="google">Google</option>
                    <option value="duckduckgo">DuckDuckGo</option>
                    <option value="bing">Bing</option>
                    <option value="brave">Brave Search</option>
                    <option value="yahoo">Yahoo</option>
                  </select>
                  <ResetButton setting="search engine" onReset={() => setSearchEngine(appConfig.browser.defaultSearchEngine)} />
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === "cloaking" && (
          <section className="settings-section">
            <div className="settings-eyebrow">PERSONALIZATION</div>
            <h1>Cloaking</h1>
            <p className="settings-description">
              Choose the browser tab appearance and launch options. Automatic launch may require allowing pop-ups for this site.
            </p>
            <div className="settings-card settings-form-card">
              <div className="settings-field">
                <span>Browser tab appearance</span>
                <div className="settings-control-row">
                  <select
                    aria-label="Browser tab appearance"
                    onChange={(event) => {
                      const selected = CLOAK_OPTIONS.find((option) => option.value === event.target.value);
                      if (selected) setCloak(selected.value);
                    }}
                    value={cloak}
                  >
                    {CLOAK_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <ResetButton setting="cloaking" onReset={() => setCloak(appConfig.privacy.cloak)} />
                </div>
              </div>

              {cloak === "custom" && (
                <>
                  <div className="settings-field">
                    <span>Custom Tab Title</span>
                    <div className="settings-control-row">
                      <input
                        type="text"
                        value={customCloakTitleDraft}
                        placeholder="e.g. Google Drive"
                        onChange={(e) => setCustomCloakTitleDraft(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="settings-field">
                    <span>Custom Favicon URL</span>
                    <div className="settings-control-row">
                      <input
                        type="url"
                        value={customCloakIconDraft}
                        placeholder="https://example.com/favicon.ico"
                        onChange={(e) => setCustomCloakIconDraft(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="settings-field" style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
                    <button
                      type="button"
                      className="settings-save-button"
                      onClick={handleApplyCustomCloak}
                    >
                      Apply Custom Cloak
                    </button>
                    {customCloakAppliedMsg && (
                      <span style={{ fontSize: "0.85rem", color: "#4ade80", fontWeight: 500 }}>
                        {customCloakAppliedMsg}
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="settings-field">
                <span>Automatically launch on site open</span>
                <div className="settings-control-row">
                  <select
                    aria-label="Automatically launch on site open"
                    onChange={(event) => {
                      const mode = event.target.value;
                      if (mode === "none" || mode === "about-blank" || mode === "blob") {
                        setAutoLaunchMode(mode);
                      }
                    }}
                    value={autoLaunchMode}
                  >
                    <option value="none">Disabled</option>
                    <option value="about-blank">About:blank</option>
                    <option value="blob">Blob</option>
                  </select>
                  <ResetButton setting="automatic launch" onReset={() => setAutoLaunchMode(appConfig.privacy.autoLaunchMode)} />
                </div>
              </div>
            </div>
            <div className="settings-card cloak-launch-grid" aria-label="Launch options">
              <button className="cloak-launch-button" onClick={() => void launchAboutBlank(cloak)} type="button">
                <strong>Launch about:blank</strong>
                <span>Open Phosium in a blank-page window.</span>
              </button>
              <button className="cloak-launch-button" onClick={() => void launchBlob(cloak)} type="button">
                <strong>Launch blob</strong>
                <span>Open Phosium in a blob-backed window.</span>
              </button>
            </div>
          </section>
        )}

        {activeTab === "profiles" && (
          <section className="settings-section">
            <div className="settings-eyebrow">PROFILES & BACKUP</div>
            <h1>Configuration Profiles</h1>
            <p className="settings-description">
              Changes you make are saved automatically to your active profile. Switch between setups, or export and import single profiles or your entire collection.
            </p>

            <div className="settings-card settings-form-card">
              <form className="profile-create-form" onSubmit={handleCreateProfile}>
                <input
                  aria-label="New profile name"
                  placeholder="New profile name..."
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                />
                <button className="profile-btn profile-btn-primary" type="submit">
                  Create Profile
                </button>
              </form>

              <div className="profile-list">
                {profiles.map((profile) => {
                  const isActive = profile.id === activeProfileId;
                  return (
                    <div className={`profile-row${isActive ? " is-active" : ""}`} key={profile.id}>
                      <div className="profile-row-info">
                        <strong>{profile.name}</strong>
                        {isActive && <span className="profile-active-badge">Active</span>}
                      </div>
                      <div className="profile-row-actions">
                        {!isActive && (
                          <button
                            className="profile-btn profile-btn-secondary"
                            onClick={() => handleSwitchProfile(profile)}
                            type="button"
                          >
                            Switch
                          </button>
                        )}
                        <button
                          className="profile-btn profile-btn-secondary"
                          onClick={() => handleExportSingleProfile(profile)}
                          title={`Export ${profile.name}`}
                          type="button"
                        >
                          Export
                        </button>
                        {profiles.length > 1 && (
                          <button
                            className="profile-btn profile-btn-danger"
                            onClick={() => handleDeleteProfile(profile.id)}
                            title={`Delete ${profile.name}`}
                            type="button"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="profile-bulk-actions">
                <button
                  className="profile-btn profile-btn-secondary"
                  onClick={handleExportAllProfiles}
                  type="button"
                >
                  Export All Profiles (.json)
                </button>
                <label className="profile-btn profile-btn-secondary">
                  Import Profile(s)
                  <input
                    accept="application/json"
                    onChange={handleImportProfiles}
                    style={{ display: "none" }}
                    type="file"
                  />
                </label>
              </div>

              {profileStatusMessage && <p className="profile-status-msg">{profileStatusMessage}</p>}
              {profileStatusError && <span className="settings-error" role="alert">{profileStatusError}</span>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}