import { useCallback, useEffect, useRef, useState } from "react";
import { Phosphorus } from "phosphorous";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
import { PhosiumIcon } from "@repo/os-shell";
import { proxyConfig } from "@repo/proxy";
import { applyPhosiumExtensionStates, registerPhosiumExtensions } from "../../extensions/phosphorousExtensions";
import { encodeRammerheadUrl } from "../../lib/proxy/rammerheadClient";
import { useSystem } from "../../SystemContext";

interface GamePlayerAppProps {
  title: string;
  url: string;
}

export function GamePlayerApp({ title, url }: GamePlayerAppProps) {
  const {
    controller,
    gameEnhancementsEnabled,
    gameGamingToolsEnabled,
    gameAdBlockerEnabled,
    phosphorousEnabled,
    externalExtensions,
    setExternalExtensions,
    setGameEnhancementsEnabled,
    setGameGamingToolsEnabled,
    setGameAdBlockerEnabled,
    proxySettings,
    proxyStatus,
    panicKeyEnabled,
    panicKey,
  } = useSystem();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const phosphorusRef = useRef<Phosphorus | null>(null);
  const frameRef = useRef<Frame | null>(null);
  const routeRevisionRef = useRef(0);
  const panicSettingsRef = useRef({ enabled: panicKeyEnabled, key: panicKey });
  const panicKeyDocumentsRef = useRef(new WeakSet<Document>());
  const extensionStateRef = useRef({
    phosphorousEnabled,
    enhancementsEnabled: gameEnhancementsEnabled,
    gamingToolsEnabled: gameGamingToolsEnabled,
    adBlockerEnabled: gameAdBlockerEnabled,
    externalExtensions,
  });
  const [extensionsOpen, setExtensionsOpen] = useState(false);
  const [routeError, setRouteError] = useState("");
  const readyStatus = proxySettings.engine === "rammerhead"
    ? "Rammerhead ready"
    : `${proxySettings.engine === "scramjet" ? "Scramjet" : "Ultraviolet"} ready · ${proxySettings.transport}`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const phosphorus = new Phosphorus();
    registerPhosiumExtensions(phosphorus, externalExtensions);
    const initialStates = extensionStateRef.current;
    applyPhosiumExtensionStates(phosphorus, {
      enhancementsEnabled: initialStates.phosphorousEnabled && initialStates.enhancementsEnabled,
      gamingToolsEnabled: initialStates.phosphorousEnabled && initialStates.gamingToolsEnabled,
      adBlockerEnabled: initialStates.phosphorousEnabled && initialStates.adBlockerEnabled,
      phosphorousEnabled: initialStates.phosphorousEnabled,
      externalExtensions: initialStates.externalExtensions,
    });
    phosphorusRef.current = phosphorus;
    const detach = phosphorus.attachToIframe(iframe);

    return () => {
      detach();
      phosphorusRef.current = null;
    };
  }, [externalExtensions]);

  const routeGame = useCallback(async () => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const revision = ++routeRevisionRef.current;
    if (proxySettings.enabled && proxyStatus !== readyStatus) return;
    if (proxySettings.enabled && proxySettings.engine === "scramjet" && !controller) return;
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
        if (routeRevisionRef.current !== revision) return;
        iframe.src = rammerheadUrl;
      }
      if (routeRevisionRef.current === revision) {
        // Clear the prior route error after the async proxy navigation succeeds.
        // oxlint-disable-next-line react/set-state-in-effect
        setRouteError("");
      }
    } catch (error) {
      if (routeRevisionRef.current !== revision) return;
      console.error(`Could not open ${title} through the configured proxy.`, error);
      setRouteError(error instanceof Error ? error.message : String(error));
    }
  }, [controller, proxySettings, proxyStatus, readyStatus, title, url]);

  const refreshGame = useCallback(() => {
    void routeGame();
  }, [routeGame]);

  const toggleExternalExtension = (id: string, enabled: boolean) => {
    setExternalExtensions(externalExtensions.map((extension) =>
      extension.id === id ? { ...extension, enabled } : extension,
    ));
  };

  useEffect(() => {
    panicSettingsRef.current = { enabled: panicKeyEnabled, key: panicKey };
  }, [panicKeyEnabled, panicKey]);

  const handleGameFrameLoad = () => {
    let frameDocument: Document | null;
    try {
      frameDocument = iframeRef.current?.contentDocument ?? null;
    } catch {
      return;
    }
    if (!frameDocument) return;
    if (!panicKeyDocumentsRef.current.has(frameDocument)) {
      frameDocument.addEventListener("keydown", (event) => {
        const panic = panicSettingsRef.current;
        if (!panic.enabled || event.key !== panic.key) return;
        const target = event.target as Element | null;
        if (target?.closest("input, textarea, select, [contenteditable]")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.dispatchEvent(new Event("phosium:panic-toggle"));
      });
      panicKeyDocumentsRef.current.add(frameDocument);
    }
  };

  useEffect(() => {
    // Re-route the external game after its Phosphorous settings change.
    // oxlint-disable-next-line react/set-state-in-effect
    void routeGame();
  }, [routeGame]);

  useEffect(() => {
    if (phosphorusRef.current) {
      applyPhosiumExtensionStates(phosphorusRef.current, {
        enhancementsEnabled: phosphorousEnabled && gameEnhancementsEnabled,
        gamingToolsEnabled: phosphorousEnabled && gameGamingToolsEnabled,
        adBlockerEnabled: phosphorousEnabled && gameAdBlockerEnabled,
        phosphorousEnabled,
        externalExtensions,
      });
    }
    const previous = extensionStateRef.current;
    const changed = previous.phosphorousEnabled !== phosphorousEnabled
      || previous.enhancementsEnabled !== gameEnhancementsEnabled
      || previous.gamingToolsEnabled !== gameGamingToolsEnabled
      || previous.adBlockerEnabled !== gameAdBlockerEnabled
      || previous.externalExtensions !== externalExtensions;
    extensionStateRef.current = {
      phosphorousEnabled,
      enhancementsEnabled: gameEnhancementsEnabled,
      gamingToolsEnabled: gameGamingToolsEnabled,
      adBlockerEnabled: gameAdBlockerEnabled,
      externalExtensions,
    };
    const iframe = iframeRef.current;
    if (changed && iframe) {
      refreshGame();
    }
  }, [phosphorousEnabled, gameEnhancementsEnabled, gameGamingToolsEnabled, gameAdBlockerEnabled, externalExtensions, refreshGame, title]);

  return (
    <div className="game-player">
      <div className="game-player-toolbar">
        <span className="game-player-title">{title}</span>
        <div className="game-player-actions">
          <button aria-label={`Refresh ${title}`} onClick={refreshGame} type="button"><PhosiumIcon name="rotate-cw" /></button>
          <div className="game-player-extension-menu">
            <button
              aria-label="Game extensions"
              aria-expanded={extensionsOpen}
              onClick={() => setExtensionsOpen((open) => !open)}
              type="button"
            ><PhosiumIcon name="puzzle" /></button>
            {extensionsOpen && (
              <div className="game-player-extension-popup" role="dialog" aria-label="Game extensions">
                <strong>Game extensions</strong>
                <label>
                  <span>Page enhancements</span>
                  <input aria-label="Game page enhancements" checked={gameEnhancementsEnabled} disabled={!phosphorousEnabled} onChange={(event) => setGameEnhancementsEnabled(event.target.checked)} type="checkbox" />
                </label>
                <label>
                  <span>Gaming tools</span>
                  <input aria-label="Game gaming tools" checked={gameGamingToolsEnabled} disabled={!phosphorousEnabled} onChange={(event) => setGameGamingToolsEnabled(event.target.checked)} type="checkbox" />
                </label>
                <label>
                  <span>Ad blocker</span>
                  <input aria-label="Game ad blocker" checked={gameAdBlockerEnabled} disabled={!phosphorousEnabled} onChange={(event) => setGameAdBlockerEnabled(event.target.checked)} type="checkbox" />
                </label>
                {externalExtensions.length > 0 && (
                  <>
                    <div className="game-player-extension-section-heading">External extensions</div>
                    {externalExtensions.map((extension) => (
                      <label key={extension.id}>
                        <span>
                          <strong>{extension.name}</strong>
                          <small>{extension.type?.toUpperCase() ?? "EXTENSION"} · {extension.id}</small>
                        </span>
                        <input
                          aria-label={`Game ${extension.name} extension`}
                          checked={extension.enabled}
                          disabled={!phosphorousEnabled}
                          onChange={(event) => toggleExternalExtension(extension.id, event.target.checked)}
                          type="checkbox"
                        />
                      </label>
                    ))}
                  </>
                )}
                <small>{phosphorousEnabled ? "These settings only affect game windows." : "Phosphorous is turned off in Settings."}</small>
              </div>
            )}
          </div>
        </div>
      </div>
      <iframe
        allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; gamepad"
        className="game-player-frame"
        onLoad={handleGameFrameLoad}
        ref={iframeRef}
        title={title}
      />
      {(routeError || (proxySettings.enabled && proxyStatus !== readyStatus)) && (
        <div className="game-player-status" role="status">
          {routeError || `Waiting for ${proxySettings.engine} proxy: ${proxyStatus}`}
        </div>
      )}
    </div>
  );
}
