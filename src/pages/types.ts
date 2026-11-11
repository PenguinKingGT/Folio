/** Printed-page contracts retain human-readable labels independently of numeric numbering. */

/** One authored print-page destination from EPUB navigation or NCX. */
export interface PrintPageLink {
  readonly id: string | null;
  readonly label: string;
  readonly href: string;
  readonly type: string | null;
}

/** Index is document order; duplicate or Roman labels remain intact. */
export interface PrintPage extends PrintPageLink {
  readonly index: number;
  readonly cfi: string | null;
}

/** Resolve a page destination in its publication context without requiring browser layout. */
export type PrintPageResolver = (page: PrintPage, signal: AbortSignal) => Promise<string>;
