/** Headless publication facade connecting loading, navigation, chapters, and resources. */
import { Cover } from '../cover/cover';
import { EventEmitter } from '../events/emitter';
import { PublicationHooks } from '../extensions/publication';
import type { ManagedReader, ReaderFactory } from '../extensions/types';
import { disposeAll, isAbortError } from '../events/errors';
import type { BookEventMap } from '../events/types';
import { parsePackage } from '../package/package';
import { parseJsonManifest } from '../manifest/parse';
import { loadDisplayOptions, validateDisplayOptions } from './display-options';
import { applyAppleDisplayOptions } from '../display-options/apply';
import type { AppleDisplayOptions } from '../display-options/types';
import type { PublicationPackage } from '../package/types';
import type { Navigation } from '../navigation/navigation';
import { Resources } from '../resources/resources';
import type { ResourceReader } from '../resources/resources';
import { Spine } from '../spine/spine';
import type { Section } from '../spine/section';
import { loadNavigation } from './navigation';
import type { BookOptions } from './options';
import { openSource } from './source';
import type { PublicationSource } from './source';
import { Rendition } from '../render/rendition';
import type { RenditionOptions } from '../render/rendition';
import { Locations } from '../locations/locations';
import { createPageList } from './pages';
import type { PageList } from '../pages/page-list';
import { ContinuousReader } from '../continuous/reader';
import type { ContinuousOptions } from '../continuous/options';

/** An opened publication does not create iframes or depend on browser globals. */
export class Book extends EventEmitter<BookEventMap> {
  private destroyed = false;
  private closing = false;
  private completion: Promise<void> | undefined;
  private readonly renditions = new Set<ManagedReader>();
  readonly hooks = new PublicationHooks();
  readonly spine: Spine;
  readonly resources: Resources;
  readonly cover: Cover;
  readonly locations: Locations;
  readonly pageList: PageList;

  /** Compose already validated source components; open() owns failure cleanup. */
  private constructor(
    private readonly source: PublicationSource,
    readonly publication: PublicationPackage,
    readonly navigation: Navigation,
    options: BookOptions,
    readonly displayOptions: AppleDisplayOptions | null,
  ) {
    super();
    this.locations = new Locations(this.publication, (href, signal) =>
      this.text(href, source.packagePath, signal),
    );
    const read: ResourceReader = (path, signal) => source.read(path, signal);
    this.resources = new Resources(this.publication, source.packagePath, read, options);
    this.spine = new Spine(
      this.publication,
      (href, signal) => this.text(href, source.packagePath, signal),
      this.hooks,
    );
    this.cover = new Cover(
      this.publication,
      async (href, signal) =>
        new Blob([Uint8Array.from(await this.bytes(href, source.packagePath, signal))]),
    );
    this.pageList = createPageList(this);
  }

  /**
   * Open a ZIP, URL, extracted directory, or OPF without creating a reader view.
   * @throws Loading and parsing errors; partially opened resources are released.
   */
  static async open(
    input: string | URL | ArrayBuffer | Uint8Array,
    options: BookOptions = {},
  ): Promise<Book> {
    validateDisplayOptions(options);
    const source = await openSource(input, options);
    try {
      const json =
        source.package.format === 'json' ? parseJsonManifest(source.package.source) : undefined;
      const parsed = json?.publication ?? parsePackage(source.package.source);
      const displayOptions = await loadDisplayOptions(source, parsed, options);
      const publication = applyAppleDisplayOptions(parsed, displayOptions);
      const navigation = json?.navigation ?? (await loadNavigation(publication, source));
      source.signal.throwIfAborted();
      return new Book(source, publication, navigation, options, displayOptions);
    } catch (error) {
      source.destroy();
      throw error;
    }
  }

  /** Container-relative OPF path, used as the default base for publication references. */
  get packagePath(): string {
    return this.source.packagePath;
  }

  /** Find a lazy chapter by index, #idref, or OPF-relative href. */
  section(target?: number | string): Section | null {
    return this.spine.get(target);
  }

  /** Read bytes relative to the OPF or an explicitly supplied container document path. */
  async bytes(
    href: string,
    from = this.packagePath,
    signal = this.source.signal,
  ): Promise<Uint8Array> {
    try {
      const bytes = await this.readBytes(href, from, signal);
      this.emit('resourceLoaded', Object.freeze({ href, from, bytes: bytes.length }));
      return bytes;
    } catch (error) {
      if (!isAbortError(error)) {
        this.emit('error', error);
      }
      throw error;
    }
  }

