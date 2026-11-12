/** Script execution errors remain typed notifications while unsupported content and resource failures reject before execution. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookZip, bookFiles } from '../../unit/book/fixture';
import { scriptedFiles } from './fixture';
import { host } from '../render/fixture';
import { gate } from '../../unit/extensions/fixture';

test('publisher exceptions are reported without losing a ready, isolated reading surface', async () => {
  const files = scriptedFiles();
  files.set('OPS/assets/reader.js', 'throw new Error("Original publisher failure");');
  const book = await Book.open(bookZip(files));
  const container = host();
  const reader = book.renderScriptedTo(container, { scripts: true });
  const failed = gate();
  const errors: unknown[] = [];
  reader.on('error', (error) => {
    errors.push(error);
    failed.release();
  });
  try {
    await reader.display();
    await failed.promise;
    expect(errors).toHaveLength(1);
    expect(reader.lastError).toBe(errors[0]);
    expect(reader.currentSection?.index).toBe(0);
    expect(reader.frame.contentDocument).toBeNull();
  } finally {
    book.destroy();
    container.remove();
  }
});

test('module graphs and missing executable resources reject, while a later ordinary chapter can still display', async () => {
  for (const source of [
    '<script type="module">export const original = true;</script>',
    '<script src="missing.js"/>',
  ]) {
    const files = scriptedFiles();
    files.set(
      'OPS/text/chapter one.xhtml',
      `<html xmlns="http://www.w3.org/1999/xhtml"><head/>` +
        `<body><p>Original failed chapter</p>${source}</body></html>`,
    );
    const book = await Book.open(bookZip(files));
    const container = host();
    const reader = book.renderScriptedTo(container, { scripts: true });
    try {
      await expect(reader.display()).rejects.toThrow();
      expect(reader.lastError).toBeInstanceOf(Error);
      expect(reader.currentSection).toBeNull();
      expect(reader.frame.hidden).toBe(true);
      expect((await reader.display(2)).index).toBe(2);
      expect(reader.lastError).toBeNull();
    } finally {
      book.destroy();
      container.remove();
    }
  }
});

test('inert script types are removed and inline async/defer attributes retain original ordered classic semantics', async () => {
  const files = scriptedFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    (files.get('OPS/text/chapter one.xhtml') ?? '')
      .replace(
        '<script><![CDATA[',
        '<script type="text/javascript" async="async" defer="defer"><![CDATA[',
      )
      .replace('</body>', '<script type="application/ld+json">{}</script></body>'),
  );
  const book = await Book.open(bookZip(files));
  const container = host();
  const reader = book.renderScriptedTo(container, { scripts: true });
  const messages: unknown[] = [];
  reader.on('message', (value) => messages.push(value));
  try {
    await reader.display();
    expect(messages).toContainEqual(expect.objectContaining({ order: ['inline', 'external'] }));
  } finally {
    book.destroy();
    container.remove();
  }
});

test('nonlocal chapter identities reject before opaque content is assigned', async () => {
  const files = bookFiles();
  const target = `data:application/xhtml+xml,${encodeURIComponent('<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Inline</p></body></html>')}`;
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace(
      'href="text/chapter%20one.xhtml"',
      `href="${target}"`,
    ),
  );
  const book = await Book.open(bookZip(files));
  const container = host();
  const reader = book.renderScriptedTo(container, { scripts: true });
  try {
    await expect(reader.display()).rejects.toThrow('local publication');
  } finally {
    book.destroy();
    container.remove();
  }
});
