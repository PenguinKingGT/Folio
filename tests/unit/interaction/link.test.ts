/** Link policy resolves local spine identity without granting outbound navigation resource-fetch privileges. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { contentLink } from '../../../src/interaction/link';
import { bookZip } from '../book/fixture';
import { interactionFiles } from '../../browser/interaction/fixture';

test('classifies chapter, fragment, CFI, resource and safe outbound hyperlinks', async () => {
  const book = await Book.open(bookZip(interactionFiles()));
  try {
    const section = book.section(0);
    if (!section) {
      throw new Error('Missing hyperlink origin.');
    }
    const linked = contentLink(book, section, '../s2.xhtml#start-2');
    expect(linked.kind).toBe('internal');
    expect(linked.resolvedHref).toBe('OPS/s2.xhtml#start-2');
    expect(linked.target).toEqual({
      href: '../s2.xhtml#start-2',
      from: 'OPS/text/chapter one.xhtml',
    });
    expect(Object.isFrozen(linked.target)).toBe(true);
    expect(contentLink(book, section, '#tail').target).toEqual({
      href: 'chapter%20one.xhtml#tail',
      from: 'OPS/text/chapter one.xhtml',
    });
    expect(contentLink(book, section, '').kind).toBe('internal');
    const cfi = 'epubcfi(/6/6[s2]!/4/2[start-2])';
    expect(contentLink(book, section, cfi).target).toBe(cfi);
    expect(contentLink(book, section, `#${cfi}`).target).toBe(cfi);
    expect(contentLink(book, section, '../images/cover.jpg').kind).toBe('resource');
    for (const href of [
      'https://original.invalid',
      '//original.invalid/read',
      'http://original.invalid',
      'mailto:reader@example.invalid',
      'tel:+123456',
    ]) {
      expect(contentLink(book, section, href).kind).toBe('external');
    }
    for (const href of [
      'javascript:alert(1)',
      'data:text/html,hello',
      '../../../outside.xhtml',
      'epubcfi(/6/200[missing]!/4/2)',
    ]) {
      expect(() => contentLink(book, section, href)).toThrow();
    }
  } finally {
    book.destroy();
  }
});

test('rejects a foreign remote chapter as the origin before resolving relative navigation', async () => {
  const files = interactionFiles();
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace(
      'href="text/chapter%20one.xhtml"',
      'href="https://original.invalid/foreign.xhtml"',
    ),
  );
  const book = await Book.open(bookZip(files));
  try {
    const section = book.section(0);
    if (!section) {
      throw new Error('Missing remote origin.');
    }
    expect(() => contentLink(book, section, '#tail')).toThrow('local spine');
  } finally {
    book.destroy();
  }
});
