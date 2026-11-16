import type { BrowserBookmark, BrowserHistoryEntry } from "../../types/browser";
import type { QuickAccessSiteConfig } from "../../../app.config";
import { resolveAddress } from "./address";
import type { SearchEngine } from "../../SystemContext";

export interface AutocompleteSuggestion {
    title: string;
    url: string;
    type: "bookmark" | "history" | "quick-access" | "site" | "search";
}

const COMMON_SITES = [
    { title: "YouTube", url: "https://www.youtube.com" },
    { title: "Google", url: "https://www.google.com" },
    { title: "GitHub", url: "https://github.com" },
    { title: "Wikipedia", url: "https://www.wikipedia.org" },
    { title: "Reddit", url: "https://www.reddit.com" },
    { title: "Discord", url: "https://discord.com" },
];

export function getLocalAutocompleteSuggestions(
    query: string,
    quickAccessSites: QuickAccessSiteConfig[],
    bookmarks: BrowserBookmark[],
    history: BrowserHistoryEntry[],
): AutocompleteSuggestion[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const map = new Map<string, AutocompleteSuggestion>();

    for (const qa of quickAccessSites) {
        if (
            qa.title.toLowerCase().includes(trimmed) ||
            qa.url.toLowerCase().includes(trimmed)
        ) {
            map.set(qa.url, {
                title: qa.title,
                url: qa.url,
                type: "quick-access",
            });
        }
    }

    for (const site of COMMON_SITES) {
        if (
            !map.has(site.url) &&
            (site.title.toLowerCase().includes(trimmed) ||
                site.url.toLowerCase().includes(trimmed))
        ) {
            map.set(site.url, {
                title: site.title,
                url: site.url,
                type: "site",
            });
        }
    }

    for (const bm of bookmarks) {
        if (
            !map.has(bm.url) &&
            (bm.title.toLowerCase().includes(trimmed) ||
                bm.url.toLowerCase().includes(trimmed))
        ) {
            map.set(bm.url, { title: bm.title, url: bm.url, type: "bookmark" });
        }
    }

    for (const entry of history) {
        if (
            !map.has(entry.url) &&
            (entry.title.toLowerCase().includes(trimmed) ||
                entry.url.toLowerCase().includes(trimmed))
        ) {
            map.set(entry.url, {
                title: entry.title,
                url: entry.url,
                type: "history",
            });
        }
    }

    return Array.from(map.values()).slice(0, 4);
}

export async function fetchSearchSuggestions(
    query: string,
    searchEngine: SearchEngine,
    signal?: AbortSignal,
): Promise<AutocompleteSuggestion[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.includes("://") || trimmed.includes(".")) return [];

    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve([]);
            return;
        }

        const callbackName = `google_sugg_${
            Math.random().toString(36).substring(2, 9)
        }`;
        const script = document.createElement("script");

        const cleanup = () => {
            delete (window as unknown as Record<string, unknown>)[callbackName];
            script.remove();
            signal?.removeEventListener("abort", onAbort);
        };

        const onAbort = () => {
            cleanup();
            resolve([]);
        };

        signal?.addEventListener("abort", onAbort);

        (window as unknown as Record<string, unknown>)[callbackName] = (data: unknown) => {
            cleanup();
            try {
                if (Array.isArray(data) && Array.isArray(data[1])) {
                    const suggestions = data[1].slice(0, 4).map((
                        s: unknown,
                    ) => ({
                        title: String(s),
                        url: resolveAddress(String(s), searchEngine),
                        type: "search" as const,
                    }));
                    resolve(suggestions);
                    return;
                }
            } catch (err) {
                console.error("Failed to parse search suggestions", err);
            }
            resolve([]);
        };

        script.onerror = () => {
            cleanup();
            resolve([]);
        };

        script.src =
            `https://suggestqueries.google.com/complete/search?client=chrome&q=${
                encodeURIComponent(
                    trimmed,
                )
            }&jsonp=${callbackName}`;
        document.body.appendChild(script);
    });
}
