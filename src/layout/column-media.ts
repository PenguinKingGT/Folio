/** Own reversible, low-priority media defaults for column-based reading pages. */
import type { PaginationGeometry } from './pagination';

/** Weak document ownership preserves author styles, body structure, and unloaded-frame collection. */
export class ColumnMedia {
  private readonly styles = new WeakMap<Document, HTMLStyleElement>();

  /** Fit replaced artwork to one physical column; author and host styles retain precedence. */
  apply(document: Document, geometry: PaginationGeometry): void {
    const width = geometry.axis === 'horizontal' ? geometry.columnWidth : geometry.width;
    const height = geometry.axis === 'vertical' ? geometry.columnWidth : geometry.height;
    // A percentage block-axis width can be indefinite in vertical columns, disabling the entire min() cap.
    const maxWidth = geometry.axis === 'horizontal' ? `min(100%,${width}px)` : `${width}px`;
    // Zero specificity and insertion before publisher sheets make these reader defaults, not forced overrides.
    // Nested SVG viewports retain their own coordinate system; only outer artwork needs page constraints.
    const css = `
:where(img,svg:not(svg svg)) {
  max-width: ${maxWidth};
  max-height: ${height}px;
  object-fit: contain;
  box-sizing: border-box;
  vertical-align: top;
  break-inside: avoid;
}`;
    let style = this.styles.get(document);
    if (style === undefined) {
      style = document.createElement('style');
      style.setAttribute('data-folio-column-media', '');
      this.styles.set(document, style);
    }
    if (style.textContent !== css) {
      style.textContent = css;
    }
    if (!style.isConnected) {
      document.head.insertBefore(
        style,
        document.head.querySelector('style,link[rel~="stylesheet"]'),
      );
    }
  }

  /** Natural scrolling must recover the original dimensions without editing author attributes or declarations. */
  clear(document: Document): void {
    this.styles.get(document)?.remove();
    this.styles.delete(document);
  }
}
