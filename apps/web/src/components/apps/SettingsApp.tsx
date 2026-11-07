import { useState, useEffect, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { ProxyEngineType, ProxyTransportType } from "@repo/proxy";
import type { DesktopTheme } from "../../SystemContext";
import { CLOAK_OPTIONS, launchAboutBlank, launchBlob } from "../../lib/cloak";
import { useSystem } from "../../SystemContext";
import { PhosiumIcon } from "@repo/os-shell";
import { parseExternalPhosiumExtension } from "../../extensions/phosphorousExtensions";

interface WispServer {
  id: string;
  name: string;
  url: string;
  ping: number | null; // in ms, null if testing/failed
  isCustom?: boolean;
  isLocal?: boolean;
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

function defaultWispUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/wisp/`;
}

// SVG Signal Icon component that dynamically renders 1, 2, 3, or 4 bars based on ping quality
function SignalIcon({ ping }: { ping: number | null }) {
  let color = "#f87171"; // red for bad/timeout

  if (ping !== null && ping < 999) {
    if (ping < 150) {
      color = "#4ade80"; // green
    } else if (ping < 300) {
      color = "#4ade80";
    } else if (ping < 600) {
      color = "#fbbf24"; // yellow
    }
  }

  return <PhosiumIcon name="wifi" size={20} style={{ flexShrink: 0, color }} />;
}

function TrashIcon() {
  return <PhosiumIcon name="trash-2" size={16} />;
}

export function SettingsApp() {
  const {
    proxySettings,
    updateProxySettings,
    theme,
    setTheme,
    browserTheme,
    setBrowserTheme,
    wallpaper,
    setWallpaper,
    proxyStatus,
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
  } = useSystem();
  const [panicDestinationDraft, setPanicDestinationDraft] = useState(panicUrl);
  const [panicDestinationError, setPanicDestinationError] = useState("");
  const [isCapturingPanicKey, setIsCapturingPanicKey] = useState(false);

  // Load saved servers from localStorage or initialize with local host endpoint
  const [wispServers, setWispServers] = useState<WispServer[]>(() => {
    if (typeof window === "undefined") return [];
    const localUrl = defaultWispUrl();
    try {
      const saved = localStorage.getItem("phosium_wisp_servers");
      if (saved) {
        const parsed: WispServer[] = JSON.parse(saved);
        // Ensure local host entry is always present and up-to-date
        const hasLocal = parsed.some((s) => s.isLocal);
        if (!hasLocal) {
          return [
            { id: "local-host", name: "Local Host Wisp", url: localUrl, ping: null, isCustom: false, isLocal: true },
            ...parsed,
          ];
        }
        return parsed.map((s) => (s.isLocal ? { ...s, url: localUrl } : s));
      }
    } catch { }

    return [
      {
        id: "local-host",
        name: "Local Host Wisp",
        url: localUrl,
        ping: null,
        isCustom: false,
        isLocal: true,
      },
    ];
  });

  const [isAddingWisp, setIsAddingWisp] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [addError, setAddError] = useState("");
  const [wallpaperError, setWallpaperError] = useState("");
  const [externalExtensionError, setExternalExtensionError] = useState("");
  const [externalExtensionUrl, setExternalExtensionUrl] = useState("");
  const [isLoadingExternalExtension, setIsLoadingExternalExtension] = useState(false);
  const isTestingRef = useRef(false);

  // Sync wispServers changes to localStorage whenever they update
  useEffect(() => {
    try {
      localStorage.setItem("phosium_wisp_servers", JSON.stringify(wispServers));
      window.dispatchEvent(new CustomEvent("phosium:wisp-servers-updated"));
    } catch (error) {
      console.error("Unable to save Wisp servers:", error);
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

  // Function to test ping for a given wisp URL using WebSocket connection time
  const measurePing = async (url: string): Promise<number> => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      try {
        const ws = new WebSocket(url);
        let finished = false;

        const cleanup = (val: number) => {
          if (finished) return;
          finished = true;
          try {
            ws.close();
          } catch { }
          resolve(val);
        };

        ws.onopen = () => {
          const duration = Math.round(performance.now() - startTime);
          cleanup(duration);
        };

        ws.onerror = () => {
          cleanup(999);
        };

        setTimeout(() => {
          cleanup(999);
        }, 3500);
      } catch {
        resolve(999);
      }
    });
  };

  // Run ping tests on mount or when servers change
  useEffect(() => {
    if (isTestingRef.current) return;
    isTestingRef.current = true;

    const testAll = async () => {
      for (const server of wispServers) {
        const latency = await measurePing(server.url);
        setWispServers((prev) =>
          prev.map((s) => (s.id === server.id ? { ...s, ping: latency } : s))
        );
      }
      isTestingRef.current = false;
    };

    void testAll();
  }, []);

  const handleSelectWispServer = (server: WispServer) => {
    updateProxySettings({ wispUrl: server.url });

    // Update active service worker for Scramjet & Ultraviolet engines
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "UPDATE_WISP",
        wispUrl: server.url,
      });
    }
  };

  const handleAddWispSubmit = (e: FormEvent) => {
    e.preventDefault();
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

      const newServer: WispServer = {
        id: `custom-${Date.now()}`,
        name: newServerName.trim() || "Custom Wisp",
        url: parsed.href,
        ping: null,
        isCustom: true,
      };

      setWispServers((prev) => [...prev, newServer]);
      setNewServerName("");
      setNewServerUrl("");
      setIsAddingWisp(false);
      setAddError("");

      void measurePing(parsed.href).then((latency) => {
        setWispServers((prev) =>
          prev.map((s) => (s.id === newServer.id ? { ...s, ping: latency } : s))
        );
      });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDeleteServer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (wispServers.length <= 1) return;

    const serverToDelete = wispServers.find((s) => s.id === id);
    if (!serverToDelete || serverToDelete.isLocal) return;

    const updatedServers = wispServers.filter((s) => s.id !== id);
    setWispServers(updatedServers);

    if (serverToDelete.url === proxySettings.wispUrl && updatedServers.length > 0) {
      handleSelectWispServer(updatedServers[0]);
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

  const panicKeyLabel = panicKey === "\\" ? "Backslash (\\)" : panicKey === " " ? "Space" : panicKey;

  return (
    <main className="settings-app">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-title">System Settings</div>
        <a className="settings-nav-item is-selected" href="#appearance">Appearance</a>
        <a className="settings-nav-item" href="#panic-key">Panic key</a>
        <a className="settings-nav-item" href="#network">Network & Proxy</a>
        <a className="settings-nav-item" href="#enhancements">Extensions</a>
        <a className="settings-nav-item" href="#search">Search engine</a>
        <a className="settings-nav-item" href="#cloaking">Cloaking</a>
        <div className="settings-sidebar-footer">Phosium OS · Web Edition</div>
      </aside>
      <div className="settings-content">
        <section className="settings-section" id="appearance">
          <div className="settings-eyebrow">PERSONALIZATION</div>
          <h1>Appearance</h1>
          <p className="settings-description">Choose how your Phosium desktop looks.</p>
          <div className="settings-card theme-options" role="radiogroup" aria-label="Desktop theme">
            {([
              ["midnight", "Midnight", "Deep slate with violet accents"],
              ["light", "Cloud", "Soft neutral surfaces"],
              ["ocean", "Ocean", "Cool blue glass and sea tones"],
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
          <div className="settings-reset-row">
            <ResetButton setting="desktop theme" onReset={() => setTheme("midnight")} />
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
            <ResetButton setting="browser theme" onReset={() => setBrowserTheme("light")} />
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

        <section className="settings-section" id="panic-key">
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

        <section className="settings-section" id="network">
          <div className="settings-eyebrow">CONNECTIVITY</div>
          <h1>Network & Proxy</h1>
          <p className="settings-description">
            Proxy routing applies to apps running inside this Phosium desktop.
          </p>
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
            {proxySettings.engine !== "rammerhead" && <div className="settings-field">
              <span>Wisp transport</span>
              <div className="settings-control-row">
                <select
                  aria-label="Wisp transport"
                  disabled={!proxySettings.enabled}
                  onChange={(event) => updateProxySettings({ transport: event.target.value as ProxyTransportType })}
                  value={proxySettings.transport}
                >
                  <option value="epoxy">Epoxy</option>
                  <option value="libcurl">Libcurl</option>
                </select>
                <ResetButton setting="Wisp transport" onReset={() => updateProxySettings({ transport: "epoxy" })} />
              </div>
            </div>}

            {/* Wisp Servers Selector Grid */}
            {proxySettings.engine !== "rammerhead" && (
              <div className="settings-field">
                <span>Wisp servers & latency</span>
                <div className="wisp-servers-container" style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                  {wispServers.map((server) => {
                    const isSelected = proxySettings.wispUrl === server.url;
                    const canDelete = !server.isLocal && wispServers.length > 1;

                    return (
                      <div
                        key={server.id}
                        onClick={() => handleSelectWispServer(server)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          borderRadius: "10px",
                          cursor: proxySettings.enabled ? "pointer" : "not-allowed",
                          background: isSelected ? "rgba(40, 120, 60, 0.25)" : "rgba(255, 255, 255, 0.05)",
                          border: isSelected ? "1px solid rgba(80, 200, 100, 0.6)" : "1px solid rgba(255, 255, 255, 0.1)",
                          transition: "all 0.2s ease",
                          opacity: proxySettings.enabled ? 1 : 0.6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <SignalIcon ping={server.ping} />
                          <div>
                            <strong style={{ display: "block", color: "#fff", fontSize: "14px" }}>{server.name}</strong>
                            <small style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "12px", wordBreak: "break-all" }}>{server.url}</small>
                            <span style={{ display: "block", color: server.ping !== null && server.ping < 300 ? "#4ade80" : "#f87171", fontSize: "11px", marginTop: "2px" }}>
                              {server.ping !== null ? `${server.ping}ms` : "Measuring ping..."}
                            </span>
                          </div>
                        </div>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteServer(server.id, e)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "rgba(255, 255, 255, 0.6)",
                              cursor: "pointer",
                              padding: "6px",
                              borderRadius: "6px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            title="Delete Wisp server"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {!isAddingWisp ? (
                    <button
                      type="button"
                      disabled={!proxySettings.enabled}
                      onClick={() => setIsAddingWisp(true)}
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px dashed rgba(255, 255, 255, 0.2)",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: proxySettings.enabled ? "pointer" : "not-allowed",
                        textAlign: "center",
                      }}
                    >
                      + Add Wisp Server
                    </button>
                  ) : (
                    <form onSubmit={handleAddWispSubmit} style={{ background: "rgba(0,0,0,0.2)", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder="Server Name (e.g. My Custom Proxy)"
                        value={newServerName}
                        onChange={(e) => setNewServerName(e.target.value)}
                        style={{ padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Wisp URL (wss://.../wisp/)"
                        value={newServerUrl}
                        onChange={(e) => setNewServerUrl(e.target.value)}
                        style={{ padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
                        required
                      />
                      {addError && <small style={{ color: "#f87171" }}>{addError}</small>}
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                        <button type="button" onClick={() => setIsAddingWisp(false)} style={{ padding: "6px 12px", background: "transparent", color: "#ccc", border: "none", cursor: "pointer" }}>Cancel</button>
                        <button type="submit" style={{ padding: "6px 12px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}>Save Server</button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="proxy-status"><span className={proxySettings.enabled ? "status-dot is-on" : "status-dot"} />{proxyStatus}</div>
        </section>

        <section className="settings-section" id="enhancements">
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
              <ResetButton setting="Phosphorous" onReset={() => setPhosphorousEnabled(true)} />
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
              <ResetButton setting="browser page enhancements" onReset={() => setBrowserEnhancementsEnabled(true)} />
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
              <ResetButton setting="browser gaming tools" onReset={() => setBrowserGamingToolsEnabled(true)} />
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
              <ResetButton setting="browser ad blocker" onReset={() => setBrowserAdBlockerEnabled(true)} />
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
              <ResetButton setting="game page enhancements" onReset={() => setGameEnhancementsEnabled(true)} />
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
              <ResetButton setting="game ad blocker" onReset={() => setGameAdBlockerEnabled(true)} />
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
              <ResetButton setting="game gaming tools" onReset={() => setGameGamingToolsEnabled(true)} />
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
        <section className="settings-section" id="search">
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
                </select>
                <ResetButton setting="search engine" onReset={() => setSearchEngine("google")} />
              </div>
            </div>
          </div>
        </section>
        <section className="settings-section" id="cloaking">
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
                <ResetButton setting="cloaking" onReset={() => setCloak("none")} />
              </div>
            </div>
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
                <ResetButton setting="automatic launch" onReset={() => autoLaunchMode} />
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
      </div>
    </main>
  );
}