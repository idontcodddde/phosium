import { useState } from "react";
import { PhosiumIcon } from "@repo/os-shell";

const antiReloadKey = "phosium_script_anti_reload";
const autoBlankKey = "phosium_script_auto_blank";

function isEnabled(key: string): boolean {
    try {
        return localStorage.getItem(key) === "true";
    } catch {
        return false;
    }
}

function saveEnabled(key: string, enabled: boolean): void {
    try {
        localStorage.setItem(key, String(enabled));
    } catch (error) {
        console.error("Unable to save script setting:", error);
    }
}

function warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (!isEnabled(antiReloadKey)) return;
    event.preventDefault();
    // Browsers show their own generic confirmation; custom text is ignored.
    event.returnValue = "";
}

function redirectWhenHidden(): void {
    if (document.visibilityState !== "hidden" || !isEnabled(autoBlankKey)) return;

    // Make this a one-shot action so returning to Phosium does not trap the tab.
    saveEnabled(autoBlankKey, false);
    window.location.replace("about:blank");
}

// Register at module load so scripts stay active when the app window is closed.
if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("visibilitychange", redirectWhenHidden);
}

export function ScriptsApp() {
    const [antiReload, setAntiReload] = useState(() => isEnabled(antiReloadKey));
    const [autoBlank, setAutoBlank] = useState(() => isEnabled(autoBlankKey));

    const updateSetting = (key: string, enabled: boolean, update: (value: boolean) => void) => {
        saveEnabled(key, enabled);
        update(enabled);
    };

    return (
        <main className="settings-app">
            <div className="settings-content">
                <section className="settings-section" aria-labelledby="scripts-heading">
                    <div className="settings-eyebrow">PAGE BEHAVIOR</div>
                    <h1 id="scripts-heading">Scripts</h1>
                    <p className="settings-description">Optional behaviors for this Phosium tab.</p>

                    <div className="scripts-grid">
                        <article className={`settings-card scripts-card${antiReload ? " is-enabled" : ""}`}>
                            <div>
                                <div className="scripts-card-heading">
                                    <span className="scripts-card-icon"><PhosiumIcon name="shield-check" /></span>
                                    <span className={`scripts-status${antiReload ? " is-enabled" : ""}`}>
                                        {antiReload ? "Enabled" : "Off"}
                                    </span>
                                </div>
                                <h2>Anti force reload</h2>
                                <p>Ask the browser to confirm before this tab reloads or navigates away. The browser decides whether to show the warning.</p>
                            </div>
                            <div className="scripts-card-footer">
                                <span>Reload protection</span>
                                <label className="switch">
                                    <input
                                        aria-label="Enable anti force reload"
                                        checked={antiReload}
                                        onChange={(event) => updateSetting(antiReloadKey, event.target.checked, setAntiReload)}
                                        type="checkbox"
                                    />
                                    <span />
                                </label>
                            </div>
                        </article>

                        <article className={`settings-card scripts-card${autoBlank ? " is-enabled" : ""}`}>
                            <div>
                                <div className="scripts-card-heading">
                                    <span className="scripts-card-icon"><PhosiumIcon name="app-window" /></span>
                                    <span className={`scripts-status${autoBlank ? " is-enabled" : ""}`}>
                                        {autoBlank ? "Armed" : "Off"}
                                    </span>
                                </div>
                                <h2>Auto blank</h2>
                                <p>On the next tab switch or minimize, replace this page with about:blank once. It automatically turns itself off before redirecting.</p>
                            </div>
                            <div className="scripts-card-footer">
                                <span>One-time redirect</span>
                                <label className="switch">
                                    <input
                                        aria-label="Arm redirect to about:blank when this tab is hidden"
                                        checked={autoBlank}
                                        onChange={(event) => updateSetting(autoBlankKey, event.target.checked, setAutoBlank)}
                                        type="checkbox"
                                    />
                                    <span />
                                </label>
                            </div>
                        </article>
                    </div>
                </section>
            </div>
        </main>
    );
}
