/** Lazy XHTML chapters with shared loads, serialization, and bounded lifetime. */
import { XMLSerializer } from '@xmldom/xmldom';
import type { Document } from '@xmldom/xmldom';
import type { ManifestItem, SpineItem } from '../package/types';
import { parseXml } from '../xml/parse';
import { withAbort } from '../async/cancellation';
import { escapeCfi } from '../cfi/syntax';
import { searchSettings } from '../search/options';
import { searchDocument } from '../search/search';
import type { SearchOptions, SearchMatch } from '../search/types';
import type { PublicationHooks } from '../extensions/publication';

/** Load OPF-relative chapter content; the producer must honor the supplied signal. */
export type SectionLoader = (href: string, signal: AbortSignal) => Promise<string>;

/** A section keeps its immutable reading-order identity independent of its loaded DOM. */
export class Section {
  readonly index: number;
  readonly idref: string;
  readonly href: string;
  readonly linear: boolean;
  readonly properties: readonly string[];
  private document: Document | undefined;
  private pending: Promise<Document> | undefined;
  private controller: AbortController | undefined;
  private generation = 0;
  private lifetime = new AbortController();
  private destroyed = false;

  /** Bind lazy metadata/IO; standalone sections default to package spine step /6. */
  constructor(
    item: SpineItem,
    resource: ManifestItem,
    private readonly loader: SectionLoader,
    private readonly spineStep = 6,
    private readonly hooks?: PublicationHooks,
  ) {
    if (!Number.isSafeInteger(spineStep) || spineStep <= 0 || spineStep % 2 !== 0) {
      throw new TypeError('Section spineStep must be a positive even integer.');
    }
    this.index = item.index;
    this.idref = item.idref;
    this.href = resource.href;
    this.linear = item.linear;
    this.properties = Object.freeze([...resource.properties, ...item.properties]);
  }

  /** Load or reuse the XHTML DOM; one consumer's cancellation leaves other consumers intact. */
  async load(signal?: AbortSignal): Promise<Document> {
    this.assertActive();
    signal?.throwIfAborted();
    if (this.document !== undefined) {
      return this.document;
    }
    if (this.pending === undefined) {
      this.controller = new AbortController();
      this.pending = this.fetchDocument(this.generation, this.controller.signal);
    }
    // Unload/destroy must cancel consumers even when a custom producer ignores its own signal.
    let consumer = signal;
    if (this.controller !== undefined) {
      const producer = this.controller.signal;
      consumer = signal === undefined ? producer : AbortSignal.any([producer, signal]);
    }
    return withAbort(this.pending, consumer);
  }

  /** Serialize the currently loaded DOM, including caller modifications. */
  async render(signal?: AbortSignal): Promise<string> {
    const combined =
      signal === undefined ? this.lifetime.signal : AbortSignal.any([signal, this.lifetime.signal]);
    const document = await this.load(combined);
    const context = {
      section: this,
      document,
      source: new XMLSerializer().serializeToString(document),
    };
    await this.hooks?.serialize.run(context, combined);
    combined.throwIfAborted();
    if (typeof context.source !== 'string') {
      throw new TypeError('Serialization hooks must produce a string.');
    }
    return context.source;
  }

  /** Search passive body text across any number of inline nodes; results carry exact publication CFIs. */
  async search(query: string, options: SearchOptions = {}): Promise<readonly SearchMatch[]> {
    this.assertActive();
    const request = searchSettings(query, options);
    const generation = this.generation;
    const document = await this.load(request.settings.signal);
    this.assertActive();
    if (generation !== this.generation) {
      throw new DOMException('Search was cancelled by chapter unload.', 'AbortError');
    }
    return searchDocument(document, request.query, request.settings, {
      index: this.index,
      href: this.href,
      base: `/${this.spineStep}/${(this.index + 1) * 2}[${escapeCfi(this.idref)}]`,
    });
  }

  /** Compatibility alias uses the same cross-node literal search and asynchronous loading contract. */
  find(query: string, options: SearchOptions = {}): Promise<readonly SearchMatch[]> {
    return this.search(query, options);
  }

  /** Drop cached content and invalidate in-flight work; the section may be loaded again. */
  unload(): void {
    this.generation += 1;
    this.lifetime.abort();
    this.lifetime = new AbortController();
    this.controller?.abort();
    this.controller = undefined;
    this.document = undefined;
    this.pending = undefined;
  }

  /** Permanently release this section; safe to repeat. */
  destroy(): void {
    this.unload();
    this.destroyed = true;
  }

  /** Prevent stale loads from repopulating the cache after unload or destruction. */
  private async fetchDocument(generation: number, signal: AbortSignal): Promise<Document> {
    try {
      // Defer invocation so even a synchronously throwing loader clears the assigned pending load.
      const source = await Promise.resolve().then(() => this.loader(this.href, signal));
      signal.throwIfAborted();
      const document = parseXml(source, 'xhtml');
      const root = document.documentElement;
      if (
        root === null ||
        root.localName !== 'html' ||
        root.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ) {
        throw new TypeError('Expected an XHTML chapter document.');
      }
      await this.hooks?.content.run({ section: this, document }, signal);
      signal.throwIfAborted();
      this.document = document;
      return document;
    } finally {
      if (this.generation === generation) {
        this.pending = undefined;
        this.controller = undefined;
      }
    }
  }

  /** Reject reads after terminal destruction. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Section has been destroyed.');
    }
  }
}
