/** Own an iframe surface and its in-flight document load independently of book resources. */
import { loadFrame } from './frame-load';
import type { ViewFactory } from './view-factory';
import { validateViewMode } from './view-mode';
import { setDimension, viewTimeout } from './surface';

/** Basic view dimensions; pagination and scrolling options are separate layout features. */
export interface ViewOptions {
  view?: 'iframe';
  width?: number | string;
  height?: number | string;
  loadTimeoutMs?: number;
  createView?: ViewFactory;
}

/** Passive same-origin iframe permits host DOM measurement while denying publication scripts. */
export class IframeView {
  readonly frame: HTMLIFrameElement;
  private readonly timeout: number;
  private loading: AbortController | undefined;
  private destroyed = false;
  private loadedDocument: Document | null = null;

  /** Create one hidden view in an attached host container. */
  constructor(container: HTMLElement, options: ViewOptions = {}) {
    validateViewMode(options.view);
    if (!container.isConnected || container.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      throw new TypeError('The reader container must be an attached HTML element.');
    }
    this.timeout = viewTimeout(options.loadTimeoutMs);
    this.frame = container.ownerDocument.createElement('iframe');
    this.frame.setAttribute('sandbox', 'allow-same-origin');
    this.frame.setAttribute('title', 'EPUB content');
    this.frame.referrerPolicy = 'no-referrer';
    this.frame.style.border = '0';
    setDimension(this.frame, 'width', options.width ?? '100%');
    setDimension(this.frame, 'height', options.height ?? '100%');
    this.hide();
    container.appendChild(this.frame);
  }

  /** Replace the document; cancelled or superseded loads never expose stale content. */
  async load(source: string, token: string, signal?: AbortSignal): Promise<Document> {
    this.assertActive();
    this.loading?.abort();
    this.loading = new AbortController();
    const combined =
      signal === undefined ? this.loading.signal : AbortSignal.any([signal, this.loading.signal]);
    this.hide();
    this.loadedDocument = null;
    const document = await loadFrame(this.frame, source, token, combined, this.timeout);
    combined.throwIfAborted();
    this.loadedDocument = document;
    return document;
  }

  /** Return the loaded document, excluding the initial about:blank document. */
  get document(): Document | null {
    return this.loadedDocument;
  }

  /** Make the loaded surface visible. */
  show(): void {
    this.assertActive();
    this.frame.hidden = false;
    this.frame.style.display = 'block';
  }

  /** Hide the surface with an explicit style that cannot be overridden by the UA hidden rule. */
  hide(): void {
    this.assertActive();
    this.frame.hidden = true;
    this.frame.style.display = 'none';
  }

  /** Cancel document loads, detach the iframe, and release the document reference. */
  destroy(): void {
    this.loading?.abort();
    this.frame.remove();
    this.loadedDocument = null;
    this.destroyed = true;
  }

  /** Reject view operations after terminal cleanup. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Iframe view has been destroyed.');
    }
  }
}
