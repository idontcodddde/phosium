export interface Game {
  title: string;
  category: string;
  url: string;
  art: string;
  tint: string;
  detail: string;
  featured?: boolean;
}

export interface GameHub {
  title: string;
  url: string;
  art: string;
  tint: string;
  detail: string;
}

export interface GamesCatalog {
  games: Game[];
  hubs: GameHub[];
}
