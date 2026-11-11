/** Resource resolution, CSS dependency expansion, and owned URL lifecycle. */
import { mimeType } from '../archive/mime';
import { withAbort } from '../async/cancellation';
import type { PublicationPackage } from '../package/types';
import { rewriteCss } from './css';
import { rewriteDocument } from './document';
import { resolveResource } from './path';
import type { ResourceAddress } from './path';

/** Read decoded container-relative paths; implementations may use ZIP or network storage. */
export type ResourceReader = (path: string, signal: AbortSignal) => Promise<Uint8Array>;

/** Remote references are blocked by default; canonical URLs may be supplied by a host. */
export interface ResourceOptions {
  allowRemote?: boolean;
  canonical?: (path: string) => string;
}

/** Manage manifest MIME types and transformed resources without renderer dependencies. */
export class Resources {
  private readonly types = new Map<string, string>();
  private readonly urls = new Map<string, string>();
  private readonly controller = new AbortController();

  /** Bind an OPF-relative manifest to a container-relative byte provider. */
  constructor(
    publication: PublicationPackage,
    readonly packagePath: string,
    private readonly read: ResourceReader,
    private readonly options: ResourceOptions = {},
  ) {
    for (const item of publication.manifest.values()) {
      const address = resolveResource(item.href, packagePath);
      if (address.kind === 'local') {
        this.types.set(address.path, item.mediaType);
      }
    }
  }

  /** Resolve a reference and apply the configured remote-resource policy. */
  resolve(href: string, from = this.packagePath): ResourceAddress {
    this.controller.signal.throwIfAborted();
    const address = resolveResource(href, from);
    if (address.kind === 'external' && this.options.allowRemote !== true) {
      throw new TypeError('Remote publication resources are disabled.');
    }
    return address;
  }

  /** Return a canonical local address, or preserve permitted inline/external references. */
  canonical(href: string, from = this.packagePath): string {
    const address = this.resolve(href, from);
    if (address.kind !== 'local') {
      return address.url;
    }
    return (this.options.canonical?.(address.path) ?? address.path) + address.fragment;
  }

  /** Resolve a reference to a cached Blob URL; caller cancellation does not cancel shared work. */
  async url(href: string, from = this.packagePath, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted();
    return withAbort(this.buildUrl(href, from, new Set()), signal);
  }

  /** Replace chapter asset references and inline styles; chapter links remain unchanged. */
  async rewrite(source: string, sectionPath: string): Promise<string> {
    this.controller.signal.throwIfAborted();
    return rewriteDocument(source, (href) => this.url(href, sectionPath));
  }

  /** Release every generated URL and invalidate pending transformations; safe to repeat. */
  destroy(): void {
    this.controller.abort();
    for (const url of this.urls.values()) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
    this.types.clear();
  }

  /** Expand CSS recursively, detect import cycles, and publish at most one URL per path. */
  private async buildUrl(
    href: string,
    from: string,
    ancestors: ReadonlySet<string>,
  ): Promise<string> {
    const address = this.resolve(href, from);
    if (address.kind !== 'local') {
      return address.url;
    }
    if (ancestors.has(address.path)) {
      throw new TypeError(`Cyclic CSS resource dependency: ${address.path}`);
    }
    const cached = this.urls.get(address.path);
    if (cached !== undefined) {
      return cached + address.fragment;
    }
    const bytes = await this.read(address.path, this.controller.signal);
    this.controller.signal.throwIfAborted();
    const type = this.types.get(address.path) ?? mimeType(address.path);
    const parents = new Set([...ancestors, address.path]);
    let content: BlobPart = Uint8Array.from(bytes);
    if (type === 'text/css') {
      content = await rewriteCss(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
        (reference) => this.buildUrl(reference, address.path, parents),
      );
    }
    this.controller.signal.throwIfAborted();
    // Concurrent transformations may both finish; only the first owns a newly allocated URL.
    const url = this.urls.get(address.path) ?? URL.createObjectURL(new Blob([content], { type }));
    this.urls.set(address.path, url);
    return url + address.fragment;
  }
}
