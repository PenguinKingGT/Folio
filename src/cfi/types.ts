/** Structural text-CFI models; assertions retain their escaped representation for lossless output. */

/** A positive structural step; even values identify elements and odd values identify text. */
export interface CfiStep {
  readonly value: number;
  readonly assertion: string | null;
}

/** A document-relative structural path with an optional UTF-16 character offset. */
export interface CfiPath {
  readonly steps: readonly CfiStep[];
  readonly offset: number | null;
  readonly assertion: string | null;
}

/** Point paths may cross document indirections; range endpoints extend the final common path. */
export interface CfiData {
  readonly paths: readonly CfiPath[];
  readonly range: { readonly start: CfiPath; readonly end: CfiPath } | null;
}
