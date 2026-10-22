import { useCallback, useEffect, useRef, useState } from "react";
import { Phosphorus } from "phosphorous";
import type { Frame } from "@mercuryworkshop/scramjet-controller";
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
    setGameEnhancementsEnabled,
    setGameGamingToolsEnabled,
    setGameAdBlockerEnabled,
    proxySettings,
    proxyStatus,
  } = useSystem();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const phosphorusRef = useRef<Phosphorus | null>(null);
  const frameRef = useRef<Frame | null>(null);
  const routeRevisionRef = useRef(0);
  const extensionStateRef = useRef({
    phosphorousEnabled,
    enhancementsEnabled: gameEnhancementsEnabled,
    gamingToolsEnabled: gameGamingToolsEnabled,
    adBlockerEnabled: gameAdBlockerEnabled,
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
    registerPhosiumExtensions(phosphorus);
    const initialStates = extensionStateRef.current;
    applyPhosiumExtensionStates(phosphorus, {
      enhancementsEnabled: initialStates.phosphorousEnabled && initialStates.enhancementsEnabled,
      gamingToolsEnabled: initialStates.phosphorousEnabled && initialStates.gamingToolsEnabled,
      adBlockerEnabled: initialStates.phosphorousEnabled && initialStates.adBlockerEnabled,
    });
    phosphorusRef.current = phosphorus;
    const detach = phosphorus.attachToIframe(iframe);

    return () => {
      detach();
      phosphorusRef.current = null;
    };
  }, []);

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
      });
    }
    const previous = extensionStateRef.current;
    const changed = previous.phosphorousEnabled !== phosphorousEnabled
      || previous.enhancementsEnabled !== gameEnhancementsEnabled
      || previous.gamingToolsEnabled !== gameGamingToolsEnabled
      || previous.adBlockerEnabled !== gameAdBlockerEnabled;
    extensionStateRef.current = {
      phosphorousEnabled,
      enhancementsEnabled: gameEnhancementsEnabled,
      gamingToolsEnabled: gameGamingToolsEnabled,
      adBlockerEnabled: gameAdBlockerEnabled,
    };
    const iframe = iframeRef.current;
    if (changed && iframe) {
      refreshGame();
    }
  }, [phosphorousEnabled, gameEnhancementsEnabled, gameGamingToolsEnabled, gameAdBlockerEnabled, refreshGame, title]);

  return (
    <div className="game-player">
      <div className="game-player-toolbar">
        <span className="game-player-title">{title}</span>
        <div className="game-player-actions">
          <button aria-label={`Refresh ${title}`} onClick={refreshGame} type="button">↻</button>
          <div className="game-player-extension-menu">
            <button
              aria-label="Game extensions"
              aria-expanded={extensionsOpen}
              onClick={() => setExtensionsOpen((open) => !open)}
              type="button"
            ><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 3a3 3 0 1 1 6 0v2h3a2 2 0 0 1 2 2v3h-2a3 3 0 1 0 0 6h2v3a2 2 0 0 1-2 2h-3v-2a3 3 0 1 0-6 0v2H6a2 2 0 0 1-2-2v-3h2a3 3 0 1 0 0-6H4V7a2 2 0 0 1 2-2h3V3Z" /></svg></button>
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
                <small>{phosphorousEnabled ? "These settings only affect game windows." : "Phosphorous is turned off in Settings."}</small>
              </div>
            )}
          </div>
        </div>
      </div>
      <iframe
        allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; fullscreen; gamepad"
        className="game-player-frame"
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
