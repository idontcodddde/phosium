import { createContext, useContext } from 'react';

export interface WindowSummary {
    id: string;
    title: string;
    isOpen: boolean;
    isMinimized: boolean;
}

export interface WindowManagerContextValue {
    windows: WindowSummary[];
    closeWindow: (id: string) => void;
}

export const WindowManagerContext = createContext<WindowManagerContextValue | null>(null);

export function useWindowManager(): WindowManagerContextValue {
    const context = useContext(WindowManagerContext);
    if (!context) throw new Error('Window manager controls are only available inside the desktop.');
    return context;
}
