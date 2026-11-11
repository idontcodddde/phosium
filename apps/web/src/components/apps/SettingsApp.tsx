import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { DesktopTheme } from "../../SystemContext";
import { CLOAK_OPTIONS, launchAboutBlank, launchBlob } from "../../lib/cloak";
import { useSystem } from "../../SystemContext";
import { PhosiumIcon } from "@repo/os-shell";
import { ProxySettingsApp } from "./ProxySettingsApp";
import { parseExternalPhosiumExtension } from "../../extensions/phosphorousExtensions";

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
  } = useSystem();
  const [panicDestinationDraft, setPanicDestinationDraft] = useState(panicUrl);
  const [panicDestinationError, setPanicDestinationError] = useState("");
  const [isCapturingPanicKey, setIsCapturingPanicKey] = useState(false);
  const [wallpaperError, setWallpaperError] = useState("");
  const [externalExtensionError, setExternalExtensionError] = useState("");
  const [externalExtensionUrl, setExternalExtensionUrl] = useState("");
  const [isLoadingExternalExtension, setIsLoadingExternalExtension] = useState(false);

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
          <p className="settings-description">Proxy routing and engine options are managed in their own desktop app.</p>
          <div className="settings-card proxy-settings-launcher">
            <div>
              <strong>Proxy Settings</strong>
              <p>Choose an engine, manage Wisp servers, and configure Scramjet feature flags.</p>
            </div>
            <button
              className="settings-save-button"
              onClick={() => window.dispatchEvent(new CustomEvent("phosium:open-window", {
                detail: {
                  id: "proxy-settings",
                  title: "Proxy Settings",
                  icon: <PhosiumIcon name="settings" />,
                  description: "Configure proxy engines and Scramjet flags",
                  isOpen: true,
                  isMinimized: false,
                  isMaximized: false,
                  zIndex: 17,
                  position: { x: 190, y: 120 },
                  width: 650,
                  height: 600,
                  component: <ProxySettingsApp />,
                },
              }))}
              type="button"
            >
              Open Proxy Settings
            </button>
          </div>
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