/** Serializable, layout-independent reading progress models. */
export type LocationUnit = 'characters' | 'words';

/** One monotonic reading position in the linear spine. */
export interface ReadingLocation {
  readonly cfi: string;
  readonly position: number;
}

/** Select UTF-16 character intervals or Unicode word intervals. */
export interface LocationOptions {
  unit?: LocationUnit;
  breakSize?: number;
  signal?: AbortSignal;
}

/** Versioned progress state bound to a publication identifier. */
export interface LocationSnapshot {
  version: 1;
  identifier: string;
  unit: LocationUnit;
  breakSize: number;
  total: number;
  current: number | null;
  locations: readonly ReadingLocation[];
}

/** Load chapter XHTML without creating or retaining a browser document. */
export type LocationLoader = (href: string, signal: AbortSignal) => Promise<string>;