  /** Resolve publication bytes before publishing a successful resource notification. */
  private async readBytes(href: string, from: string, signal: AbortSignal): Promise<Uint8Array> {
    signal.throwIfAborted();
    const address = this.resources.resolve(href, from);
    if (address.kind === 'local') {
      return this.source.read(address.path, signal);
    }
    if (address.kind === 'fragment') {
      throw new TypeError('A fragment alone does not identify a readable resource.');
    }
    return new Uint8Array(
      await this.source.request(address.url, 'binary', {
        signal: AbortSignal.any([signal, this.source.signal]),
      }),
    );
  }

  /** Strictly decode a text resource as UTF-8. */
  async text(href: string, from = this.packagePath, signal?: AbortSignal): Promise<string> {
    return new TextDecoder('utf-8', { fatal: true }).decode(await this.bytes(href, from, signal));
  }

  /** Read declared resources sequentially through the configured transport, including persistent offline caching. */
  async prefetchResources(signal?: AbortSignal): Promise<number> {
    const combined =
      signal === undefined ? this.source.signal : AbortSignal.any([signal, this.source.signal]);
    combined.throwIfAborted();
    let loaded = 0;
    for (const item of this.publication.manifest.values()) {
      await this.bytes(item.href, this.packagePath, combined);
      combined.throwIfAborted();
      loaded += 1;
    }
    return loaded;
  }

  /** Mount a passive reader surface; opening and headless reads remain browser-independent. */
  renderTo(target: HTMLElement | string, options: RenditionOptions = {}): Rendition {
    this.assertCanRender();
    const rendition: Rendition = new Rendition(this, target, options, () => {
      this.renditions.delete(rendition);
    });
    this.renditions.add(rendition);
    this.emit('readerCreated', rendition);
    return rendition;
  }

  /** Mount a virtualized continuous scroll reader with independently owned passive chapter views. */
  renderContinuous(
    target: HTMLElement | string,
    options: ContinuousOptions = {},
  ): ContinuousReader {
    this.assertCanRender();
    const reader: ContinuousReader = new ContinuousReader(this, target, options, () => {
      this.renditions.delete(reader);
    });
    this.renditions.add(reader);
    this.emit('readerCreated', reader);
    return reader;
  }

  /** Mount a host-supplied manager and include it in book-owned synchronous cleanup. */
  renderWith<Options, Reader extends ManagedReader>(
    factory: ReaderFactory<Options, Reader>,
    target: HTMLElement | string,
    options: Options,
  ): Reader {
    this.assertCanRender();
    if (typeof factory !== 'function') {
      throw new TypeError('Reader factories must be functions.');
    }
    const reader = factory(this, target, options);
    if (
      reader === null ||
      typeof reader !== 'object' ||
      typeof reader.display !== 'function' ||
      typeof reader.getContents !== 'function' ||
      typeof reader.destroy !== 'function'
    ) {
      throw new TypeError('A custom reader must implement display, getContents, and destroy.');
    }
    if (!this.renditions.has(reader)) {
      this.renditions.add(reader);
      this.emit('readerCreated', reader);
    }
    return reader;
  }

  /** Finish asynchronous unload hooks before releasing shared publication resources. */
  destroyAsync(): Promise<void> {
    this.closing = true;
    this.completion ??= Promise.resolve().then(() => this.closeAsync());
    return this.completion;
  }

  /** Snapshot owners once, rejecting new mounts while asynchronous unload work drains. */
  private async closeAsync(): Promise<void> {
    const readers = Array.from(this.renditions);
    this.renditions.clear();
    try {
      disposeAll(readers.map((reader) => () => reader.destroy()));
    } finally {
      try {
        await this.hooks.whenIdle();
      } finally {
        this.destroy();
      }
    }
  }

  /** Cleanup hooks may read assets, but a closing book cannot acquire another reader. */
  private assertCanRender(): void {
    this.source.signal.throwIfAborted();
    if (this.closing) {
      throw new Error('Book is closing.');
    }
  }

  /** Release chapters, cover, transformed resources, producer requests, and source storage. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    const readers = Array.from(this.renditions);
    this.renditions.clear();
    disposeAll([
      ...readers.map((reader) => () => reader.destroy()),
      () => this.locations.destroy(),
      () => this.pageList.destroy(),
      () => this.source.destroy(),
      () => this.spine.destroy(),
      () => this.cover.destroy(),
      () => this.resources.destroy(),
      () => this.hooks.destroy(),
      () => this.finishEvents('destroyed', undefined),
    ]);
  }
}
