/** Headless scripted-resource embedding retains byte identity, CSS dependencies, path policy and explicit expansion bounds. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { ScriptResources } from '../../../src/scripted/resources';
import { bookZip } from '../book/fixture';
import { scriptedFiles } from '../../browser/scripted/fixture';

/** Decode only the embedded body, excluding a preserved resource fragment. */
function decode(url: string): string {
  return new TextDecoder().decode(
    Uint8Array.from(atob(url.split(',')[1]?.split('#')[0] ?? ''), (char) => char.charCodeAt(0)),
  );
}

test('embeds CSS imports, SVG dependencies and declared MIME types while reusing resource reads', async () => {
  const files = scriptedFiles();
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace(
      '</manifest>',
      '<item id="asset" href="assets/box.svg" media-type="image/svg+xml"/></manifest>',
    ),
  );
  const book = await Book.open(bookZip(files), { allowRemote: true });
  const resources = new ScriptResources(book, new AbortController().signal, 32 * 1024 * 1024);
  let read = 0;
  book.on('resourceLoaded', () => {
    read += 1;
  });
  try {
    const url = await resources.url('../assets/style.css', 'OPS/text/chapter one.xhtml');
    expect(url).toMatch(/^data:text\/css;base64,/);
    expect(decode(url)).toContain('data:text/css;base64,');
    expect(decode(url)).toContain('rgb(1,2,3)');
    const count = read;
    expect(await resources.url('../assets/style.css#fragment', 'OPS/text/chapter one.xhtml')).toBe(
      `${url}#fragment`,
    );
    expect(read).toBe(count);
    const svg = await resources.url('../assets/box.svg', 'OPS/text/chapter one.xhtml');
    expect(decode(svg)).toContain('<svg');
    expect(await resources.url('#shape', 'OPS/page.xhtml')).toBe('#shape');
    expect(await resources.url('data:text/plain,original', 'OPS/page.xhtml')).toBe(
      'data:text/plain,original',
    );
    await expect(
      resources.url('https://original.invalid/remote.js', 'OPS/page.xhtml'),
    ).rejects.toThrow('local or embedded');
  } finally {
    book.destroy();
  }
});

test('rejects raw/expanded byte overruns and oversized stylesheets before publishing incomplete resources', async () => {
  const files = scriptedFiles();
  files.set('OPS/large.css', ' '.repeat(1024 * 1024 + 1));
  const book = await Book.open(bookZip(files));
  const signal = new AbortController().signal;
  try {
    await expect(
      new ScriptResources(book, signal, 1).url('../assets/box.svg', 'OPS/text/chapter one.xhtml'),
    ).rejects.toThrow('byte budget');
    await expect(
      new ScriptResources(book, signal, 20).url(
        'data:text/plain,' + 'x'.repeat(41),
        'OPS/page.xhtml',
      ),
    ).rejects.toThrow('markup');
    await expect(
      new ScriptResources(book, signal, 2 * 1024 * 1024).url('large.css', 'OPS/page.xhtml'),
    ).rejects.toThrow('1 MiB');
  } finally {
    book.destroy();
  }
});

test('rejects cycles and deeply nested CSS dependencies with no pending-cache deadlock', async () => {
  const files = scriptedFiles();
  files.set('OPS/cycle.css', '@import "cycle.css";');
  for (let index = 0; index <= 16; index += 1) {
    files.set(`OPS/depth${index}.css`, `@import "depth${index + 1}.css";`);
  }
  const book = await Book.open(bookZip(files));
  const resources = new ScriptResources(book, new AbortController().signal, 32 * 1024 * 1024);
  try {
    await expect(resources.url('cycle.css', 'OPS/page.xhtml')).rejects.toThrow('cyclic');
    await expect(resources.url('depth0.css', 'OPS/page.xhtml')).rejects.toThrow('deeply');
  } finally {
    book.destroy();
  }
});

test('bounds distinct resources and pre-cancellation performs no byte reads', async () => {
  const files = scriptedFiles();
  for (let index = 0; index <= 256; index += 1) {
    files.set(`OPS/asset${index}.bin`, 'original');
  }
  const book = await Book.open(bookZip(files));
  let read = 0;
  book.on('resourceLoaded', () => {
    read += 1;
  });
  const controller = new AbortController();
  controller.abort();
  try {
    await expect(
      new ScriptResources(book, controller.signal, 1000).url('asset0.bin', 'OPS/page.xhtml'),
    ).rejects.toThrow();
    expect(read).toBe(0);
    const resources = new ScriptResources(book, new AbortController().signal, 1024 * 1024);
    for (let index = 0; index < 256; index += 1) {
      await resources.url(`asset${index}.bin`, 'OPS/page.xhtml');
    }
    await expect(resources.url('asset256.bin', 'OPS/page.xhtml')).rejects.toThrow('Too many');
    expect(read).toBe(256);
  } finally {
    book.destroy();
  }
});
