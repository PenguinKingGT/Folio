/** Basic reader facade: mount passive chapter documents and control their lifecycle. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import { prepareContent } from './content';
import { IframeView } from './iframe-view';
import type { ViewOptions } from './iframe-view';
import { PaginationLayout } from '../layout/pagination-layout';
import type { PaginationOptions, PaginationState } from '../layout/pagination';

/** Initial renderer options; layout-specific behavior is added by subsequent features. */
export type RenditionOptions = ViewOptions & PaginationOptions;

/** Resolve selectors only when a browser DOM is available. */
function mountTarget(target: HTMLElement | string): HTMLElement {
  if (typeof target !== 'string') {
    return target;
  }
  if (typeof document === 'undefined') {
    throw new TypeError('Rendering requires a browser document.');
  }
  const element = document.querySelector<HTMLElement>(target);
  if (element === null) {
    throw new TypeError(`Reader container not found: ${target}`);
  }
  return element;
}

/** Display a book in one reusable, script-disabled iframe surface. */
export class Rendition {
  private readonly view: IframeView;
  private readonly paginationLayout: PaginationLayout;
  private generation = 0;
  private controller: AbortController | undefined;
  private current: Section | null = null;
  private visible = true;
  private destroyed = false;

  /** Attach to an existing container without loading a chapter until display(). */
  constructor(
    private readonly book: Book,
    target: HTMLElement | string,
    options: RenditionOptions = {},
    private readonly onDestroy?: () => void,
  ) {
    this.paginationLayout = new PaginationLayout(options);
    this.view = new IframeView(mountTarget(target), options);
  }

  /** The owned iframe is exposed for host integration; scripts remain disabled. */
  get frame(): HTMLIFrameElement {
    return this.view.frame;
  }

  /** Return the last successfully displayed chapter. */
  get currentSection(): Section | null {
    return this.current;
  }

  /** Load, sanitize, resolve assets, and display one chapter; a newer display cancels the old wait. */
  async display(target?: number | string): Promise<Section> {
    this.assertActive();
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const token = String(++this.generation);
    const section = this.book.section(target);
    if (section === null) {
      throw new RangeError('Requested chapter is not in the spine.');
    }
    const address = this.book.resources.resolve(section.href);
    if (address.kind !== 'local') {
      throw new TypeError('Chapter rendering requires a local publication resource.');
    }
    const passive = prepareContent(await section.render(controller.signal), token);
    const content = await this.book.resources.rewrite(passive, address.path);
    controller.signal.throwIfAborted();
    await this.view.load(content, token, controller.signal);
    controller.signal.throwIfAborted();
    this.current = section;
    if (this.visible) {
      this.view.show();
    }
    this.layout();
    return section;
  }

  /** Return measured column geometry and visible page/spread count. */
  get pagination(): PaginationState | null {
    return this.paginationLayout.state;
  }

  /** Configure spread behavior and reflow current contents; no document returns null. */
  layout(options: PaginationOptions = {}): PaginationState | null {
    this.assertActive();
    const document = this.view.document;
    if (document === null) {
      this.paginationLayout.configure(options);
      return null;
    }
    return this.paginationLayout.apply(this.frame, document, options);
  }

  /** Return native chapter contents, or null before the first successful display. */
  getContents(): Document | null {
    this.assertActive();
    return this.view.document;
  }

  /** Reveal current and future displayed content. */
  show(): void {
    this.assertActive();
    this.visible = true;
    if (this.current !== null) {
      this.view.show();
    }
  }

  /** Hide current content and keep later display operations hidden until show(). */
  hide(): void {
    this.assertActive();
    this.visible = false;
    this.view.hide();
  }

  /** Cancel display work and detach the view; book-owned resources remain reusable. */
  destroy(): void {
    if (!this.destroyed) {
      this.controller?.abort();
      this.view.destroy();
      this.current = null;
      this.destroyed = true;
      this.onDestroy?.();
    }
  }

  /** Fail consistently after renderer destruction. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Rendition has been destroyed.');
    }
  }
}
