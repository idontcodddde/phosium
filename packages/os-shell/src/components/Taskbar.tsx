import React, { useEffect, useRef, useState } from 'react';
import type { WindowState } from '../types.js';

interface ContextMenuState {
    id: string;
    x: number;
    y: number;
}

interface TaskbarProps {
    windows: WindowState[];
    onToggleWindow: (id: string) => void;
    onCloseWindow: (id: string) => void;
    onOpenApp: (appId: string) => void;
}

export const Taskbar: React.FC<TaskbarProps> = ({ windows, onToggleWindow, onCloseWindow, onOpenApp }) => {
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
                setContextMenu(null);
            }
        };
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setContextMenu(null);
        };
        document.addEventListener('pointerdown', closeOnOutsidePointer);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, []);

    return (
        <footer className="os-taskbar">
            <button className="os-start-button" aria-label="Open app launcher" onClick={() => onOpenApp('start')}>
                <span className="os-brand-mark">P</span>
            </button>
            <div className="os-taskbar-apps">
                {windows.filter((win) => win.isOpen).map((win) => (
                    <button
                        className={`os-taskbar-app${!win.isMinimized ? ' is-active' : ''}`}
                        key={win.id}
                        onClick={() => onToggleWindow(win.id)}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            setContextMenu({
                                id: win.id,
                                x: Math.max(8, Math.min(event.clientX, window.innerWidth - 160)),
                                y: Math.max(8, Math.min(event.clientY, window.innerHeight - 90)),
                            });
                        }}
                        title={win.title}
                    >
                        <span className="os-app-glyph">{win.icon ?? win.title.charAt(0)}</span>
                        <span className="os-taskbar-app-title">{win.title}</span>
                    </button>
                ))}
            </div>
            {contextMenu && (
                <div
                    className="os-taskbar-context-menu"
                    ref={menuRef}
                    role="menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button role="menuitem" type="button" onClick={() => {
                        onToggleWindow(contextMenu.id);
                        setContextMenu(null);
                    }}>Focus</button>
                    <button role="menuitem" type="button" onClick={() => {
                        onCloseWindow(contextMenu.id);
                        setContextMenu(null);
                    }}>Close</button>
                </div>
            )}
            <div className="os-system-tray">
                {/* <span aria-label="Network connected">●</span> */}
                {/* <span>Phosium</span> */}
            </div>
        </footer>
    );
};