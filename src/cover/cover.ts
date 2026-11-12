/** Lazy cover URLs with shared requests, explicit invalidation, and cleanup. */
import { withAbort } from '../async/cancellation';
import type { PublicationPackage } from '../package/types';

/** Load an OPF-relative cover resource as a Blob, honoring producer cancellation. */
export type CoverLoader = (href: string, signal: AbortSignal) => Promise<Blob>;

/** Own a publication cover's Blob URL without depending on a rendering view. */
export class Cover {
  readonly path: string | null;
  private readonly mediaType: string;
  private cached: string | undefined;
  private pending: Promise<string> | undefined;
  private controller: AbortController | undefined;
  private destroyed = false;

  /** Bind parsed EPUB 2/3 cover metadata to an archive or network resource loader. */
  constructor(
    publication: PublicationPackage,
    private readonly loader: CoverLoader,
  ) {
    this.path = publication.coverPath;
    this.mediaType =
      [...publication.manifest.values()].find((item) => item.href === this.path)?.mediaType ??
      'application/octet-stream';
  }

  /** Return a cached Blob URL, or null when no cover is declared; failures can be retried. */
  async url(signal?: AbortSignal): Promise<string | null> {
    if (this.destroyed) {
      throw new Error('Cover has been destroyed.');
    }
    signal?.throwIfAborted();
    if (this.path === null) {
      return null;
    }
    if (this.cached !== undefined) {
      return this.cached;
    }
    if (this.pending === undefined) {
      this.controller = new AbortController();
      this.pending = this.produce(this.path, this.controller.signal);
    }
    let consumer = signal;
    if (this.controller !== undefined) {
      const producer = this.controller.signal;
      consumer = signal === undefined ? producer : AbortSignal.any([producer, signal]);
    }
    return withAbort(this.pending, consumer);
  }

  /** Release the cached URL and cancel pending work; a subsequent url() starts fresh. */
  revokeUrl(): void {
    this.controller?.abort();
    this.controller = undefined;
    this.pending = undefined;
    if (this.cached !== undefined) {
      URL.revokeObjectURL(this.cached);
      this.cached = undefined;
    }
  }

  /** Permanently release this cover; safe to repeat. */
  destroy(): void {
    this.revokeUrl();
    this.destroyed = true;
  }

  /** Suppress stale results even when the injected loader ignores cancellation. */
  private async produce(path: string, signal: AbortSignal): Promise<string> {
    try {
      const resource = await Promise.resolve().then(() => this.loader(path, signal));
      signal.throwIfAborted();
      this.cached = URL.createObjectURL(new Blob([resource], { type: this.mediaType }));
      return this.cached;
    } finally {
      if (this.controller?.signal === signal) {
        this.controller = undefined;
        this.pending = undefined;
      }
    }
  }
}
