export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  draft: string;
}

export interface BrowserBookmark {
  title: string;
  url: string;
}

export interface BrowserHistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}
