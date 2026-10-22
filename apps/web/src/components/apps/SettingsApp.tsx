import { useState } from "react";
import type { FormEvent } from "react";
import type { ProxyEngineType, ProxyTransportType } from "@repo/proxy";
import type { DesktopTheme } from "../../SystemContext";
import { CLOAK_OPTIONS, launchAboutBlank, launchBlob } from "../../lib/cloak";
import { useSystem } from "../../SystemContext";

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

export function SettingsApp() {
  const {
    proxySettings,
    updateProxySettings,
    theme,
    setTheme,
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
    searchEngine,
    setSearchEngine,
    cloak,
    setCloak,
    autoLaunchMode,
    setAutoLaunchMode,
  } = useSystem();
  const [wispUrl, setWispUrl] = useState(proxySettings.wispUrl);
  const [wispError, setWispError] = useState("");

  const saveWispUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const trimmed = wispUrl.trim();
      const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${trimmed}`;
      const parsed = new URL(candidate);
      if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
        throw new TypeError("Wisp URL must use ws:// or wss://.");
      }
      if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
      updateProxySettings({ wispUrl: parsed.href });
      setWispUrl(parsed.href);
      setWispError("");
    } catch (error) {
      setWispError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <main className="settings-app">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-title">System Settings</div>
        <a className="settings-nav-item is-selected" href="#appearance">Appearance</a>
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
            {proxySettings.engine !== "rammerhead" && <form className="settings-field wisp-field" onSubmit={saveWispUrl}>
              <span>Wisp server URL</span>
              <div className="wisp-input-row">
                <input
                  aria-label="Wisp server URL"
                  disabled={!proxySettings.enabled}
                  onChange={(event) => setWispUrl(event.target.value)}
                  placeholder="wss://proxy.example/wisp/"
                  value={wispUrl}
                />
                <button className="settings-save-button" disabled={!proxySettings.enabled} type="submit">Apply</button>
                <ResetButton setting="Wisp server URL" onReset={() => {
                  const url = defaultWispUrl();
                  updateProxySettings({ wispUrl: url });
                  setWispUrl(url);
                  setWispError("");
                }} />
              </div>
              {wispError && <small className="settings-error" role="alert">{wispError}</small>}
            </form>}
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
                <ResetButton setting="automatic launch" onReset={() => setAutoLaunchMode("none")} />
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
