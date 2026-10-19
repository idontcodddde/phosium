import React, { useEffect, useRef, useState } from 'react';
import type { WindowState } from '../types.js';
import { Window } from './Window.js';
import { Taskbar } from './Taskbar.js';

interface DesktopProps {
    initialWindows?: WindowState[];
    children?: React.ReactNode;
}

export const Desktop: React.FC<DesktopProps> = ({ initialWindows = [] }) => {
    const [windows, setWindows] = useState<WindowState[]>(initialWindows);
    const highestZ = useRef(10);
    const nextWindowId = useRef(0);
    const [startMenuOpen, setStartMenuOpen] = useState(false);
    const desktopRef = useRef<HTMLDivElement>(null);

    const focusWindow = (id: string) => {
        highestZ.current += 1;
        const nextZ = highestZ.current;
        setWindows((current) => current.map((window) => window.id === id
            ? { ...window, zIndex: nextZ, isOpen: true, isMinimized: false }
            : window));
    };

    const openNewWindow = (id: string) => {
        const source = windows.find((window) => window.id === id);
        if (!source) return;
        highestZ.current += 1;
        const instance = ++nextWindowId.current;
        const position = source.position ?? { x: 90, y: 50 };
        setWindows((current) => [...current, {
            ...source,
            id: `${source.id}-window-${instance}`,
            title: `${source.title} ${instance + 1}`,
            isOpen: true,
            isMinimized: false,
            isMaximized: false,
            zIndex: highestZ.current,
            position: { x: position.x + 28, y: position.y + 28 },
        }]);
    };

    const handleMove = (id: string, x: number, y: number, width: number, height: number) => {
        const desktop = desktopRef.current;
        if (!desktop) return;
        const maxX = Math.max(0, desktop.clientWidth - width);
        const maxY = Math.max(34, desktop.clientHeight - height - 60);
        setWindows((current) => current.map((window) => window.id === id
            ? { ...window, position: { x: Math.min(maxX, Math.max(0, x)), y: Math.min(maxY, Math.max(34, y)) } }
            : window));
    };

    const handleClose = (id: string) => {
        setWindows((current) => current.map((w) => w.id === id ? { ...w, isOpen: false } : w));
    };

    const handleMinimize = (id: string) => {
        setWindows((current) => current.map((w) => w.id === id ? { ...w, isMinimized: true } : w));
    };

    const handleMaximize = (id: string) => {
        setWindows((current) => current.map((w) => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w));
    };

    const handleToggleWindow = (id: string) => {
        focusWindow(id);
    };

    useEffect(() => {
        const handleOpenWindow = (event: Event) => {
            const windowState = (event as CustomEvent<WindowState>).detail;
            if (!windowState || typeof windowState.id !== 'string') return;
            setWindows((current) => {
                const existing = current.find((window) => window.id === windowState.id);
                if (existing) {
                    highestZ.current += 1;
                    return current.map((window) => window.id === windowState.id
                        ? { ...window, zIndex: highestZ.current, isOpen: true, isMinimized: false }
                        : window);
                }
                highestZ.current += 1;
                return [...current, { ...windowState, zIndex: highestZ.current }];
            });
        };
        const handleFocusWindow = (event: Event) => {
            const id = (event as CustomEvent<string>).detail;
            if (typeof id !== 'string') return;
            highestZ.current += 1;
            const nextZ = highestZ.current;
            setWindows((current) => current.map((window) => window.id === id
                ? { ...window, zIndex: nextZ, isOpen: true, isMinimized: false }
                : window));
        };
        window.addEventListener('phosium:open-window', handleOpenWindow);
        window.addEventListener('phosium:focus-window', handleFocusWindow);
        return () => {
            window.removeEventListener('phosium:open-window', handleOpenWindow);
            window.removeEventListener('phosium:focus-window', handleFocusWindow);
        };
    }, []);

    return (
        <div className="os-desktop" ref={desktopRef}>
            <header className="os-topbar">
                <span className="os-brand">PHOSIUM</span>
                <span className="os-topbar-center">Workspace</span>
            </header>
            <div className="os-desktop-icons">
                {initialWindows.map((app) => (
                    <button className="os-desktop-icon" key={app.id} onClick={() => handleToggleWindow(app.id)} onDoubleClick={() => openNewWindow(app.id)}>
                        <span className="os-desktop-icon-glyph">{app.icon ?? app.title.charAt(0)}</span>
                        <span>{app.title}</span>
                    </button>
                ))}
            </div>
            {windows.map((win) => (
                <Window
                    key={win.id}
                    window={win}
                    onClose={handleClose}
                    onMinimize={handleMinimize}
                    onMaximize={handleMaximize}
                    onFocus={focusWindow}
                    onMove={handleMove}
                />
            ))}
            {startMenuOpen && (
                <div className="os-start-menu" role="menu">
                    <div className="os-start-heading">
                        <span className="os-brand-mark">P</span>
                        <div><strong>Phosium</strong><small>Your web workspace</small></div>
                    </div>
                    <div className="os-start-section">APPS</div>
                    {initialWindows.map((app) => (
                        <div className="os-start-app-row" key={app.id}>
                            <button className="os-start-app" onClick={() => {
                                focusWindow(app.id);
                                setStartMenuOpen(false);
                            }}>
                                <span className="os-app-glyph">{app.icon ?? app.title.charAt(0)}</span>
                                <span><strong>{app.title}</strong><small>{app.description ?? 'Open app'}</small></span>
                            </button>
                            <button aria-label={`Open new ${app.title} window`} className="os-start-new-window" onClick={() => {
                                openNewWindow(app.id);
                                setStartMenuOpen(false);
                            }}>+</button>
                        </div>
                    ))}
                    <div className="os-start-footer">Phosium Web OS</div>
                </div>
            )}
            <Taskbar
                windows={windows}
                onToggleWindow={handleToggleWindow}
                onCloseWindow={handleClose}
                onOpenApp={() => setStartMenuOpen((open) => !open)}
            />
        </div>
    );
};