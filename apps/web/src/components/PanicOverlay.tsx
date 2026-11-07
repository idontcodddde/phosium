import { useEffect, useRef } from "react";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import { proxyConfig } from "@repo/proxy";
import { encodeRammerheadUrl } from "../lib/proxy/rammerheadClient";
import { useSystem } from "../SystemContext";

interface PanicOverlayProps {
    active: boolean;
    panicKey: string;
    panicKeyEnabled: boolean;
    url: string;
    onToggle: () => void;
}

export function PanicOverlay({
    active,
    panicKey,
    panicKeyEnabled,
    url,
    onToggle,
}: PanicOverlayProps) {
    const { controller, proxySettings, proxyStatus } = useSystem();
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const frameRef = useRef<Frame | null>(null);
    const handledDocumentsRef = useRef(new WeakSet<Document>());

    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        if (!active) {
            iframe.src = "about:blank";
            return;
        }

        const readyStatus = proxySettings.engine === "rammerhead"
            ? "Rammerhead ready"
            : `${proxySettings.engine === "scramjet" ? "Scramjet" : "Ultraviolet"} ready · ${proxySettings.transport}`;
        if (proxySettings.enabled && proxyStatus !== readyStatus) return;
        if (proxySettings.enabled && proxySettings.engine === "scramjet" && !controller) return;

        let cancelled = false;
        const route = async () => {
            try {
                if (!proxySettings.enabled) {
                    iframe.src = url;
                } else if (proxySettings.engine === "scramjet") {
                    frameRef.current ??= controller!.createFrame(iframe);
                    frameRef.current.go(proxyConfig.getProxiedUrl(url, "scramjet"));
                } else if (proxySettings.engine === "ultraviolet") {
                    iframe.src = proxyConfig.getProxiedUrl(url, "ultraviolet");
                } else {
                    const rammerheadUrl = await encodeRammerheadUrl(url);
                    if (!cancelled) iframe.src = rammerheadUrl;
                }
            } catch (error) {
                if (!cancelled) console.error("Could not route the panic website:", error);
            }
        };

        void route();
        return () => {
            cancelled = true;
        };
    }, [active, controller, proxySettings, proxyStatus, url]);

    return (
        <div
            aria-hidden={!active}
            aria-label="Panic screen"
            className={`panic-overlay${active ? " is-active" : ""}`}
            role="dialog"
            aria-modal={active || undefined}
        >
            <iframe
                onLoad={(event) => {
                    if (!active) return;
                    try {
                        const frameDocument = event.currentTarget.contentDocument;
                        if (!frameDocument || handledDocumentsRef.current.has(frameDocument)) return;
                        frameDocument.addEventListener("keydown", (frameEvent) => {
                            if (!panicKeyEnabled || frameEvent.key !== panicKey) return;
                            const target = frameEvent.target;
                            if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]")) return;
                            frameEvent.preventDefault();
                            frameEvent.stopImmediatePropagation();
                            onToggle();
                        });
                        handledDocumentsRef.current.add(frameDocument);
                    } catch {
                        // Some destinations keep their frame document cross-origin and inaccessible.
                    }
                }}
                ref={iframeRef}
                title="Panic destination"
            />
        </div>
    );
}
