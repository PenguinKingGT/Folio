/** Minimal DOM contracts shared by headless XML and native browser asset rewriting. */

/** Asset rewriting needs only names, text, and attributes rather than a complete browser/implementation DOM. */
export interface AssetElement {
  readonly localName: string | null;
  textContent: string | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
}

/** Both xmldom NodeLists and native HTMLCollections supply a stable array-like snapshot source. */
export interface AssetDocument {
  getElementsByTagName(name: string): ArrayLike<AssetElement>;
}
