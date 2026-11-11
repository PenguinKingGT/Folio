/** Immutable reading-location contracts independent of native DOM details. */

/** One visible boundary, including chapter identity, viewport numbering, and optional sampled progress. */
export interface VisibleBoundary {
  readonly cfi: string;
  readonly index: number;
  readonly href: string;
  readonly displayed: { readonly page: number; readonly total: number };
  readonly location: number | null;
  readonly percentage: number | null;
}

/** Visible content in reading order; book boundaries refer to the linear spine. */
export interface VisibleLocation {
  readonly start: VisibleBoundary;
  readonly end: VisibleBoundary;
  readonly atStart: boolean;
  readonly atEnd: boolean;
}

/** Receive a relocated snapshot after display, navigation, layout, or native scrolling. */
export type RelocatedListener = (location: VisibleLocation) => void;
