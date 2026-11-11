/** Bind native document interactions while keeping delayed selection work in the host realm. */
import type { Section } from '../spine/section';
import { passiveLink, linkAttribute } from '../content/links';
import type { ContentAnchor, ContentInput } from './types';

/** Document callbacks preserve synchronous input cancellation and asynchronous link ownership. */
export interface InteractionCallbacks {
  selection(): void;
  input(value: ContentInput): void;
  link(href: string, event: MouseEvent | KeyboardEvent): void;
}

/** Own cancellable events, a link observer, and at most one host animation frame. */
export class InteractionDocument {
  private readonly controller = new AbortController();
  private readonly mutation: MutationObserver;
  private readonly scheduler: Window;
  private pending: number | undefined;

  /** Require mounted srcdoc so host page links cannot be rewritten accidentally. */
  constructor(
    readonly document: Document,
    readonly section: Section,
    private readonly callbacks: InteractionCallbacks,
  ) {
    const scheduler = document.defaultView?.frameElement?.ownerDocument.defaultView;
    if (
      scheduler === undefined ||
      scheduler === null ||
      !document.documentElement.hasAttribute('data-folio-document')
    ) {
      throw new TypeError('Interactions require a mounted reader document.');
    }
    this.scheduler = scheduler;
    this.refresh();
    this.mutation = new MutationObserver(() => this.refresh());
    this.mutation.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'xlink:href'],
    });
    this.listen();
  }

  /** Refresh edited links before they can perform native iframe navigation. */
  refresh(): void {
    for (const element of this.document.body.querySelectorAll('a,area')) {
      passiveLink(element, true);
    }
  }

  /** Inventory original URIs without forcing potentially invalid links to navigate or resolve. */
  links(): readonly ContentAnchor[] {
    return Array.from(
      this.document.body.querySelectorAll(`a[${linkAttribute}],area[${linkAttribute}]`),
    ).map((element) =>
      Object.freeze({
        element,
        section: this.section,
        href: element.getAttribute(linkAttribute) ?? '',
        label: element.textContent ?? '',
      }),
    );
  }

  /** Forward native keyboard/pointer events while preserving their original cancellation state. */
  private listen(): void {
    const options = { signal: this.controller.signal };
    const realm = this.document.defaultView;
    this.document.addEventListener('selectionchange', () => this.schedule(), options);
    this.document.addEventListener(
      'click',
      (event) => {
        if (event.button === 0 && !event.defaultPrevented) {
          this.activate(event);
        }
      },
      options,
    );
    for (const type of ['keydown', 'keyup'] as const) {
      this.document.addEventListener(
        type,
        (event) => {
          if (realm !== null && event instanceof realm.KeyboardEvent) {
            this.keyboard(event);
          }
        },
        options,
      );
    }
    for (const type of ['pointerdown', 'pointerup', 'pointermove'] as const) {
      this.document.addEventListener(
        type,
        (event) => {
          if (realm !== null && event instanceof realm.PointerEvent) {
            this.callbacks.input({ kind: 'pointer', section: this.section, event });
          }
        },
        options,
      );
    }
  }

  /** Input subscribers can cancel keyboard link activation before the default reading action runs. */
  private keyboard(event: KeyboardEvent): void {
    this.callbacks.input({ kind: 'keyboard', section: this.section, event });
    if (event.type === 'keydown' && event.key === 'Enter' && !event.defaultPrevented) {
      this.activate(event);
    }
  }

  /** Resolve only real anchors; metadata on arbitrary elements cannot create active hyperlinks. */
  private activate(event: MouseEvent | KeyboardEvent): void {
    const realm = this.document.defaultView;
    const element =
      realm !== null && event.target instanceof realm.Element
        ? event.target.closest(`a[${linkAttribute}],area[${linkAttribute}]`)
        : null;
    if (element !== null) {
      event.preventDefault();
      this.callbacks.link(element.getAttribute(linkAttribute) ?? '', event);
    }
  }

  /** Coalesce selection notifications outside script-disabled frame animation APIs. */
  private schedule(): void {
    if (this.pending === undefined) {
      this.pending = this.scheduler.requestAnimationFrame(() => {
        this.pending = undefined;
        this.callbacks.selection();
      });
    }
  }

  /** Await selection capture that is already runnable in the host animation scheduler. */
  async whenIdle(): Promise<void> {
    while (this.pending !== undefined) {
      await new Promise<void>((resolve) => this.scheduler.requestAnimationFrame(() => resolve()));
    }
  }

  /** Disconnect all native callbacks and cancel deferred selection capture; safe to repeat. */
  destroy(): void {
    this.controller.abort();
    this.mutation.disconnect();
    if (this.pending !== undefined) {
      this.scheduler.cancelAnimationFrame(this.pending);
    }
    this.pending = undefined;
  }
}
