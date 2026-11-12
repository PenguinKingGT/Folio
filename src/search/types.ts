/** Public chapter-search options and immutable results remain independent of reader views and native DOM. */

/** Literal Unicode search is case-insensitive and whitespace-normalized unless explicitly changed. */
export interface SearchOptions {
  caseSensitive?: boolean;
  normalizeWhitespace?: boolean;
  overlap?: boolean;
  limit?: number;
  context?: number;
  signal?: AbortSignal;
}

/** Complete range CFIs can be passed directly to display() or annotation helpers. */
export interface SearchMatch {
  readonly sectionIndex: number;
  readonly href: string;
  readonly cfi: string;
  readonly match: string;
  readonly excerpt: string;
}
