/** Resolve reader destinations independently of browser geometry. */
import type { Book } from '../book/book';
import { Cfi } from '../cfi/cfi';
import type { Section } from '../spine/section';

/** Hrefs default to the OPF base; percentages use the publication's sampled progress index. */
export type DisplayTarget =
  number | string | { href: string; from?: string } | { percentage: number };

/** A chapter identity and an optional precise destination within its document. */
export interface ResolvedTarget {
  readonly section: Section;
  readonly cfi: Cfi | null;
  readonly fragment: string | null;
}

/** Require a known chapter before starting document loading. */
function destination(
  section: Section | null,
  cfi: Cfi | null = null,
  fragment: string | null = null,
): ResolvedTarget {
  if (section === null) {
    throw new RangeError('Requested chapter is not in the spine.');
  }
  return { section, cfi, fragment };
}

/** Resolve container-relative hrefs by resource identity rather than textual path equality. */
function hrefTarget(
  book: Book,
  href: string,
  from: string,
  current: Section | null,
): ResolvedTarget {
  const address = book.resources.resolve(href, from);
  if (address.kind === 'fragment') {
    return destination(current ?? book.section(), null, decodeURIComponent(address.url.slice(1)));
  }
  if (address.kind !== 'local') {
    throw new TypeError('Reading targets must identify a local spine resource.');
  }
  const section = book.spine.all().find((item) => {
    const candidate = book.resources.resolve(item.href);
    return candidate.kind === 'local' && candidate.path === address.path;
  });
  return destination(section ?? null, null, decodeURIComponent(address.fragment.slice(1)));
}

/** Generate progress only when necessary and propagate cancellation through chapter reads. */
async function percentageTarget(
  book: Book,
  percentage: number,
  signal: AbortSignal,
): Promise<ResolvedTarget> {
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 1) {
    throw new RangeError('Progress must be between zero and one.');
  }
  if (book.locations.length === 0) {
    await book.locations.generate({ signal });
  }
  signal.throwIfAborted();
  const value = book.locations.cfiFromPercentage(percentage);
  if (value === null) {
    throw new RangeError('The publication has no indexed reading content.');
  }
  return destination(book.section(value), new Cfi(value));
}

/** Resolve chapter, ID, href, fragment, CFI, or sampled-percentage destinations. */
export async function resolveDisplayTarget(
  book: Book,
  current: Section | null,
  target: DisplayTarget | undefined,
  signal: AbortSignal,
): Promise<ResolvedTarget> {
  signal.throwIfAborted();
  if (target === undefined || typeof target === 'number') {
    return destination(book.section(target));
  }
  if (typeof target !== 'string') {
    return 'percentage' in target
      ? percentageTarget(book, target.percentage, signal)
      : hrefTarget(book, target.href, target.from ?? book.packagePath, current);
  }
  if (target.startsWith('epubcfi(') || target.startsWith('#epubcfi(')) {
    return destination(book.section(target), new Cfi(target));
  }
  if (target.startsWith('#')) {
    const section = book.section(target);
    if (section !== null) {
      return destination(section);
    }
  }
  return hrefTarget(book, target, book.packagePath, current);
}
