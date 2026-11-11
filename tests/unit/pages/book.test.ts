/** Headless book integration resolves print-page anchors relative to nav/NCX paths and passive DOM structure. */
import { expect, test } from 'vitest';
import { Book, Cfi } from '../../../src/index';
import { bookFiles, bookZip } from '../book/fixture';
import { pageFiles, cfi } from './fixture';
import { nav } from '../navigation/fixture';

for (const edition of ['2', '3'] as const) {
  test(`resolves EPUB ${edition} labels and page-break elements without creating a reader`, async () => {
    const book = await Book.open(bookZip(pageFiles(edition)));
    try {
      expect(book.pageList.entries.map((page) => page.label)).toEqual(['iv', '1', '3']);
      expect(book.pageList.cfiFromPage(1)).toBeNull();
      const entries = await book.pageList.generate();
      expect(entries[0]?.cfi).toBe('epubcfi(/6/2[chapter]!/4[body])');
      expect(entries[1]?.cfi).toBe('epubcfi(/6/2[chapter]!/4[body]/4[p^[1^]])');
      expect(entries[2]?.cfi).toBe('epubcfi(/6/2[chapter]!/4[body]/8[p2])');
      expect(book.pageList.pageFromCfi(entries[1]?.cfi ?? '')?.label).toBe('1');
      expect(book.pageList.percentageFromPage('3')).toBe(1);
      expect(new Cfi(book.pageList.cfiFromPercentage(0.5) ?? '').spineId).toBe('chapter');
    } finally {
      book.destroy();
    }
    expect(book.pageList.length).toBe(0);
  });
}

test('provides an empty page table when no page-list or navigation is declared', async () => {
  for (const navigation of [true, false]) {
    const book = await Book.open(bookZip(bookFiles('3', navigation)));
    try {
      expect(await book.pageList.generate()).toEqual([]);
    } finally {
      book.destroy();
    }
  }
});

/** Replace the first encoded page destination in a complete local publication. */
function target(href: string): Map<string, string> {
  const files = pageFiles();
  files.set(
    'OPS/nav/pages.xhtml',
    (files.get('OPS/nav/pages.xhtml') ?? '').replace(
      'href="../text/chapter%20one.xhtml">iv</a>',
      `href="${href}">iv</a>`,
    ),
  );
  return files;
}

test('validates direct CFIs during opening and resolves valid CFI fragments without chapter reads', async () => {
  const book = await Book.open(bookZip(target(`#${cfi(0)}`)));
  try {
    expect(book.pageList.cfiFromPage('iv')).toBe(cfi(0));
    await book.pageList.generate();
  } finally {
    book.destroy();
  }
  for (const value of [
    'epubcfi(/8/2[chapter]!/4)',
    'epubcfi(/6/2[missing]!/4)',
    'epubcfi(/6/4!/4)',
    'epubcfi(/6/2[chapter])',
    'epubcfi(/6/4[chapter]!/4)',
  ]) {
    await expect(Book.open(bookZip(target(`#${value}`)))).rejects.toThrow();
  }
});

test('generates direct-CFI page tables without requesting chapter bodies', async () => {
  const files = pageFiles();
  files.set(
    'OPS/nav/pages.xhtml',
    nav(
      '',
      `<nav epub:type="page-list"><ol>${[0, 10, 20].map((offset) => `<li><a href="#${cfi(offset)}">${offset}</a></li>`).join('')}</ol></nav>`,
    ),
  );
  const reads: string[] = [];
  const book = await Book.open('https://original.invalid/OPS/package.opf', {
    fetch: (input) => {
      const url = input instanceof Request ? input.url : input;
      const path = decodeURIComponent(new URL(url).pathname.slice(1));
      reads.push(path);
      return Promise.resolve(
        new Response(files.get(path) ?? 'missing', { status: files.has(path) ? 200 : 404 }),
      );
    },
  });
  try {
    const before = [...reads];
    await book.pageList.generate();
    expect(reads).toEqual(before);
    expect(book.pageList.cfiFromPage(20)).toBe(cfi(20));
  } finally {
    book.destroy();
  }
});

test('rejects non-spine, remote, missing, and removed-content page destinations atomically', async () => {
  const targets = [
    '../images/cover.jpg',
    'https://original.invalid/page.xhtml',
    '../text/chapter%20one.xhtml#missing',
  ];
  for (const href of targets) {
    const book = await Book.open(bookZip(target(href)), { allowRemote: true });
    const previous = book.pageList.entries;
    try {
      await expect(book.pageList.generate()).rejects.toThrow();
      expect(book.pageList.entries).toBe(previous);
    } finally {
      book.destroy();
    }
  }
  const files = target('../text/chapter%20one.xhtml#removed');
  files.set(
    'OPS/text/chapter one.xhtml',
    (files.get('OPS/text/chapter one.xhtml') ?? '').replace('<script>', '<script id="removed">'),
  );
  const book = await Book.open(bookZip(files));
  try {
    await expect(book.pageList.generate()).rejects.toThrow('removed');
  } finally {
    book.destroy();
  }
});

test('book destruction cancels page generation even when chapter fetch ignores cancellation', async () => {
  const files = pageFiles();
  let begin: (() => void) | undefined;
  let finish: ((response: Response) => void) | undefined;
  const started = new Promise<void>((resolve) => {
    begin = resolve;
  });
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const book = await Book.open('https://original.invalid/OPS/package.opf', {
    fetch: (input) => {
      const url = input instanceof Request ? input.url : input;
      const path = decodeURIComponent(new URL(url).pathname.slice(1));
      if (path === 'OPS/text/chapter one.xhtml') {
        begin?.();
        return pending;
      }
      return Promise.resolve(new Response(files.get(path), { status: 200 }));
    },
  });
  const generation = book.pageList.generate();
  const rejected = expect(generation).rejects.toThrow();
  await started;
  book.destroy();
  await rejected;
  expect(book.pageList.length).toBe(0);
  finish?.(new Response(files.get('OPS/text/chapter one.xhtml')));
  await pending;
});
