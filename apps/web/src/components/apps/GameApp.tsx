import { useCallback, useEffect, useMemo, useState } from "react";
import { PhosiumIcon } from "@repo/os-shell";
import type { PhosiumIconName } from "@repo/os-shell";
import { useSystem } from "../../SystemContext";
import gamesCatalogData from "../../assets/games.json";
import { loadGamesCatalog } from "../../lib/gameCatalog";
import type { Game } from "../../types/gameCatalog";

const gameArtIcons: Record<string, PhosiumIconName> = {
  "chess-knight": "chess-knight",
  spade: "spade",
  gamepad: "gamepad-2",
};

function GameArt({ art }: { art: string }) {
  const icon = gameArtIcons[art];
  return icon ? <PhosiumIcon name={icon} /> : <span>{art}</span>;
}

function getCustomGameTitles(): Set<string> {
  try {
    const stored = localStorage.getItem("phosium_custom_games");
    if (!stored) return new Set();
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed
        .filter((item): item is { title: string } =>
          typeof item === "object" && item !== null && "title" in item && typeof item.title === "string",
        )
        .map((item) => item.title.trim().toLowerCase()),
    );
  } catch {
    return new Set();
  }
}

function pickRandomGames(source: Game[], count: number): Game[] {
  const shuffled = [...source];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPersonalizedGameOfTheDay(catalogGames: Game[]): Game {
  const date = getLocalDateKey(new Date());
  const storageKey = "phosium_personalized_game_of_the_day";

  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (stored && typeof stored === "object" && "date" in stored && "url" in stored) {
      const saved = stored as { date: unknown; url: unknown };
      if (saved.date === date && typeof saved.url === "string") {
        const existingGame = catalogGames.find((game) => game.url === saved.url);
        if (existingGame) return existingGame;
      }
    }
  } catch (error) {
    console.error("Could not load the personalized game of the day.", error);
  }

  const selectedGame = catalogGames[Math.floor(Math.random() * catalogGames.length)];
  if (!selectedGame) {
    throw new Error("Cannot select a daily game from an empty catalog.");
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify({ date, url: selectedGame.url }));
  } catch (error) {
    console.error("Could not save the personalized game of the day locally.", error);
  }
  return selectedGame;
}

