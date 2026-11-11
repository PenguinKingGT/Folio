/** Explicit theme inputs avoid ambiguous string overloads and implicit URL interpretation. */

/** CSS selector maps contain property/value pairs; values may include !important. */
export type ThemeRules = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** Relative resources resolve against the supplied container-relative or allowed remote CSS document. */
export type ThemeSource =
  | { css: string; from?: string }
  | { url: string; from?: string }
  | { rules: ThemeRules; from?: string };

/** Overrides target the root/body by default; reader font helpers also target descendants. */
export interface OverrideOptions {
  important?: boolean;
  selector?: string;
}

/** Document ownership stays with the reader; themes request one logical-anchor-preserving layout. */
export interface ThemeHost {
  documents(): readonly Document[];
  layout(): void;
}
