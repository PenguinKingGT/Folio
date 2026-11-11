/** Own one style element per document without changing body structure or retaining unloaded native frames. */
import { withAbort } from '../async/cancellation';

/** Weak ownership prevents trimmed chapter documents from accumulating in the theme manager. */
export class ThemeStyles {
  private readonly elements = new WeakMap<Document, HTMLStyleElement>();

  /** Append after author styles and replace only the reader-owned stylesheet. */
  apply(document: Document, css: string): void {
    if (css.trim() === '') {
      this.remove(document);
      return;
    }
    let style = this.elements.get(document);
    if (style === undefined) {
      style = document.createElement('style');
      style.setAttribute('data-folio-theme', '');
      this.elements.set(document, style);
    }
    if (style.textContent !== css) {
      style.textContent = css;
    }
    if (!style.isConnected) {
      document.head.appendChild(style);
    }
  }

  /** Force style resolution before awaiting fonts requested by currently measurable content. */
  async fonts(document: Document, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const bounds = document.body.getBoundingClientRect();
    // Hidden frames can defer font resolution indefinitely; first layout and native reflow own that phase.
    if (bounds.width === 0 || bounds.height === 0) {
      return;
    }
    await withAbort(document.fonts.ready, signal);
  }

  /** Remove only the owned element; author styles and DOM nodes remain intact. */
  remove(document: Document): void {
    this.elements.get(document)?.remove();
    this.elements.delete(document);
  }
}
