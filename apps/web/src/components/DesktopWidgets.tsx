import { useEffect, useRef, useState } from 'react';
import { useSystem } from '../SystemContext';
import { PhosiumIcon } from '@repo/os-shell';

type WispServer = { id: string; name: string; url: string; ping?: number | null };

function defaultWispUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/wisp/`;
}

function readWispServers(): WispServer[] {
    try {
        const saved = localStorage.getItem('phosium_wisp_servers');
        if (saved) {
            const parsed: unknown = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                const servers = parsed.filter((server): server is WispServer =>
                    typeof server?.id === 'string'
                    && typeof server?.name === 'string'
                    && typeof server?.url === 'string',
                );
                if (servers.length > 0) return servers;
            }
        }
    } catch (error) {
        console.error('Unable to load saved Wisp servers:', error);
    }

    return [{ id: 'local-host', name: 'Local Host Wisp', url: defaultWispUrl(), ping: null }];
}

export function DesktopWidgets() {
    const { proxySettings, updateProxySettings } = useSystem();
    const [servers, setServers] = useState(readWispServers);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [zIndex, setZIndex] = useState(5);
    const [now, setNow] = useState(() => new Date());
    const widgetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateServers = () => setServers(readWispServers());
        const updateClock = () => setNow(new Date());
        const interval = window.setInterval(updateClock, 30_000);
        window.addEventListener('phosium:wisp-servers-updated', updateServers);
        window.addEventListener('storage', updateServers);
        return () => {
            window.clearInterval(interval);
            window.removeEventListener('phosium:wisp-servers-updated', updateServers);
            window.removeEventListener('storage', updateServers);
        };
    }, []);

    useEffect(() => {
        const handleFocused = (event: Event) => {
            const nextZIndex = (event as CustomEvent<number>).detail;
            if (Number.isFinite(nextZIndex)) setZIndex(nextZIndex);
        };
        window.addEventListener('phosium:desktop-widgets-focused', handleFocused);
        return () => window.removeEventListener('phosium:desktop-widgets-focused', handleFocused);
    }, []);

    useEffect(() => {
        if (!isMenuOpen) return;
        const closeOnOutsideClick = (event: PointerEvent) => {
            if (event.target instanceof Node && !widgetRef.current?.contains(event.target)) setIsMenuOpen(false);
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsMenuOpen(false);
        };
        document.addEventListener('pointerdown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isMenuOpen]);

    const selectServer = (server: WispServer) => {
        updateProxySettings({ wispUrl: server.url });
        navigator.serviceWorker?.controller?.postMessage({ type: 'UPDATE_WISP', wispUrl: server.url });
        setIsMenuOpen(false);
    };

    return (
        <aside
            className="phosium-desktop-widgets"
            aria-label="Desktop controls"
            onPointerDownCapture={() => window.dispatchEvent(new Event('phosium:focus-desktop-widgets'))}
            style={{ zIndex }}
        >
            <div className="phosium-widget-clock">
                <PhosiumIcon className="phosium-widget-clock-icon" name="clock-3" />
                <span>
                    <strong>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                    <small>{now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</small>
                </span>
            </div>
            <div className="phosium-widget-actions" ref={widgetRef}>
                <button
                    type="button"
                    className={`phosium-widget-button phosium-widget-wifi${isMenuOpen ? ' is-selected' : ''}`}
                    aria-label="Choose Wisp server"
                    aria-expanded={isMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setIsMenuOpen((open) => !open)}
                >
                    <PhosiumIcon name="wifi" />
                </button>
                <button
                    type="button"
                    className="phosium-widget-button phosium-widget-close-all"
                    aria-label="Close all apps"
                    title="Close all apps"
                    onClick={() => window.dispatchEvent(new CustomEvent('phosium:close-all-windows'))}
                >
                    <PhosiumIcon name="x" />
                </button>
                {isMenuOpen && (
                    <div className="phosium-wisp-menu" role="menu" aria-label="Saved Wisp servers">
                        {servers.map((server) => {
                            const selected = server.url === proxySettings.wispUrl;
                            return (
                                <button
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={selected}
                                    className={`phosium-wisp-option${selected ? ' is-selected' : ''}`}
                                    key={server.id}
                                    onClick={() => selectServer(server)}
                                >
                                    <PhosiumIcon name="wifi" />
                                    <span className="phosium-wisp-option-details">
                                        <strong>{server.name}</strong>
                                        <small>{server.url}</small>
                                    </span>
                                    {typeof server.ping === 'number' && server.ping < 999
                                        ? <span className="phosium-wisp-ping">{server.ping}ms</span>
                                        : <span className="phosium-wisp-ping is-unknown">—</span>}
                                    {selected && <PhosiumIcon className="phosium-wisp-check" label="Selected" name="check" />}
                                </button>
                            );
                        })}
                        {servers.length === 0 && <p className="phosium-wisp-empty">Add a Wisp server in Settings.</p>}
                    </div>
                )}
            </div>
        </aside>
    );
}
