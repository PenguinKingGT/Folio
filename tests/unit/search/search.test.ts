/** Chapter search returns full ranges across inline nodes, literal punctuation, semantic blocks, and passive content. */
import { expect, test } from 'vitest';
import { Cfi } from '../../../src/index';
import { searchBook } from './fixture';

test('matches phrases across arbitrary inline nodes while skipping head, scripts and style text', async () => {
  const book = await searchBook();
  try {
    const section = book.section();
    if (!section) {
      throw new Error('Missing search chapter.');
    }
    const found = await section.search('ORIGINAL TEXT');
    expect(found).toHaveLength(1);
    expect(found[0]?.match).toBe('original text');
    expect(new Cfi(found[0]?.cfi ?? '').isRange).toBe(true);
    expect(found[0]?.cfi).toContain('/4[reading-body]/4[phrase]');
    expect(found[0]?.sectionIndex).toBe(0);
    expect(found[0]?.href).toBe('text/chapter%20one.xhtml');
    expect(found[0]?.excerpt).toContain('Alpha original text tail.');
    expect(Object.isFrozen(found)).toBe(true);
    expect(Object.isFrozen(found[0])).toBe(true);
    expect(await section.find('original text')).toEqual(found);
    expect(await section.search('ORIGINAL TEXT', { caseSensitive: true })).toEqual([]);
    for (const query of ['Head secret', 'style secret', 'script secret', 'ignored secret']) {
      expect(await section.search(query)).toEqual([]);
    }
    expect((await section.search('abcdef'))[0]?.match).toBe('abcdef');
  } finally {
    book.destroy();
  }
});

test('preserves native offsets through whitespace normalization and separates minified blocks', async () => {
  const book = await searchBook();
  try {
    const section = book.section();
    if (!section) {
      throw new Error('Missing whitespace chapter.');
    }
    expect((await section.search('one two three'))[0]?.match).toBe('One two three');
    expect(await section.search('one two three', { normalizeWhitespace: false })).toEqual([]);
    expect(
      (await section.search('One \n\t two\u00a0three', { normalizeWhitespace: false }))[0]?.match,
    ).toBe('One \n\t two\u00a0three');
    expect((await section.search('BlockFirst BlockSecond'))[0]?.match).toBe(
      'BlockFirst BlockSecond',
    );
    expect(await section.search('BlockFirstBlockSecond')).toEqual([]);
    expect((await section.search('   original\ntext  '))[0]?.match).toBe('original text');
  } finally {
    book.destroy();
  }
});

test('escapes all literal regex metacharacters and supports bounded optional overlapping matches', async () => {
  const book = await searchBook();
  try {
    const section = book.section();
    if (!section) {
      throw new Error('Missing literal-search chapter.');
    }
    for (const query of ['.*', '[a]', '(x)?', '$^', '+', '|', '\\']) {
      expect((await section.search(query))[0]?.match).toBe(query);
    }
    expect(await section.search('ana')).toHaveLength(2);
    const overlaps = await section.search('ana', { overlap: true });
    expect(overlaps).toHaveLength(4);
    expect(new Set(overlaps.map((match) => match.cfi)).size).toBe(4);
    expect(await section.search('ana', { overlap: true, limit: 1 })).toHaveLength(1);
    expect((await section.search('banana', { context: 0 }))[0]?.excerpt).toBe('…banana…');
  } finally {
    book.destroy();
  }
});

test('uses Unicode case folding without lowercasing source offsets and preserves actual package spine identity', async () => {
  const book = await searchBook(true);
  try {
    const section = book.section();
    if (!section) {
      throw new Error('Missing Unicode chapter.');
    }
    expect((await section.search('σ')).map((match) => match.match)).toEqual(['Σ', 'σ', 'ς']);
    const deseret = await section.search('𐐨');
    expect(deseret.map((match) => match.match)).toEqual(['𐐀', '𐐨']);
    expect(deseret.every((match) => match.cfi.startsWith('epubcfi(/8/2[chapter]!'))).toBe(true);
    expect((await section.search('k')).map((match) => match.match)).toEqual(['K', 'k', 'k', 'k']);
    expect(
      (await section.search('σ', { caseSensitive: true })).map((match) => match.match),
    ).toEqual(['σ']);
    expect((await section.search('İ'))[0]?.match).toBe('İ');
    expect((await section.search('A', { caseSensitive: true, context: 2 }))[1]?.excerpt).toContain(
      '😀 A',
    );
    expect(await section.search('𐐀', { overlap: true })).toHaveLength(2);
    expect(await section.search('missing query')).toEqual([]);
  } finally {
    book.destroy();
  }
});
