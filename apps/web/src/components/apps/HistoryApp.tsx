import { useCallback, useEffect, useState } from "react";
import { PhosiumIcon } from "@repo/os-shell";
import { useSystem } from "../../SystemContext";
import {
    getHistoryTrackingSettings,
    loadUnifiedHistory,
    saveUnifiedHistory,
    setHistoryTrackingSettings,
} from "../../lib/history";
import type { HistoryTrackingSettings, UnifiedHistoryEntry } from "../../lib/history";

export function HistoryApp() {
    const { openInBrowser, openGame } = useSystem();
    const [entries, setEntries] = useState<UnifiedHistoryEntry[]>(loadUnifiedHistory);
    const [tracking, setTracking] = useState<HistoryTrackingSettings>(getHistoryTrackingSettings);
    const [filter, setFilter] = useState<"all" | "browser" | "game">("all");
    const [search, setSearch] = useState("");

    const syncHistory = useCallback(() => {
        setEntries(loadUnifiedHistory());
    }, []);

    const syncSettings = useCallback(() => {
        setTracking(getHistoryTrackingSettings());
    }, []);

    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === "phosium_unified_history") syncHistory();
            if (e.key === "phosium_history_settings") syncSettings();
        };
        window.addEventListener("phosium:history-updated", syncHistory);
        window.addEventListener("phosium:history-settings-updated", syncSettings);
        window.addEventListener("storage", onStorage);
        return () => {
            window.removeEventListener("phosium:history-updated", syncHistory);
            window.removeEventListener("phosium:history-settings-updated", syncSettings);
            window.removeEventListener("storage", onStorage);
        };
    }, [syncHistory, syncSettings]);

    const toggleBrowserTracking = () => {
        setTracking(setHistoryTrackingSettings({ browserEnabled: !tracking.browserEnabled }));
    };

    const toggleGameTracking = () => {
        setTracking(setHistoryTrackingSettings({ gameEnabled: !tracking.gameEnabled }));
    };

    const handleOpenEntry = (entry: UnifiedHistoryEntry) => {
        if (entry.source === "game") {
            openGame({ title: entry.title, url: entry.url, isHub: entry.isHub });
        } else {
            openInBrowser(entry.url);
        }
    };

    const handleDeleteEntry = (id: string) => {
        saveUnifiedHistory(entries.filter((item) => item.id !== id));
    };

    const handleClearFiltered = () => {
        if (filter === "all") {
            saveUnifiedHistory([]);
        } else {
            saveUnifiedHistory(entries.filter((item) => item.source !== filter));
        }
    };

    const filteredEntries = entries.filter((entry) => {
        if (filter !== "all" && entry.source !== filter) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return entry.title.toLowerCase().includes(q) || entry.url.toLowerCase().includes(q);
    });

    const browserCount = entries.filter((e) => e.source === "browser").length;
    const gameCount = entries.filter((e) => e.source === "game").length;

    return (
        <section aria-label="Activity History" className="history-app">
            <header className="history-header">
                <div className="history-title-group">
                    <h2>History</h2>
                    <p>
                        {entries.length} {entries.length === 1 ? "item" : "items"} saved on this device
                    </p>
                </div>

                <div className="history-toggles">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={tracking.browserEnabled}
                        className="history-toggle-btn"
                        onClick={toggleBrowserTracking}
                    >
                        <span>Browser history</span>
                        <span className="history-toggle-track">
                            <span className="history-toggle-thumb" />
                        </span>
                    </button>

                    <button
                        type="button"
                        role="switch"
                        aria-checked={tracking.gameEnabled}
                        className="history-toggle-btn"
                        onClick={toggleGameTracking}
                    >
                        <span>Game history</span>
                        <span className="history-toggle-track">
                            <span className="history-toggle-thumb" />
                        </span>
                    </button>
                </div>
            </header>

            <div className="history-controls">
                <div className="history-tabs" role="tablist">
                    {(
                        [
                            { id: "all", label: `All (${entries.length})` },
                            { id: "browser", label: `Browser (${browserCount})` },
                            { id: "game", label: `Games (${gameCount})` },
                        ] as const
                    ).map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={filter === tab.id}
                            className={`history-tab${filter === tab.id ? " is-active" : ""}`}
                            onClick={() => setFilter(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <label className="history-search-box">
                    <PhosiumIcon name="search" size={16} />
                    <input
                        aria-label="Search history"
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search browser and game history..."
                        value={search}
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch("")}
                            aria-label="Clear search"
                            className="history-search-clear"
                        >
                            <PhosiumIcon name="x" size={14} />
                        </button>
                    )}
                </label>
            </div>

            <div className="history-list">
                {filteredEntries.map((entry) => (
                    <div className="history-card" key={entry.id}>
                        <button
                            className="history-card-launch"
                            onClick={() => handleOpenEntry(entry)}
                            title={entry.url}
                            type="button"
                        >
                            <div className="history-card-top">
                                <span className="history-card-icon">
                                    <PhosiumIcon name={entry.source === "game" ? "gamepad-2" : "globe"} size={14} />
                                </span>
                                <strong className="history-card-title">{entry.title}</strong>
                                <span className="history-card-badge">{entry.source}</span>
                            </div>
                            <span className="history-card-url">{entry.url}</span>
                            <time className="history-card-time" dateTime={new Date(entry.visitedAt).toISOString()}>
                                {new Date(entry.visitedAt).toLocaleString()}
                            </time>
                        </button>

                        <button
                            aria-label={`Remove ${entry.title} from history`}
                            className="history-card-delete"
                            onClick={() => handleDeleteEntry(entry.id)}
                            type="button"
                        >
                            <PhosiumIcon name="x" size={16} />
                        </button>
                    </div>
                ))}

                {filteredEntries.length === 0 && (
                    <div className="history-empty">
                        {entries.length ? "No history matches your filter." : "Visited sites and launched games will appear here."}
                    </div>
                )}
            </div>

            <footer className="history-footer">
                <span className="history-footer-count">
                    Showing {filteredEntries.length} of {entries.length} entries
                </span>
                <button
                    className="history-clear-btn"
                    disabled={filteredEntries.length === 0}
                    onClick={handleClearFiltered}
                    type="button"
                >
                    {filter === "all" ? "Clear all history" : `Clear ${filter} history`}
                </button>
            </footer>
        </section>
    );
}