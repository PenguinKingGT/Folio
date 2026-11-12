/** Embed bounded local assets for opaque-origin execution while retaining publication path and remote-resource policy. */
import type { Book } from '../book/book';
import { resolveResource } from '../resources/path';
import { rewriteCss } from '../resources/css';
import { mimeType } from '../archive/mime';
import { withAbort } from '../async/cancellation';
import { dataUrl, textUrl } from './data';

/** Each display owns its cache and budget, so failed or cancelled work cannot poison later chapters. */
export class ScriptResources {
  private readonly urls = new Map<string, Promise<string>>();
  private readonly types = new Map<string, string>();
  private bytes = 0;
  private expanded = 0;

  /** Build only a MIME directory; no assets are read until an actual chapter reference requires them. */
  constructor(
    private readonly book: Book,
    private readonly signal: AbortSignal,
    private readonly limit: number,
  ) {
    for (const item of book.publication.manifest.values()) {
      const address = resolveResource(item.href, book.packagePath);
      if (address.kind === 'local') {
        this.types.set(address.path, item.mediaType);
      }
    }
  }

  /** Restrict executable views to inline/local assets; remote permission does not implicitly authorize remote scripts. */
  async url(
    href: string,
    from: string,
    ancestors: ReadonlySet<string> = new Set(),
  ): Promise<string> {
    this.signal.throwIfAborted();
    const address = this.book.resources.resolve(href, from);
    if (address.kind === 'external') {
      throw new TypeError('Scripted views require local or embedded resources.');
    }
    let result: string;
    if (address.kind !== 'local') {
      result = address.url;
    } else {
      if (ancestors.has(address.path) || ancestors.size >= 16) {
        throw new TypeError('Scripted stylesheet dependency is cyclic or too deeply nested.');
      }
      let pending = this.urls.get(address.path);
      if (pending === undefined) {
        if (this.urls.size >= 256) {
          throw new RangeError('Too many scripted chapter resources.');
        }
        pending = this.build(href, from, address.path, new Set([...ancestors, address.path]));
        this.urls.set(address.path, pending);
      }
      result = (await withAbort(pending, this.signal)) + address.fragment;
    }
    this.signal.throwIfAborted();
    this.expanded += result.length;
    if (this.expanded > this.limit * 2) {
      throw new RangeError('Embedded chapter markup exceeds its resource budget.');
    }
    return result;
  }

  /** Bound raw resource reads and CSS expansion before encoding a persistent in-memory data URL. */
  private async build(
    href: string,
    from: string,
    path: string,
    ancestors: ReadonlySet<string>,
  ): Promise<string> {
    const bytes = await withAbort(this.book.bytes(href, from, this.signal), this.signal);
    this.signal.throwIfAborted();
    this.bytes += bytes.length;
    if (this.bytes > this.limit) {
      throw new RangeError('Scripted chapter resources exceed their byte budget.');
    }
    const type = this.types.get(path) ?? mimeType(path);
    if (type !== 'text/css') {
      return dataUrl(bytes, type);
    }
    if (bytes.length > 1024 * 1024) {
      throw new RangeError('Scripted stylesheet exceeds 1 MiB.');
    }
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const css = await rewriteCss(source, (reference) => this.url(reference, path, ancestors));
    this.signal.throwIfAborted();
    return textUrl(css, type);
  }
}
