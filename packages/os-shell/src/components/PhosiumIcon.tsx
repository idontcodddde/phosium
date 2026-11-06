import { Icon } from "@iconify/react";
import type { CSSProperties } from "react";
import arrowDown from "@iconify-icons/lucide/arrow-down";
import arrowLeft from "@iconify-icons/lucide/arrow-left";
import arrowRight from "@iconify-icons/lucide/arrow-right";
import arrowUp from "@iconify-icons/lucide/arrow-up";
import arrowUpFromLine from "@iconify-icons/lucide/arrow-up-from-line";
import appWindow from "@iconify-icons/lucide/app-window";
import bookmark from "@iconify-icons/lucide/bookmark";
import braces from "@iconify-icons/lucide/braces";
import calculator from "@iconify-icons/lucide/calculator";
import check from "@iconify-icons/lucide/check";
import checkCircle from "@iconify-icons/lucide/check-circle";
import chessKnight from "@iconify-icons/lucide/chess-knight";
import chevronLeft from "@iconify-icons/lucide/chevron-left";
import chevronRight from "@iconify-icons/lucide/chevron-right";
import clock3 from "@iconify-icons/lucide/clock-3";
import command from "@iconify-icons/lucide/command";
import cornerDownLeft from "@iconify-icons/lucide/corner-down-left";
import diamond from "@iconify-icons/lucide/diamond";
import ellipsis from "@iconify-icons/lucide/ellipsis";
import file from "@iconify-icons/lucide/file";
import fileAudio from "@iconify-icons/lucide/file-audio";
import fileCode2 from "@iconify-icons/lucide/file-code-2";
import fileImage from "@iconify-icons/lucide/file-image";
import fileText from "@iconify-icons/lucide/file-text";
import folder from "@iconify-icons/lucide/folder";
import folderOpen from "@iconify-icons/lucide/folder-open";
import folderPlus from "@iconify-icons/lucide/folder-plus";
import gamepad2 from "@iconify-icons/lucide/gamepad-2";
import globe from "@iconify-icons/lucide/globe";
import grid2x2 from "@iconify-icons/lucide/grid-2x2";
import hardDrive from "@iconify-icons/lucide/hard-drive";
import history from "@iconify-icons/lucide/history";
import home from "@iconify-icons/lucide/home";
import image from "@iconify-icons/lucide/image";
import info from "@iconify-icons/lucide/info";
import list from "@iconify-icons/lucide/list";
import lockKeyhole from "@iconify-icons/lucide/lock-keyhole";
import maximize from "@iconify-icons/lucide/maximize";
import menu from "@iconify-icons/lucide/menu";
import minimize from "@iconify-icons/lucide/minimize";
import minus from "@iconify-icons/lucide/minus";
import music from "@iconify-icons/lucide/music";
import play from "@iconify-icons/lucide/play";
import plus from "@iconify-icons/lucide/plus";
import puzzle from "@iconify-icons/lucide/puzzle";
import rotateCw from "@iconify-icons/lucide/rotate-cw";
import server from "@iconify-icons/lucide/server";
import search from "@iconify-icons/lucide/search";
import settings from "@iconify-icons/lucide/settings";
import shieldCheck from "@iconify-icons/lucide/shield-check";
import sparkles from "@iconify-icons/lucide/sparkles";
import spade from "@iconify-icons/lucide/spade";
import star from "@iconify-icons/lucide/star";
import trash2 from "@iconify-icons/lucide/trash-2";
import video from "@iconify-icons/lucide/video";
import wifi from "@iconify-icons/lucide/wifi";
import x from "@iconify-icons/lucide/x";
import monitor from "@iconify-icons/lucide/monitor";

const icons = {
    'arrow-down': arrowDown,
    'arrow-left': arrowLeft,
    'arrow-right': arrowRight,
    'arrow-up': arrowUp,
    'arrow-up-from-line': arrowUpFromLine,
    'app-window': appWindow,
    bookmark,
    braces,
    calculator,
    check,
    'check-circle': checkCircle,
    'chess-knight': chessKnight,
    'chevron-left': chevronLeft,
    'chevron-right': chevronRight,
    'clock-3': clock3,
    command,
    'corner-down-left': cornerDownLeft,
    diamond,
    ellipsis,
    file,
    'file-audio': fileAudio,
    'file-code-2': fileCode2,
    'file-image': fileImage,
    'file-text': fileText,
    folder,
    'folder-open': folderOpen,
    'folder-plus': folderPlus,
    'gamepad-2': gamepad2,
    globe,
    'grid-2x2': grid2x2,
    'hard-drive': hardDrive,
    history,
    home,
    image,
    info,
    list,
    'lock-keyhole': lockKeyhole,
    maximize,
    menu,
    minimize,
    minus,
    music,
    play,
    plus,
    puzzle,
    'rotate-cw': rotateCw,
    server,
    search,
    settings,
    'shield-check': shieldCheck,
    sparkles,
    spade,
    star,
    'trash-2': trash2,
    video,
    wifi,
    x,
    monitor,
};

export type PhosiumIconName = keyof typeof icons;

interface PhosiumIconProps {
    name: PhosiumIconName;
    size?: number | string;
    className?: string;
    label?: string;
    style?: CSSProperties;
}

export function PhosiumIcon({ name, size = "1em", className, label, style }: PhosiumIconProps) {
    return (
        <Icon
            aria-hidden={label ? undefined : true}
            aria-label={label}
            className={className ? `phosium-icon ${className}` : "phosium-icon"}
            icon={icons[name]}
            style={style}
            width={size}
            height={size}
        />
    );
}
