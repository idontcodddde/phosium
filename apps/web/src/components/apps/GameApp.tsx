import { useState } from "react";
import { useSystem } from "../../SystemContext";
import gamesCatalogData from "../../assets/games.json";
import { loadGamesCatalog } from "../../lib/gameCatalog";

const { games, hubs: gameHubs } = loadGamesCatalog(gamesCatalogData);
const categories = ["All", ...new Set(games.map((game) => game.category).sort((a, b) => a.localeCompare(b)))];

export function GameApp() {
  const { openGame, proxySettings } = useSystem();
  const [view, setView] = useState<"discover" | "all-games" | "hubs">("discover");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const featuredGame = games.find((game) => game.featured) ?? games[0];
  const filteredGames = games.filter((game) =>
    (category === "All" || game.category === category)
      && game.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const filteredHubs = gameHubs.filter((hub) =>
    hub.title.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <main className="game-store">
      <header className="game-store-header">
        <div className="game-store-brand"><span className="game-brand-mark">P</span><span>PHOSIUM <b>GAMES</b></span></div>
        <nav aria-label="Game library navigation">
          <button aria-current={view === "discover" ? "page" : undefined} className={view === "discover" ? "is-current" : ""} onClick={() => setView("discover")} type="button">Discover</button>
          <button aria-current={view === "all-games" ? "page" : undefined} className={view === "all-games" ? "is-current" : ""} onClick={() => { setView("all-games"); setCategory("All"); }} type="button">All games</button>
          <button aria-current={view === "hubs" ? "page" : undefined} className={view === "hubs" ? "is-current" : ""} onClick={() => setView("hubs")} type="button">Game hubs</button>
        </nav>
        <label className="game-search">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search games" onChange={(event) => setSearch(event.target.value)} placeholder="Search games" value={search} />
        </label>
        <span className="game-profile">P</span>
      </header>
      <div className="game-store-content">
        {view === "discover" && <section className="game-feature">
          <div className="game-feature-copy">
            <span className="game-eyebrow">FEATURED · BROWSER GAME</span>
            <h1>Find your<br />next favorite.</h1>
            <p>Play a hand-picked collection of games right from your Phosium desktop.</p>
            <button type="button" onClick={() => openGame(featuredGame)}>Explore games <span>→</span></button>
          </div>
          <div className="game-feature-art" aria-hidden="true">
            <span className="feature-orbit orbit-one" />
            <span className="feature-orbit orbit-two" />
            <span className="feature-tile tile-two">◈</span>
            <span className="feature-tile tile-three">2048</span>
            <span className="feature-caption">YOUR NEXT<br />ADVENTURE</span>
          </div>
        </section>}

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
            {filteredGames.map((game) => (
              <article className="game-card" key={game.title}>
                <button className="game-card-launch" onClick={() => openGame(game)} type="button">
                  <span className={`game-card-art art-${game.tint}`}><span>{game.art}</span><i>▶</i></span>
                  <span className="game-card-info"><span><strong>{game.title}</strong><small>{game.category}</small></span><span className="game-play">▶</span></span>
                  <span className="game-card-detail">{game.detail}</span>
                </button>
              </article>
            ))}
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
                <button className="game-card-launch" onClick={() => openGame({ title: hub.title, url: hub.url })} type="button">
                  <span className={`game-card-art art-${hub.tint}`}><span>{hub.art}</span><i>▶</i></span>
                  <span className="game-card-info"><span><strong>{hub.title}</strong><small>Game hub</small></span><span className="game-play">▶</span></span>
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
