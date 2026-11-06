import React from 'react';
import type { WindowState } from '../types.js';
import { PhosiumIcon } from './PhosiumIcon.js';

interface WindowProps {
    window: WindowState;
    isAppFullscreen?: boolean;
    onClose: (id: string) => void;
    onMinimize: (id: string) => void;
    onMaximize: (id: string) => void;
    onFocus: (id: string) => void;
    onMove: (id: string, x: number, y: number, width: number, height: number) => void;
    onResize: (id: string, x: number, y: number, width: number, height: number) => void;
}

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

export const Window: React.FC<WindowProps> = ({
    window,
    isAppFullscreen = false,
    onClose,
    onMinimize,
    onMaximize,
    onFocus,
    onMove,
    onResize,
}) => {
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

    const handleResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>, corner: ResizeCorner) => {
        if (window.isMaximized || isAppFullscreen || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const handle = event.currentTarget;
        const startX = event.clientX;
        const startY = event.clientY;
        const element = handle.parentElement;
        if (!element) return;
        const startWidth = element.offsetWidth;
        const startHeight = element.offsetHeight;
        const startPosition = window.position ?? { x: element.offsetLeft, y: element.offsetTop };
        handle.setPointerCapture(event.pointerId);

        const handlePointerMove = (moveEvent: PointerEvent) => {
            if (!handle.hasPointerCapture(moveEvent.pointerId)) return;
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            const width = Math.max(340, startWidth + (corner.includes('e') ? deltaX : -deltaX));
            const height = Math.max(280, startHeight + (corner.includes('s') ? deltaY : -deltaY));
            onResize(
                window.id,
                startPosition.x + (corner.includes('w') ? startWidth - width : 0),
                startPosition.y + (corner.includes('n') ? startHeight - height : 0),
                width,
                height,
            );
        };
        const cleanup = () => {
            if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
            handle.removeEventListener('pointermove', handlePointerMove);
            handle.removeEventListener('pointerup', cleanup);
            handle.removeEventListener('pointercancel', cleanup);
        };

        handle.addEventListener('pointermove', handlePointerMove);
        handle.addEventListener('pointerup', cleanup, { once: true });
        handle.addEventListener('pointercancel', cleanup, { once: true });
    };

    return (
        <div
            className={`os-window${window.isMaximized ? ' is-maximized' : ''}${isAppFullscreen ? ' is-app-fullscreen' : ''}`}
            data-window-id={window.id}
            onClick={() => onFocus(window.id)}
            style={{
                zIndex: window.zIndex,
                ...(window.position && !window.isMaximized
                    ? { left: `${window.position.x}px`, top: `${window.position.y}px` }
                    : {}),
                ...(window.width && !window.isMaximized ? { width: `${window.width}px` } : {}),
                ...(window.height && !window.isMaximized ? { height: `${window.height}px` } : {}),
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
                    }}><PhosiumIcon name="minus" /></button>
                    <button aria-label="Maximize window" onClick={(event) => {
                        event.stopPropagation();
                        onMaximize(window.id);
                    }}><PhosiumIcon name="maximize" /></button>
                    <button aria-label="Close window" className="close" onClick={(event) => {
                        event.stopPropagation();
                        onClose(window.id);
                    }}><PhosiumIcon name="x" /></button>
                </div>
            </div>
            <div className="os-window-body">
                {window.component}
            </div>
            {!window.isMaximized && !isAppFullscreen && (['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <button
                    aria-label={`Resize window from ${corner === 'nw' ? 'top left' : corner === 'ne' ? 'top right' : corner === 'sw' ? 'bottom left' : 'bottom right'}`}
                    className={`os-window-resize-handle is-${corner}`}
                    key={corner}
                    onPointerDown={(event) => handleResizePointerDown(event, corner)}
                    type="button"
                />
            ))}
        </div>
    );
};