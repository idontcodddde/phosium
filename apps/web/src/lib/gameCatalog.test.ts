import { describe, expect, it } from "vitest";
import { loadGamesCatalog } from "./gameCatalog";

const game = {
  title: "Test Game",
  category: "Arcade",
  url: "https://games.example/play",
  art: "/games/test.png",
  tint: "#123456",
  detail: "A test entry",
};

describe("loadGamesCatalog", () => {
  it("loads valid games and hubs", () => {
    const catalog = loadGamesCatalog({
      games: [game],
      hubs: [{
        title: "Test Hub",
        url: "https://games.example/",
        art: "/games/hub.png",
        tint: "#654321",
        detail: "A test hub",
      }],
    });

    expect(catalog.games).toEqual([game]);
    expect(catalog.hubs).toHaveLength(1);
  });

  it("rejects malformed entries and duplicate game titles", () => {
    expect(() => loadGamesCatalog({ games: [], hubs: [] }))
      .toThrow("Game catalog must contain at least one game.");
    expect(() => loadGamesCatalog({ games: [{ ...game, url: "javascript:alert(1)" }], hubs: [] }))
      .toThrow("Game catalog entry 1 is invalid.");
    expect(() => loadGamesCatalog({
      games: [game, { ...game, title: " test game " }],
      hubs: [],
    })).toThrow('Game catalog contains duplicate title " test game ".');
  });
});
