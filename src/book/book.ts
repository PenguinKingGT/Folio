/** Headless publication facade connecting loading, navigation, chapters, and resources. */
import { Cover } from '../cover/cover';
import { parsePackage } from '../package/package';
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

/** An opened publication does not create iframes or depend on browser globals. */
export class Book {
  private readonly renditions = new Set<Rendition>();
  readonly spine: Spine;
  readonly resources: Resources;
  readonly cover: Cover;
  readonly locations: Locations;

  /** Compose already validated source components; open() owns failure cleanup. */
  private constructor(
    private readonly source: PublicationSource,
    readonly publication: PublicationPackage,
    readonly navigation: Navigation,
    options: BookOptions,
  ) {
    this.locations = new Locations(this.publication, (href, signal) =>
      this.text(href, source.packagePath, signal),
    );
    const read: ResourceReader = (path, signal) => source.read(path, signal);
    this.resources = new Resources(this.publication, source.packagePath, read, options);
    this.spine = new Spine(this.publication, (href, signal) =>
      this.text(href, source.packagePath, signal),
    );
    this.cover = new Cover(
      this.publication,
      async (href, signal) =>
        new Blob([Uint8Array.from(await this.bytes(href, source.packagePath, signal))]),
    );
  }

  /**
   * Open a ZIP, URL, extracted directory, or OPF without creating a reader view.
   * @throws Loading and parsing errors; partially opened resources are released.
   */
  static async open(
    input: string | URL | ArrayBuffer | Uint8Array,
    options: BookOptions = {},
  ): Promise<Book> {
    const source = await openSource(input, options);
    try {
      const publication = parsePackage(source.packageXml);
      const navigation = await loadNavigation(publication, source);
      source.signal.throwIfAborted();
      return new Book(source, publication, navigation, options);
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

  /** Mount a passive reader surface; opening and headless reads remain browser-independent. */
  renderTo(target: HTMLElement | string, options: RenditionOptions = {}): Rendition {
    this.source.signal.throwIfAborted();
    const rendition: Rendition = new Rendition(this, target, options, () => {
      this.renditions.delete(rendition);
    });
    this.renditions.add(rendition);
    return rendition;
  }

  /** Release chapters, cover, transformed resources, producer requests, and source storage. */
  destroy(): void {
    for (const rendition of this.renditions) {
      rendition.destroy();
    }
    this.renditions.clear();
    this.locations.destroy();
    this.source.destroy();
    this.spine.destroy();
    this.cover.destroy();
    this.resources.destroy();
  }
}
