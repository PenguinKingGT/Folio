/** Search passive chapter text across inline nodes and return complete, headless CFI ranges with excerpts. */
import type { Document } from '@xmldom/xmldom';
import { documentCorpus } from '../text/corpus';
import { corpusRange } from '../text/position';
import { scalarBoundary } from '../text/scalars';
import { SearchText } from './normalized';
import type { SearchSettings } from './options';
import type { SearchMatch } from './types';

/** Search separates semantic blocks that can otherwise be fused in minified publication markup. */
const searchBlocks = [
  'address',
  'dd',
  'dl',
  'dt',
  'figure',
  'figcaption',
  'footer',
  'header',
  'main',
  'nav',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'ul',
  'ol',
  'hr',
];

/** Escape regex metacharacters; callers provide literal queries rather than executable patterns. */
function literal(query: string): string {
  return query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Clip context outside surrogate pairs and add ellipses only when actual surrounding content is omitted. */
function excerpt(text: string, start: number, end: number, context: number): string {
  const from = scalarBoundary(text, Math.max(0, start - context), false);
  const to = scalarBoundary(text, Math.min(text.length, end + context), true);
  return `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`;
}

/** Query one already loaded DOM; cancellation is checked before traversal and between bounded result entries. */
export function searchDocument(
  document: Document,
  query: string,
  settings: SearchSettings,
  section: { index: number; href: string; base: string },
): readonly SearchMatch[] {
  settings.signal?.throwIfAborted();
  const corpus = documentCorpus(document, {
    preserveWhitespace: true,
    additionalBlocks: searchBlocks,
    maxCharacters: 2_000_000,
  });
  const text = new SearchText(corpus.text, settings.normalizeWhitespace);
  // Unicode ignore-case uses native simple case folding, never lowercasing or changing source offsets.
  const pattern = new RegExp(literal(query), settings.caseSensitive ? 'gu' : 'giu');
  const results: SearchMatch[] = [];
  let match: RegExpExecArray | null;
  while (results.length < settings.limit && (match = pattern.exec(text.text)) !== null) {
    settings.signal?.throwIfAborted();
    const end = match.index + match[0].length;
    results.push(
      Object.freeze({
        sectionIndex: section.index,
        href: section.href,
        cfi: corpusRange(corpus, text.position(match.index), text.position(end), section.base),
        match: match[0],
        excerpt: excerpt(text.text, match.index, end, settings.context),
      }),
    );
    if (settings.overlap) {
      pattern.lastIndex = scalarBoundary(text.text, match.index + 1, true);
    }
  }
  return Object.freeze(results);
}
