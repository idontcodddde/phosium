import type { ReactNode } from "react";

export interface WindowState {
    id: string;
    title: string;
    icon?: ReactNode;
    description?: string;
    width?: number;
    height?: number;
    isOpen: boolean;
    isMinimized: boolean;
    isMaximized: boolean;
    zIndex: number;
    position?: { x: number; y: number };
    component: React.ReactNode;
}
