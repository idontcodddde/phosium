import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { defaultConfigDev } from "@mercuryworkshop/scramjet";
import type { ScramjetFlags } from "@mercuryworkshop/scramjet";
import type { ProxyEngineType, ProxyTransportType } from "@repo/proxy";
import { PhosiumIcon } from "@repo/os-shell";
import { useSystem } from "../../SystemContext";

interface WispServer {
  id: string;
  name: string;
  url: string;
  ping: number | null;
  isCustom?: boolean;
  isLocal?: boolean;
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

export function ProxySettingsApp() {
  const {
    proxySettings,
    updateProxySettings,
    proxyStatus,
    scramjetFlags,
    updateScramjetFlags,
  } = useSystem();
  const [wispServers, setWispServers] = useState<WispServer[]>(getSavedWispServers);
  const [isAddingWisp, setIsAddingWisp] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [newServerUrl, setNewServerUrl] = useState("");
  const [addError, setAddError] = useState("");
  const [flagsError, setFlagsError] = useState("");
  const testingServerIdsRef = useRef(new Set<string>());

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

  const handleSelectWispServer = (server: WispServer) => {
    updateProxySettings({ wispUrl: server.url });
    navigator.serviceWorker?.controller?.postMessage({
      type: "UPDATE_WISP",
      wispUrl: server.url,
    });
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

  return (
    <main className="settings-app proxy-settings-app">
      <div className="settings-content">
        <section className="settings-section">
          <div className="settings-eyebrow">CONNECTIVITY</div>
          <h1>Proxy Settings</h1>
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
                      <option value="libcurl">Libcurl</option>
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
      </div>
    </main>
  );
}
