/** Sparse whitespace edits preserve original UTF-16 boundaries without storing a mapping for every character. */
import { expect, test } from 'vitest';
import { SearchText } from '../../../src/search/normalized';
import { documentCorpus } from '../../../src/text/corpus';
import { corpusRange } from '../../../src/text/position';
import { parseXml } from '../../../src/xml/parse';

test('maps collapsed and trimmed whitespace boundaries and preserves literal text', () => {
  const text = new SearchText('  A\t \nB\u00a0C  ', true);
  expect(text.text).toBe('A B C');
  expect([0, 1, 2, 3, 4, 5].map((offset) => text.position(offset))).toEqual([2, 3, 6, 7, 8, 9]);
  const literal = new SearchText(' A\n B ', false);
  expect(literal.text).toBe(' A\n B ');
  expect(literal.position(3)).toBe(3);
  expect(new SearchText('abc', true).position(1)).toBe(1);
  for (const offset of [-1, NaN, 99]) {
    expect(() => text.position(offset)).toThrow(RangeError);
  }
});

test('retains inline whitespace slots and maps end boundaries to the preceding native run', () => {
  const document = parseXml(
    '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Hello<em>world</em> <b>again</b></p></body></html>',
    'xhtml',
  );
  const corpus = documentCorpus(document, { preserveWhitespace: true });
  expect(corpus.text).toBe('Helloworld again\n');
  expect(corpusRange(corpus, 0, 5, '/6/2')).toBe('epubcfi(/6/2!/4/2/1,:0,:5)');
  expect(corpusRange(corpus, 5, 15, '/6/2')).toContain('/4/2,');
  for (const [start, end] of [
    [-1, 1],
    [0, 0],
    [0, 99],
    [NaN, 2],
  ]) {
    expect(() => corpusRange(corpus, start ?? 0, end ?? 0, '/6/2')).toThrow(RangeError);
  }
  expect(() => corpusRange({ text: 'a', runs: [] }, 0, 1, '/6/2')).toThrow('empty');
  for (const maxCharacters of [-1, 0.5, Infinity]) {
    expect(() => documentCorpus(document, { maxCharacters })).toThrow('integer');
  }
  expect(() => documentCorpus(document, { maxCharacters: 3 })).toThrow('size');
  // A final semantic block separator participates in the bound even if all native text fits.
  expect(() => documentCorpus(document, { preserveWhitespace: true, maxCharacters: 15 })).toThrow(
    'size',
  );
});
