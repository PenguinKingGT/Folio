/** Collect passive XHTML text and CFI steps without a browser DOM or render-time caches. */
import type { Element, Node } from '@xmldom/xmldom';
import { parseXml, children } from '../xml/parse';
import { escapeCfi } from '../cfi/syntax';
import { serializeCfiPath } from '../cfi/path';
import type { CfiStep } from '../cfi/types';
import { passiveElementRemoved } from '../content/policy';
import { lowerBound } from './search';

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

/** Ignore indentation-only slots while retaining meaningful adjacent character data. */
function appendText(
  corpus: TextCorpus,
  path: readonly CfiStep[],
  count: number,
  text: string,
): void {
  if (text.trim() !== '') {
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
): void {
  if (depth > 128) {
    throw new RangeError('Location indexing exceeds supported document nesting.');
  }
  let count = 0;
  let text = '';
  /** Adjacent text/CDATA nodes share one CFI slot, including across comments and removed scripts. */
  const flush = (): void => {
    appendText(corpus, path, count, text);
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
      if (blocks.has(name)) {
        boundary(corpus);
      }
      collect(node, steps, corpus, depth + 1);
      if (blocks.has(name)) {
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
  const document = parseXml(source, 'xhtml');
  const root = document.documentElement;
  const body =
    root === null ? undefined : children(root, 'body', 'http://www.w3.org/1999/xhtml')[0];
  if (root?.localName !== 'html' || body === undefined) {
    throw new TypeError('Location indexing requires an XHTML body.');
  }
  const corpus: TextCorpus = { text: '', runs: [] };
  const id = body.getAttribute('id');
  collect(
    body,
    [{ value: 4, assertion: id === null || id === '' ? null : escapeCfi(id) }],
    corpus,
    0,
  );
  if (corpus.text.endsWith('\n')) {
    corpus.text = corpus.text.slice(0, -1);
  }
  return corpus;
}

/** Map an abstract character position to its nearest concrete text slot without splitting surrogates. */
export function corpusPoint(
  corpus: TextCorpus,
  offset: number,
  base: string,
): { cfi: string; offset: number } {
  const index = lowerBound(corpus.runs, (entry) => offset < entry.start + entry.text.length);
  const run = corpus.runs[index] ?? corpus.runs[corpus.runs.length - 1];
  if (run === undefined) {
    throw new RangeError('Cannot locate text in an empty chapter.');
  }
  let local = Math.min(run.text.length, Math.max(0, offset - run.start));
  const code = run.text.charCodeAt(local);
  if (local > 0 && code >= 0xdc00 && code <= 0xdfff) {
    local += 1;
  }
  return {
    cfi: `epubcfi(${base}!${serializeCfiPath({ steps: run.steps, offset: local, assertion: null })})`,
    offset: run.start + local,
  };
}
