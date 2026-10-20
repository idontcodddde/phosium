import type { Game, GameHub, GamesCatalog } from "../types/gameCatalog";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWebUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isGame(value: unknown): value is Game {
  return isRecord(value)
    && typeof value.title === "string"
    && value.title.trim().length > 0
    && typeof value.category === "string"
    && value.category.trim().length > 0
    && isWebUrl(value.url)
    && typeof value.art === "string"
    && typeof value.tint === "string"
    && typeof value.detail === "string"
    && (value.featured === undefined || typeof value.featured === "boolean");
}

function isGameHub(value: unknown): value is GameHub {
  return isRecord(value)
    && typeof value.title === "string"
    && value.title.trim().length > 0
    && isWebUrl(value.url)
    && typeof value.art === "string"
    && typeof value.tint === "string"
    && typeof value.detail === "string";
}

export function loadGamesCatalog(value: unknown): GamesCatalog {
  if (!isRecord(value) || !Array.isArray(value.games) || !Array.isArray(value.hubs)) {
    throw new TypeError("Game catalog must contain games and hubs lists.");
  }
  const games = value.games.filter(isGame);
  if (games.length !== value.games.length) {
    const invalidGameIndex = value.games.findIndex((game: unknown) => !isGame(game));
    throw new TypeError(`Game catalog entry ${invalidGameIndex + 1} is invalid.`);
  }
  const hubs = value.hubs.filter(isGameHub);
  if (hubs.length !== value.hubs.length) {
    const invalidHubIndex = value.hubs.findIndex((hub: unknown) => !isGameHub(hub));
    throw new TypeError(`Game hub entry ${invalidHubIndex + 1} is invalid.`);
  }
  if (games.length === 0) {
    throw new TypeError("Game catalog must contain at least one game.");
  }

  const titles = new Set<string>();
  for (const game of games) {
    const normalizedTitle = game.title.trim().toLowerCase();
    if (titles.has(normalizedTitle)) {
      throw new TypeError(`Game catalog contains duplicate title "${game.title}".`);
    }
    titles.add(normalizedTitle);
  }
  return { games, hubs };
}
