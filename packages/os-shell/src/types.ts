export interface WindowState {
    id: string;
    title: string;
    icon?: string;
    description?: string;
    isOpen: boolean;
    isMinimized: boolean;
    isMaximized: boolean;
    zIndex: number;
    position?: { x: number; y: number };
    component: React.ReactNode;
}
