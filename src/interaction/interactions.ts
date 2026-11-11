/** Reader-owned native selection, input forwarding, and controlled hyperlink activation. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import { Listeners } from '../events/listeners';
import { withAbort } from '../async/cancellation';
import { InteractionDocument } from './document';
import { contentSelection } from './selection';
import { contentLink } from './link';
import type {
  ContentSelection,
  ContentInput,
  ContentAnchor,
  LinkActivation,
  InteractionHost,
} from './types';

/** Explicit capture/activation APIs remain usable when a passive frame suppresses its own DOM callbacks. */
export class ContentInteractions {
  private readonly documents = new WeakMap<Document, InteractionDocument>();
  private readonly disposers = new Map<InteractionDocument, () => void>();
  private readonly selections = new Listeners<ContentSelection | null>();
  private readonly inputs = new Listeners<ContentInput>();
  private readonly links = new Listeners<LinkActivation>();
  private readonly errors = new Listeners<unknown>();
  private readonly lifetime = new AbortController();
  private pending: Promise<Section | null> = Promise.resolve(null);
  private selected: ContentSelection | null = null;
  private selectionDocument: Document | null = null;
  private selectionKey = 'null';
  private failed: unknown = null;
  private destroyed = false;

  /** Bind publication identity and reader navigation without opening documents. */
  constructor(
    private readonly book: Book,
    private readonly host: InteractionHost,
  ) {}

  /** The most recent selection snapshot is independent of the native browser selection. */
  get selection(): ContentSelection | null {
    return this.selected;
  }
  /** Background link/capture failures remain observable until another activation starts. */
  get lastError(): unknown {
    return this.failed;
  }

  /** Subscribe to changed Range/text/CFI snapshots or null when the selection clears. */
  onSelection(listener: (selection: ContentSelection | null) => void): () => void {
    this.assertActive();
    return this.selections.subscribe(listener);
  }
  /** Forward typed native events synchronously so host listeners can prevent their default action. */
  onInput(listener: (input: ContentInput) => void): () => void {
    this.assertActive();
    return this.inputs.subscribe(listener);
  }
  /** Observe/cancel internal navigation and handle external/resource targets in the host. */
  onLink(listener: (link: LinkActivation) => void): () => void {
    this.assertActive();
    return this.links.subscribe(listener);
  }
  /** Subscribe to asynchronous native-capture and hyperlink failures. */
  onError(listener: (error: unknown) => void): () => void {
    this.assertActive();
    return this.errors.subscribe(listener);
  }

  /** Attach a loaded view; its owner must release the returned callback before replacing/removing it. */
  attach(document: Document, section: Section): () => void {
    this.assertActive();
    if (this.book.section(section.index) !== section) {
      throw new TypeError('Foreign interaction section.');
    }
    if (this.documents.has(document)) {
      throw new TypeError('Document interactions are already attached.');
    }
    const binding = new InteractionDocument(document, section, {
      selection: () => {
        try {
          this.captureSelection(document);
        } catch (error) {
          this.failure(error);
        }
      },
      input: (input) => this.inputs.emit(input),
      link: (href, event) => {
        void this.activate(href, section.index, event);
      },
    });
    this.documents.set(document, binding);
    const release = () => {
      if (!this.disposers.delete(binding)) {
        return;
      }
      binding.destroy();
      if (this.documents.get(document) === binding) {
        this.documents.delete(document);
      }
      if (this.selectionDocument === document) {
        this.storeSelection(null, null);
      }
    };
    this.disposers.set(binding, release);
    return release;
  }

  /** Capture current visible selection, or explicitly inspect one owned loaded document. */
  captureSelection(document?: Document): ContentSelection | null {
    this.assertActive();
    const documents =
      document === undefined
        ? this.host.getRenderedPages().map((page) => page.document)
        : [document];
    for (const entry of documents) {
      const binding = this.binding(entry);
      const selected = contentSelection(entry, binding.section, this.book.publication.spineStep);
      if (selected !== null) {
        this.storeSelection(selected, entry);
        return selected;
      }
    }
    this.storeSelection(null, null);
    return null;
  }

