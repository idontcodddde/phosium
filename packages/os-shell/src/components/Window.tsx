import React from 'react';
import type { WindowState } from '../types.js';

interface WindowProps {
    window: WindowState;
    onClose: (id: string) => void;
    onMinimize: (id: string) => void;
    onMaximize: (id: string) => void;
    onFocus: (id: string) => void;
    onMove: (id: string, x: number, y: number, width: number, height: number) => void;
}

export const Window: React.FC<WindowProps> = ({ window, onClose, onMinimize, onMaximize, onFocus, onMove }) => {
    if (!window.isOpen || window.isMinimized) return null;

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (window.isMaximized || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
        event.preventDefault();
        const titlebar = event.currentTarget;
        const startX = event.clientX;
        const startY = event.clientY;
        const startPosition = window.position ?? { x: 90, y: 62 };
        titlebar.setPointerCapture(event.pointerId);

        const handlePointerMove = (moveEvent: PointerEvent) => {
            if (!titlebar.hasPointerCapture(moveEvent.pointerId)) return;
            onMove(
                window.id,
                startPosition.x + moveEvent.clientX - startX,
                startPosition.y + moveEvent.clientY - startY,
                titlebar.parentElement?.offsetWidth ?? 0,
                titlebar.parentElement?.offsetHeight ?? 0,
            );
        };
        const cleanup = () => {
            if (titlebar.hasPointerCapture(event.pointerId)) titlebar.releasePointerCapture(event.pointerId);
            titlebar.removeEventListener('pointermove', handlePointerMove);
            titlebar.removeEventListener('pointerup', cleanup);
            titlebar.removeEventListener('pointercancel', cleanup);
        };

        titlebar.addEventListener('pointermove', handlePointerMove);
        titlebar.addEventListener('pointerup', cleanup, { once: true });
        titlebar.addEventListener('pointercancel', cleanup, { once: true });
    };

    return (
        <div
            className={`os-window${window.isMaximized ? ' is-maximized' : ''}`}
            data-window-id={window.id}
            onClick={() => onFocus(window.id)}
            style={{
                zIndex: window.zIndex,
                ...(window.position && !window.isMaximized
                    ? { left: `${window.position.x}px`, top: `${window.position.y}px` }
                    : {}),
            }}
        >
            <div
                className="os-window-titlebar"
                onDoubleClick={() => onMaximize(window.id)}
                onPointerDown={handlePointerDown}
            >
                <span className="os-window-title">
                    <span className="os-app-glyph">{window.icon ?? window.title.charAt(0)}</span>
                    {window.title}
                </span>
                <div className="os-window-controls">
                    <button aria-label="Minimize window" onClick={(event) => {
                        event.stopPropagation();
                        onMinimize(window.id);
                    }}>−</button>
                    <button aria-label="Maximize window" onClick={(event) => {
                        event.stopPropagation();
                        onMaximize(window.id);
                    }}>□</button>
                    <button aria-label="Close window" className="close" onClick={(event) => {
                        event.stopPropagation();
                        onClose(window.id);
                    }}>×</button>
                </div>
            </div>
            <div className="os-window-body">
                {window.component}
            </div>
        </div>
    );
};