export function GameApp() {
  const { openGame, proxySettings } = useSystem();
  const [catalog, setCatalog] = useState(() => loadGamesCatalog(gamesCatalogData));
  const [customTitles, setCustomTitles] = useState<Set<string>>(getCustomGameTitles);
  const { games, hubs: gameHubs } = catalog;

  const categories = useMemo(
    () => ["All", ...new Set(games.map((game) => game.category).sort((a, b) => a.localeCompare(b)))],
    [games],
  );

  const [view, setView] = useState<"discover" | "all-games" | "hubs">("discover");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [conveyorGames, setConveyorGames] = useState(() => pickRandomGames(games, Math.min(6, games.length)));
  const [gameOfTheDay, setGameOfTheDay] = useState(() => getPersonalizedGameOfTheDay(games));

  const reloadCatalog = useCallback(() => {
    const nextCatalog = loadGamesCatalog(gamesCatalogData);
    setCatalog(nextCatalog);
    setCustomTitles(getCustomGameTitles());
    setConveyorGames(pickRandomGames(nextCatalog.games, Math.min(6, nextCatalog.games.length)));
    setGameOfTheDay(getPersonalizedGameOfTheDay(nextCatalog.games));
  }, []);

  const deleteCustomGame = (titleToDelete: string) => {
    try {
      const stored = localStorage.getItem("phosium_custom_games");
      if (!stored) return;
      const parsed: unknown = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      const updated = parsed.filter(
        (item) =>
          !(typeof item === "object" &&
            item !== null &&
            "title" in item &&
            typeof item.title === "string" &&
            item.title.trim().toLowerCase() === titleToDelete.trim().toLowerCase()),
      );
      localStorage.setItem("phosium_custom_games", JSON.stringify(updated));
      window.dispatchEvent(new Event("phosium:games-updated"));
    } catch (error) {
      console.error("Could not delete custom game.", error);
    }
  };

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "phosium_custom_games") reloadCatalog();
    };
    window.addEventListener("phosium:games-updated", reloadCatalog);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("phosium:games-updated", reloadCatalog);
      window.removeEventListener("storage", handleStorage);
    };
  }, [reloadCatalog]);

  const filteredGames = games.filter((game) =>
    (category === "All" || game.category === category)
    && game.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const filteredHubs = gameHubs.filter((hub) =>
    hub.title.toLowerCase().includes(search.trim().toLowerCase()),
  );

  useEffect(() => {
    let activeDate = getLocalDateKey(new Date());
    const timer = window.setInterval(() => {
      const currentDate = getLocalDateKey(new Date());
      if (currentDate === activeDate) return;
      activeDate = currentDate;
      setGameOfTheDay(getPersonalizedGameOfTheDay(games));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [games]);

  return (
    <main className="game-store">
      <header className="game-store-header">
        <div className="game-store-brand"><img alt="" className="game-brand-mark" src="/logo.png" /><span>PHOSIUM <b>GAMES</b></span></div>
        <nav aria-label="Game library navigation">
          <button aria-current={view === "discover" ? "page" : undefined} className={view === "discover" ? "is-current" : ""} onClick={() => setView("discover")} type="button">Discover</button>
          <button aria-current={view === "all-games" ? "page" : undefined} className={view === "all-games" ? "is-current" : ""} onClick={() => { setView("all-games"); setCategory("All"); }} type="button">All games</button>
          <button aria-current={view === "hubs" ? "page" : undefined} className={view === "hubs" ? "is-current" : ""} onClick={() => setView("hubs")} type="button">Game hubs</button>
        </nav>
        <label className="game-search">
          <PhosiumIcon name="search" />
          <input aria-label="Search games" onChange={(event) => setSearch(event.target.value)} placeholder="Search games" value={search} />
        </label>
        <img alt="" className="game-profile" src="/logo.png" />
      </header>
      <div className="game-store-content">
        {view === "discover" && (
          <section aria-label="Discover featured games" className="game-discover">
            <article className="game-daily-pick">
              <div className={`game-daily-art art-${gameOfTheDay.tint}`}>
                <span><GameArt art={gameOfTheDay.art} /></span>
                <PhosiumIcon name="sparkles" />
              </div>
              <div className="game-daily-content">
                <span className="game-eyebrow">PERSONALIZED · TODAY</span>
                <h2>Game of the day</h2>
                <strong>{gameOfTheDay.title}</strong>
                <p>{gameOfTheDay.detail}</p>
                <button onClick={() => openGame(gameOfTheDay)} type="button">
                  Play today&apos;s pick <PhosiumIcon name="arrow-right" />
                </button>
              </div>
            </article>
            <section aria-label="Random game recommendations" className="game-conveyor-section">
              <div className="game-library-heading">
                <div><span className="game-eyebrow">MORE GAMES</span><h2>Picked for you</h2></div>
                <span>Refreshing selection</span>
              </div>
              <div className="game-conveyor">
                <div className="game-conveyor-track">
                  {[0, 1].map((copy) => (
                    <div aria-hidden={copy === 1} className="game-conveyor-group" key={copy}>
                      {conveyorGames.map((game) => (
                        <article className="game-card game-conveyor-card" key={`${copy}-${game.title}`}>
                          <button
                            className="game-card-launch"
                            onClick={() => openGame(game)}
                            tabIndex={copy === 1 ? -1 : undefined}
                            type="button"
                          >
                            <span className={`game-card-art art-${game.tint}`}><span><GameArt art={game.art} /></span><i><PhosiumIcon name="play" /></i></span>
                            <span className="game-card-info"><span><strong>{game.title}</strong><small>{game.category}</small></span><span className="game-play"><PhosiumIcon name="play" /></span></span>
                            <span className="game-card-detail">{game.detail}</span>
                          </button>
                        </article>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </section>
        )}
        {view !== "hubs" && <section className="game-library" aria-label="Game library">
          <div className="game-library-heading">
            <div><span className="game-eyebrow">{view === "all-games" ? "THE FULL LIBRARY" : "THE LIBRARY"}</span><h2>{view === "all-games" ? "All games" : "Discover games"}</h2></div>
            <span>{filteredGames.length} titles</span>
          </div>
          <div className="game-categories" role="group" aria-label="Filter game category">
            {categories.map((item) => (
              <button
                aria-pressed={category === item}
                className={category === item ? "is-selected" : ""}
                key={item}
                onClick={() => setCategory(item)}
                type="button"
              >{item}</button>
            ))}
          </div>
          <div className="game-grid">
            {filteredGames.map((game) => {
              const isCustom = customTitles.has(game.title.trim().toLowerCase());
              return (
                <article className="game-card" key={game.title} style={{ position: "relative" }}>
                  <button className="game-card-launch" onClick={() => openGame(game)} type="button">
                    <span className={`game-card-art art-${game.tint}`}><span><GameArt art={game.art} /></span><i><PhosiumIcon name="play" /></i></span>
                    <span className="game-card-info"><span><strong>{game.title}</strong><small>{game.category}</small></span><span className="game-play"><PhosiumIcon name="play" /></span></span>
                    <span className="game-card-detail">{game.detail}</span>
                  </button>
                  {isCustom && (
                    <button
                      aria-label={`Delete ${game.title}`}
                      className="game-card-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteCustomGame(game.title);
                      }}
                      title="Delete custom game"
                      type="button"
                    >
                      <PhosiumIcon name="x" size={14} />
                    </button>
                  )}
                </article>
              );
            })}
            {filteredGames.length === 0 && <p className="game-empty">No games match that search.</p>}
          </div>
          <footer className="game-store-footer">
            <span>Games open in their own desktop window.</span>
            <span>{proxySettings.enabled ? `System proxy · ${proxySettings.engine}` : "Direct connection"}</span>
          </footer>
        </section>}

        {view === "hubs" && <section className="game-library" aria-label="Game hubs">
          <div className="game-library-heading">
            <div><span className="game-eyebrow">PLAY MORE</span><h2>Game hubs</h2></div>
            <span>{filteredHubs.length} hubs</span>
          </div>
          <div className="game-grid">
            {filteredHubs.map((hub) => (
              <article className="game-card" key={hub.url}>
                <button className="game-card-launch" onClick={() => openGame({ title: hub.title, url: hub.url, isHub: true })} type="button">
                  <span className={`game-card-art art-${hub.tint}`}><span>{hub.art}</span><i><PhosiumIcon name="play" /></i></span>
                  <span className="game-card-info"><span><strong>{hub.title}</strong><small>Game hub</small></span><span className="game-play"><PhosiumIcon name="play" /></span></span>
                  <span className="game-card-detail">{hub.detail}</span>
                </button>
              </article>
            ))}
            {filteredHubs.length === 0 && <p className="game-empty">No game hubs match that search.</p>}
          </div>
          <footer className="game-store-footer">
            <span>Game hubs open in their own desktop window.</span>
            <span>{proxySettings.enabled ? `System proxy · ${proxySettings.engine}` : "Direct connection"}</span>
          </footer>
        </section>}
      </div>
    </main>
  );
}