  /** Return passive anchors for a host navigation panel; refreshing also neutralizes newly edited hrefs. */
  getLinks(document?: Document): readonly ContentAnchor[] {
    this.assertActive();
    const documents =
      document === undefined
        ? this.host.getRenderedPages().map((page) => page.document)
        : [document];
    return documents.flatMap((entry) => {
      const binding = this.binding(entry);
      binding.refresh();
      return binding.links();
    });
  }

  /** Activate a URI relative to its origin chapter; only uncancelled spine targets navigate automatically. */
  activate(
    href: string,
    origin = this.host.currentSection?.index ?? 0,
    event?: MouseEvent | KeyboardEvent,
  ): Promise<Section | null> {
    this.assertActive();
    this.failed = null;
    const operation = this.navigate(href, origin, event);
    this.pending = operation;
    void operation.catch((error: unknown) => {
      if (this.pending === operation) {
        this.failure(error);
      }
    });
    return operation;
  }

  /** Resolve and notify before starting a potentially asynchronous chapter display. */
  private async navigate(
    href: string,
    origin: number,
    event?: MouseEvent | KeyboardEvent,
  ): Promise<Section | null> {
    this.lifetime.signal.throwIfAborted();
    const section = this.book.section(origin);
    if (section === null) {
      throw new RangeError('Unknown content link origin.');
    }
    const link = contentLink(this.book, section, href);
    // Modified clicks remain host decisions rather than unexpectedly replacing the current reading position.
    let cancelled =
      event !== undefined && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
    this.links.emit(
      Object.freeze({
        ...link,
        event,
        preventDefault: () => {
          cancelled = true;
        },
      }),
    );
    if (cancelled || link.target === null) {
      return null;
    }
    this.lifetime.signal.throwIfAborted();
    return withAbort(this.host.display(link.target), this.lifetime.signal);
  }

  /** Follow superseding activations rather than exposing obsolete navigation rejections as current failures. */
  async whenIdle(): Promise<void> {
    this.assertActive();
    let pending: Promise<Section | null>;
    do {
      pending = this.pending;
      try {
        await pending;
      } catch (error) {
        if (pending === this.pending) {
          throw error;
        }
      }
      await withAbort(
        Promise.all(Array.from(this.disposers.keys(), (binding) => binding.whenIdle())),
        this.lifetime.signal,
      );
    } while (pending !== this.pending);
    if (this.failed !== null) {
      throw this.failed;
    }
  }

  /** Guard document ownership rather than accepting a selection or URI from another reader. */
  private binding(document: Document): InteractionDocument {
    const binding = this.documents.get(document);
    if (binding === undefined) {
      throw new TypeError('Document does not belong to these interactions.');
    }
    return binding;
  }

  /** Deduplicate by CFI and text without retaining the browser's mutable live Range. */
  private storeSelection(selection: ContentSelection | null, document: Document | null): void {
    const key = selection === null ? 'null' : JSON.stringify([selection.cfi, selection.text]);
    this.selected = selection;
    this.selectionDocument = document;
    if (!this.destroyed && key !== this.selectionKey) {
      this.selectionKey = key;
      this.selections.emit(selection);
    }
  }

  /** Preserve observable errors while suppressing callbacks after terminal cleanup. */
  private failure(error: unknown): void {
    if (!this.destroyed) {
      this.failed = error;
      this.errors.emit(error);
    }
  }

  /** Release pending consumers, native listeners, observers, selections, and callbacks; safe to repeat. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.lifetime.abort();
    for (const release of Array.from(this.disposers.values())) {
      release();
    }
    this.selections.clear();
    this.inputs.clear();
    this.links.clear();
    this.errors.clear();
    this.failed = null;
  }

  /** Reject use after the reader or interaction bridge has been destroyed. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Content interactions have been destroyed.');
    }
  }
}
