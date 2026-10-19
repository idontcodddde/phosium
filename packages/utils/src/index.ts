/**
 * Safely normalizes and formats a URL string (ensuring https:// prefix).
 */
export function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
        return "https://" + trimmed;
    }
    return trimmed;
}

/**
 * Checks if a string is a valid URL or domain format.
 */
export function isValidUrl(input: string): boolean {
    try {
        const formatted = normalizeUrl(input);
        const parsed = new URL(formatted);
        return !!parsed.hostname && parsed.hostname.includes(".");
    } catch {
        return false;
    }
}

/**
 * Simple persistent storage helper with JSON serialization.
 */
export const storage = {
    get<T>(key: string, fallback: T): T {
        if (typeof window === "undefined") return fallback;
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : fallback;
        } catch {
            return fallback;
        }
    },
    set<T>(key: string, value: T): void {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            console.error("Storage write failed:", err);
        }
    },
};
