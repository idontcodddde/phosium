export type HistoryEntrySource = "browser" | "game";

export interface UnifiedHistoryEntry {
    id: string;
    title: string;
    url: string;
    visitedAt: number;
    source: HistoryEntrySource;
    isHub?: boolean;
}

export interface HistoryTrackingSettings {
    browserEnabled: boolean;
    gameEnabled: boolean;
}

const UNIFIED_HISTORY_KEY = "phosium_unified_history";
const LEGACY_BROWSER_HISTORY_KEY = "phosium_browser_history";
const HISTORY_SETTINGS_KEY = "phosium_history_settings";
const HISTORY_LIMIT = 500;

let seq = 0;

export function getHistoryTrackingSettings(): HistoryTrackingSettings {
    try {
        const raw = localStorage.getItem(HISTORY_SETTINGS_KEY);
        if (!raw) return { browserEnabled: true, gameEnabled: true };
        const parsed = JSON.parse(raw);
        return {
            browserEnabled: parsed.browserEnabled !== false,
            gameEnabled: parsed.gameEnabled !== false,
        };
    } catch {
        return { browserEnabled: true, gameEnabled: true };
    }
}

export function setHistoryTrackingSettings(
    next: Partial<HistoryTrackingSettings>,
): HistoryTrackingSettings {
    const current = getHistoryTrackingSettings();
    const updated = { ...current, ...next };
    localStorage.setItem(HISTORY_SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("phosium:history-settings-updated"));
    return updated;
}

export function loadUnifiedHistory(): UnifiedHistoryEntry[] {
    try {
        const stored = localStorage.getItem(UNIFIED_HISTORY_KEY);
        if (stored) {
            const parsed: unknown = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed.filter(
                    (e): e is UnifiedHistoryEntry =>
                        typeof e === "object" &&
                        e !== null &&
                        typeof (e as UnifiedHistoryEntry).id === "string" &&
                        typeof (e as UnifiedHistoryEntry).title === "string" &&
                        typeof (e as UnifiedHistoryEntry).url === "string" &&
                        typeof (e as UnifiedHistoryEntry).visitedAt ===
                            "number" &&
                        ((e as UnifiedHistoryEntry).source === "browser" ||
                            (e as UnifiedHistoryEntry).source === "game"),
                );
            }
        }

        // Migrate legacy browser history if present
        const legacy = localStorage.getItem(LEGACY_BROWSER_HISTORY_KEY);
        if (legacy) {
            const parsedLegacy: unknown = JSON.parse(legacy);
            if (Array.isArray(parsedLegacy)) {
                const migrated: UnifiedHistoryEntry[] = parsedLegacy
                    .filter((e) =>
                        typeof e === "object" && e !== null &&
                        typeof e.url === "string"
                    )
                    .map((e) => ({
                        id: e.id || `migrated-${Date.now()}-${++seq}`,
                        title: e.title || e.url,
                        url: e.url,
                        visitedAt: typeof e.visitedAt === "number"
                            ? e.visitedAt
                            : Date.now(),
                        source: "browser",
                    }));
                saveUnifiedHistory(migrated);
                return migrated;
            }
        }
    } catch (err) {
        console.error("Could not load unified history.", err);
    }
    return [];
}

export function saveUnifiedHistory(entries: UnifiedHistoryEntry[]): void {
    const bounded = entries.slice(0, HISTORY_LIMIT);
    try {
        localStorage.setItem(UNIFIED_HISTORY_KEY, JSON.stringify(bounded));
        window.dispatchEvent(new Event("phosium:history-updated"));
    } catch (err) {
        console.error("Could not save unified history.", err);
    }
}

export function recordHistoryEntry(
    entry: Omit<UnifiedHistoryEntry, "id" | "visitedAt">,
): void {
    const settings = getHistoryTrackingSettings();
    if (entry.source === "browser" && !settings.browserEnabled) return;
    if (entry.source === "game" && !settings.gameEnabled) return;

    const visitedAt = Date.now();
    const current = loadUnifiedHistory();
    const next: UnifiedHistoryEntry = {
        ...entry,
        id: `hist-${visitedAt}-${++seq}`,
        visitedAt,
    };
    saveUnifiedHistory([next, ...current]);
}
