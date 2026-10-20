function installGamingTools(): void {
  if (document.getElementById("phosium-gaming-tools")) return;

  const panel = document.createElement("aside");
  panel.id = "phosium-gaming-tools";
  panel.innerHTML = `
    <button type="button" data-action="toggle" aria-expanded="true">Game tools <span>−</span></button>
    <div data-content>
      <div data-timer>00:00.00</div>
      <div data-controls>
        <button type="button" data-action="start">Start</button>
        <button type="button" data-action="pause">Pause</button>
        <button type="button" data-action="split">Split</button>
        <button type="button" data-action="reset">Reset</button>
      </div>
      <ol data-splits aria-label="Run splits"></ol>
      <label data-note-label>Run notes
        <textarea data-note placeholder="Splits, routes, reminders..."></textarea>
      </label>
      <span data-saved aria-live="polite"></span>
    </div>`;

  const style = document.createElement("style");
  style.textContent = `
    #phosium-gaming-tools { position:fixed; right:18px; bottom:18px; z-index:2147483647; width:248px; overflow:hidden; color:#eef1f5; background:#17191eeF; border:1px solid #3a3f48; border-radius:14px; box-shadow:0 10px 36px #0008; font:13px/1.4 system-ui,sans-serif; }
    #phosium-gaming-tools * { box-sizing:border-box; }
    #phosium-gaming-tools button { color:inherit; font:inherit; cursor:pointer; }
    #phosium-gaming-tools [data-action="toggle"] { display:flex; width:100%; justify-content:space-between; padding:11px 13px; background:#21252c; border:0; font-weight:650; }
    #phosium-gaming-tools [data-content] { padding:12px; }
    #phosium-gaming-tools [data-timer] { margin:0 0 10px; color:#8be9a7; font:700 32px/1.1 ui-monospace,monospace; text-align:center; font-variant-numeric:tabular-nums; }
    #phosium-gaming-tools [data-controls] { display:flex; gap:4px; margin-bottom:8px; }
    #phosium-gaming-tools [data-controls] button { flex:1; padding:6px 2px; background:#2b3038; border:1px solid #414752; border-radius:7px; font-size:11px; }
    #phosium-gaming-tools [data-controls] button:first-child { color:#102219; background:#8be9a7; border-color:#8be9a7; font-weight:700; }
    #phosium-gaming-tools [data-splits] { max-height:72px; margin:0 0 10px; padding-left:25px; overflow:auto; color:#bdc5cd; font:11px/1.7 ui-monospace,monospace; }
    #phosium-gaming-tools [data-splits]:empty { display:none; }
    #phosium-gaming-tools [data-note-label] { display:block; color:#c5cad3; font-size:11px; font-weight:600; }
    #phosium-gaming-tools textarea { display:block; width:100%; min-height:72px; margin-top:5px; padding:8px; resize:vertical; color:#f4f5f7; background:#101216; border:1px solid #373c45; border-radius:7px; font:12px/1.4 system-ui,sans-serif; }
    #phosium-gaming-tools [data-saved] { display:block; min-height:14px; margin-top:4px; color:#aab1bb; font-size:10px; }
    #phosium-gaming-tools[data-collapsed="true"] [data-content] { display:none; }
    #phosium-gaming-tools[data-collapsed="true"] { width:148px; }`;
  document.head.appendChild(style);
  document.body.appendChild(panel);

  const timerDisplay = panel.querySelector<HTMLElement>("[data-timer]");
  const savedLabel = panel.querySelector<HTMLElement>("[data-saved]");
  const note = panel.querySelector<HTMLTextAreaElement>("[data-note]");
  const splitList = panel.querySelector<HTMLOListElement>("[data-splits]");
  const gameKey = `phosium-game-notes:${location.pathname}`;
  let elapsed = 0;
  let startedAt: number | null = null;
  let animationFrame = 0;

  try {
    note!.value = localStorage.getItem(gameKey) ?? "";
  } catch (error) {
    console.warn("Phosium could not load game notes.", error);
  }

  const formatTime = (milliseconds: number): string => {
    const totalCentiseconds = Math.floor(milliseconds / 10);
    const minutes = Math.floor(totalCentiseconds / 6000);
    const seconds = Math.floor(totalCentiseconds / 100) % 60;
    const centiseconds = totalCentiseconds % 100;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  };

  const updateTimer = (): void => {
    const currentElapsed = startedAt === null
      ? elapsed
      : elapsed + performance.now() - startedAt;
    timerDisplay!.textContent = formatTime(currentElapsed);
    if (startedAt !== null) animationFrame = requestAnimationFrame(updateTimer);
  };

  const addSplit = (): void => {
    const currentElapsed = startedAt === null
      ? elapsed
      : elapsed + performance.now() - startedAt;
    const item = document.createElement("li");
    item.textContent = formatTime(currentElapsed);
    splitList!.appendChild(item);
  };

  panel.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    switch (button.dataset.action) {
      case "toggle": {
        const collapsed = panel.dataset.collapsed !== "true";
        panel.dataset.collapsed = String(collapsed);
        button.setAttribute("aria-expanded", String(!collapsed));
        button.querySelector("span")!.textContent = collapsed ? "+" : "−";
        break;
      }
      case "start":
        if (startedAt === null) {
          startedAt = performance.now();
          updateTimer();
        }
        break;
      case "pause":
        if (startedAt !== null) {
          elapsed += performance.now() - startedAt;
          startedAt = null;
          cancelAnimationFrame(animationFrame);
          updateTimer();
        }
        break;
      case "split":
        if (startedAt !== null) addSplit();
        break;
      case "reset":
        elapsed = 0;
        startedAt = null;
        cancelAnimationFrame(animationFrame);
        splitList!.replaceChildren();
        updateTimer();
        break;
    }
  });

  note!.addEventListener("input", () => {
    try {
      localStorage.setItem(gameKey, note!.value);
      savedLabel!.textContent = "Saved";
    } catch (error) {
      savedLabel!.textContent = "Could not save notes";
      console.error("Phosium could not save game notes.", error);
    }
  });
  updateTimer();
}

export const gamingToolsExtensionCode = installGamingTools.toString();
