/** Collect passive XHTML text and CFI steps without a browser DOM or render-time caches. */
import type { Document, Element, Node } from '@xmldom/xmldom';
import { parseXml, children } from '../xml/parse';
import { escapeCfi } from '../cfi/syntax';
import type { CfiStep } from '../cfi/types';
import { passiveElementRemoved } from '../content/policy';

/** Map logical text slots into a reading corpus that includes block separators. */
export interface TextRun {
  start: number;
  text: string;
  steps: readonly CfiStep[];
}

/** Character offsets refer to UTF-16 positions in the logical reading corpus. */
export interface TextCorpus {
  text: string;
  runs: TextRun[];
}

/** Location generation keeps its existing whitespace model; search can retain every native text slot. */
export interface CorpusOptions {
  preserveWhitespace?: boolean;
  additionalBlocks?: readonly string[];
  maxCharacters?: number;
}

/** Filled settings stay local to one traversal instead of becoming mutable module state. */
interface Collection {
  preserveWhitespace: boolean;
  blocks: ReadonlySet<string>;
  maxCharacters: number;
}

const blocks = new Set([
  'p',
  'div',
  'section',
  'article',
  'aside',
  'li',
  'tr',
  'td',
  'th',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'br',
]);

/** Narrow parsed XML elements by their DOM node type. */
function element(node: Node): node is Element {
  return node.nodeType === 1;
}

/** Separate adjacent blocks without adding repeated or leading synthetic newlines. */
function boundary(corpus: TextCorpus): void {
  if (corpus.text !== '' && !corpus.text.endsWith('\n')) {
    corpus.text += '\n';
  }
}

/** Retain configured native text slots and enforce the corpus bound before publishing a run. */
function appendText(
  corpus: TextCorpus,
  path: readonly CfiStep[],
  count: number,
  text: string,
  settings: Collection,
): void {
  if (text !== '' && (settings.preserveWhitespace || text.trim() !== '')) {
    if (corpus.text.length + text.length > settings.maxCharacters) {
      throw new RangeError('Text corpus exceeds the supported size.');
    }
    corpus.runs.push({
      start: corpus.text.length,
      text,
      steps: [...path, { value: count * 2 + 1, assertion: null }],
    });
    corpus.text += text;
  }
}

/** Visit meaningful children, matching the renderer's passive element-removal policy. */
function collect(
  parent: Element,
  path: readonly CfiStep[],
  corpus: TextCorpus,
  depth: number,
  settings: Collection,
): void {
  if (depth > 128) {
    throw new RangeError('Text indexing exceeds supported document nesting.');
  }
  let count = 0;
  let text = '';
  /** Adjacent text/CDATA nodes share one CFI slot, including across comments and removed scripts. */
  const flush = (): void => {
    appendText(corpus, path, count, text, settings);
    text = '';
  };
  for (const node of Array.from(parent.childNodes)) {
    if (element(node)) {
      const name = (node.localName || node.nodeName).toLowerCase();
      if (passiveElementRemoved(name, node.getAttribute('http-equiv'))) {
        continue;
      }
      flush();
      count += 1;
      if (name === 'style') {
        continue;
      }
      const id = node.getAttribute('id');
      const steps = [
        ...path,
        { value: count * 2, assertion: id === null || id === '' ? null : escapeCfi(id) },
      ];
      if (settings.blocks.has(name)) {
        boundary(corpus);
      }
      collect(node, steps, corpus, depth + 1, settings);
      if (settings.blocks.has(name)) {
        boundary(corpus);
      }
    } else if (node.nodeType === 3 || node.nodeType === 4) {
      text += node.nodeValue || '';
    }
  }
  flush();
}

/** Build a passive body corpus; native standards-mode HTML always places body at step /4. */
export function chapterCorpus(source: string): TextCorpus {
  return documentCorpus(parseXml(source, 'xhtml'));
}

/** Reuse an already loaded headless DOM rather than serializing/parsing it again for every query. */
export function documentCorpus(document: Document, options: CorpusOptions = {}): TextCorpus {
  if (
    options.maxCharacters !== undefined &&
    (!Number.isSafeInteger(options.maxCharacters) || options.maxCharacters < 0)
  ) {
    throw new RangeError('Text corpus size must be a non-negative integer.');
  }
  const root = document.documentElement;
  const body =
    root === null ? undefined : children(root, 'body', 'http://www.w3.org/1999/xhtml')[0];
  if (root?.localName !== 'html' || body === undefined) {
    throw new TypeError('Text indexing requires an XHTML body.');
  }
  const corpus: TextCorpus = { text: '', runs: [] };
  const id = body.getAttribute('id');
  collect(
    body,
    [{ value: 4, assertion: id === null || id === '' ? null : escapeCfi(id) }],
    corpus,
    0,
    {
      preserveWhitespace: options.preserveWhitespace ?? false,
      blocks:
        options.additionalBlocks === undefined
          ? blocks
          : new Set([...blocks, ...options.additionalBlocks]),
      maxCharacters: options.maxCharacters ?? Infinity,
    },
  );
  if (!options.preserveWhitespace && corpus.text.endsWith('\n')) {
    corpus.text = corpus.text.slice(0, -1);
  }
  if (corpus.text.length > (options.maxCharacters ?? Infinity)) {
    throw new RangeError('Text corpus exceeds the supported size.');
  }
  return corpus;
}
