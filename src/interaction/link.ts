/** Resolve hyperlink intent without treating outbound navigation as permission to fetch publication assets. */
import type { Book } from '../book/book';
import type { Section } from '../spine/section';
import { resolveResource } from '../resources/path';
import { Cfi } from '../cfi/cfi';
import type { ContentLink } from './types';

/** Preserve safe outbound URI schemes for host decisions; never open windows from the core library. */
function outbound(href: string): boolean {
  if (/^(?:https?:)?\/\//i.test(href)) {
    const url = new URL(href, 'https://reader.invalid');
    if (!url.hostname) {
      throw new TypeError('Invalid external hyperlink.');
    }
    return true;
  }
  return /^(?:mailto|tel):/i.test(href);
}

/** Return an immutable local-spine, local-resource, or safe outbound hyperlink descriptor. */
export function contentLink(book: Book, section: Section, input: string): ContentLink {
  const href = input.trim();
  const source = resolveResource(section.href, book.packagePath);
  if (source.kind !== 'local') {
    throw new TypeError('Content links require a local spine document.');
  }
  if (outbound(href)) {
    return Object.freeze({ href, resolvedHref: href, kind: 'external', section, target: null });
  }
  if (/^#?epubcfi\(/.test(href)) {
    const cfi = new Cfi(href).toString();
    if (book.section(cfi) === null) {
      throw new RangeError('Linked CFI is outside the spine.');
    }
    return Object.freeze({ href, resolvedHref: cfi, kind: 'internal', section, target: cfi });
  }
  const address = resolveResource(href, source.path);
  if (address.kind === 'inline' || address.kind === 'external') {
    throw new TypeError('Unsupported content link.');
  }
  const path = address.kind === 'local' ? address.path : source.path;
  const fragment = address.kind === 'local' ? address.fragment : address.url;
  const internal = book.spine.all().some((item) => {
    const entry = resolveResource(item.href, book.packagePath);
    return entry.kind === 'local' && entry.path === path;
  });
  // Fragment-only targets must use their origin, including when that chapter is preloaded.
  const targetHref =
    address.kind === 'fragment'
      ? encodeURIComponent(source.path.split('/').at(-1) ?? '') + fragment
      : href;
  return Object.freeze({
    href,
    resolvedHref: path + fragment,
    kind: internal ? 'internal' : 'resource',
    section,
    target: internal ? Object.freeze({ href: targetHref, from: source.path }) : null,
  });
}
