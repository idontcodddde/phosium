import { useState } from "react";
import { useSystem } from "./SystemContext";

const games = [
  { title: "2048", category: "Puzzle", url: "https://play2048.co/", art: "2048", tint: "mint", detail: "One more move. One more tile." },
  { title: "HexGL", category: "Racing", url: "https://hexgl.bkcore.com/", art: "HEX", tint: "blue", detail: "High-speed anti-gravity racing." },
  { title: "Cookie Clicker", category: "Idle", url: "https://orteil.dashnet.org/cookieclicker/", art: "COOKIE", tint: "amber", detail: "Build an increasingly sweet empire." },
  { title: "Wordle", category: "Puzzle", url: "https://www.nytimes.com/games/wordle/index.html", art: "WORD", tint: "green", detail: "A new word puzzle every day." },
  { title: "Little Alchemy 2", category: "Discovery", url: "https://littlealchemy2.com/", art: "ALCHEMY", tint: "violet", detail: "Combine elements and discover more." },
  { title: "Neal.fun", category: "Arcade", url: "https://neal.fun/", art: "FUN", tint: "pink", detail: "A collection of playful web experiments." },
  { title: "Tetris", category: "Puzzle", url: "https://tetris.com/play-tetris", art: "TETRIS", tint: "cyan", detail: "Stack, clear lines, and chase a high score." },
  { title: "Slither.io", category: "Arcade", url: "https://slither.io/", art: "SLITHER", tint: "lime", detail: "Grow your snake and outmaneuver rivals." },
  { title: "Agar.io", category: "Arcade", url: "https://agar.io/", art: "AGAR", tint: "blue", detail: "Grow your cell in a colorful arena." },
  { title: "Lichess", category: "Board", url: "https://lichess.org/", art: "CHESS", tint: "wood", detail: "Play chess puzzles and matches online." },
  { title: "Minesweeper", category: "Puzzle", url: "https://minesweeper.online/", art: "MINE", tint: "slate", detail: "Clear the field without hitting a mine." },
  { title: "Snake", category: "Arcade", url: "https://playsnake.org/", art: "SNAKE", tint: "green", detail: "A classic arcade snake game." },
  { title: "Minecraft Classic", category: "Sandbox", url: "https://classic.minecraft.net/", art: "CRAFT", tint: "block", detail: "Build in the original creative sandbox." },
  { title: "Solitaire", category: "Card", url: "https://cardgames.io/solitaire/", art: "♠", tint: "felt", detail: "A relaxing round of classic solitaire." },
  { title: "Jstris", category: "Puzzle", url: "https://jstris.jezevec10.com/", art: "JSTRIS", tint: "purple", detail: "Fast competitive falling-block puzzles." },
  { title: "Pac-Man", category: "Arcade", url: "https://www.google.com/logos/2010/pacman10-i.html", art: "PAC-MAN", tint: "yellow", detail: "Chomp dots and dodge the ghosts." },
  { title: "Slope", category: "Racing", url: "https://www.crazygames.com/game/slope", art: "SLOPE", tint: "red", detail: "Race a ball down a neon 3D course." },
  { title: "Chess.com", category: "Board", url: "https://www.chess.com/play/computer", art: "♞", tint: "wood", detail: "Play a quick game against the computer." },
];

const categories = ["All games", "Arcade", "Board", "Card", "Discovery", "Idle", "Puzzle", "Racing", "Sandbox"];

export function GameApp() {
  const { openGame, proxySettings } = useSystem();
  const [view, setView] = useState<"discover" | "all-games" | "hubs">("discover");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const gameHubs = [
    { title: "Poki", url: "https://poki.com/", art: "POKI", tint: "blue", detail: "A huge collection of free online games." },
    { title: "CrazyGames", url: "https://www.crazygames.com/", art: "CRAZY", tint: "red", detail: "Discover new browser games and popular hits." },
  ];
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
            <button type="button" onClick={() => openGame(games[0])}>Explore games <span>→</span></button>
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
            {["All", ...categories.filter((item) => item !== "All games")].map((item) => (
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
              <article className="game-card" key={hub.title}>
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
