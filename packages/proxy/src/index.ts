export type ProxyEngineType = "ultraviolet" | "scramjet" | "rammerhead";
export type ProxyUrlEngineType = Exclude<ProxyEngineType, "rammerhead">;
export type ProxyTransportType = "epoxy" | "libcurl";

export interface ProxySettings {
    enabled: boolean;
    engine: ProxyEngineType;
    transport: ProxyTransportType;
    wispUrl: string;
}

function getDefaultWispUrl(): string {
    if (typeof window === "undefined") {
        return "ws://localhost:8080/wisp/";
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/wisp/`;
}

export const proxyManager = {
    getSettings(): ProxySettings {
        if (typeof window === "undefined") {
            return {
                enabled: true,
                engine: "scramjet",
                transport: "epoxy",
                wispUrl: getDefaultWispUrl(),
            };
        }
        return {
            enabled: localStorage.getItem("system_proxy") !== "false",
            engine: getStoredEngine(),
            transport: getStoredTransport(),
            wispUrl: localStorage.getItem("wisp_url") || getDefaultWispUrl(),
        };
    },

    setSettings(settings: Partial<ProxySettings>): void {
        if (typeof window === "undefined") return;
        if (settings.enabled !== undefined) {
            localStorage.setItem("system_proxy", String(settings.enabled));
        }
        if (settings.engine !== undefined) {
            localStorage.setItem("proxy_engine", settings.engine);
        }
        if (settings.transport !== undefined) {
            localStorage.setItem("proxy_transport", settings.transport);
        }
        if (settings.wispUrl !== undefined) {
            localStorage.setItem("wisp_url", settings.wispUrl);
        }
    },

    getProxiedUrl(targetUrl: string, engine: ProxyUrlEngineType): string {
        const normalizedUrl = new URL(
            /^[a-z][a-z\d+.-]*:\/\//i.test(targetUrl)
                ? targetUrl
                : `https://${targetUrl}`,
        );
        if (normalizedUrl.protocol !== "http:" && normalizedUrl.protocol !== "https:") {
            throw new TypeError("Only HTTP and HTTPS addresses are supported.");
        }

        if (engine === "scramjet") {
            // Scramjet v2 generates a frame-specific service-worker route in Frame.go().
            return normalizedUrl.href;
        }
        return `/uv/service/${encodeURIComponent(normalizedUrl.href)}`;
    },
};

function getStoredEngine(): ProxyEngineType {
    const engine = localStorage.getItem("proxy_engine");
    return engine === "ultraviolet" || engine === "scramjet" || engine === "rammerhead"
        ? engine
        : "scramjet";
}

function getStoredTransport(): ProxyTransportType {
    return localStorage.getItem("proxy_transport") === "libcurl"
        ? "libcurl"
        : "epoxy";
}

export const proxyConfig = {
    encodeUrl: (url: string): string =>
        proxyManager.getProxiedUrl(url, "scramjet"),
    decodeUrl: (encoded: string): string => decodeURIComponent(encoded),
    ...proxyManager,
};
