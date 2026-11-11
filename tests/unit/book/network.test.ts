/** Exercise URL, extracted-directory, direct-OPF and injected transports against local HTTP. */
import { createServer } from 'node:http';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookFiles, bookZip } from './fixture';

const files = bookFiles();
const requests: string[] = [];
const server = createServer((request, response) => {
  const path = decodeURIComponent((request.url ?? '').split('?', 1)[0] ?? '');
  requests.push(path);
  if (path === '/book.epub') {
    response.end(bookZip());
    return;
  }
  const value = files.get(path.replace(/^\/books\//, ''));
  if (value === undefined) {
    response.writeHead(404).end('missing');
    return;
  }
  response.end(value);
});
let origin = '';

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a TCP test server.');
  }
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  );
});

test.each(['/book.epub', '/books/', '/books', '/books/OPS/package.opf?token=original'])(
  'opens %s and lazily reads chapter resources',
  async (path) => {
    requests.length = 0;
    const book = await Book.open(new URL(path, origin));
    expect(requests).not.toContain('/books/OPS/text/chapter one.xhtml');
    expect(await book.section(0)?.render()).toContain('Original chapter text');
    expect(await book.text('images/cover.jpg')).toBe('original cover bytes');
    book.destroy();
  },
);

test('supports base URLs and authenticated custom transport options', async () => {
  let authorization = '';
  const book = await Book.open('book.epub', {
    baseUrl: `${origin}/`,
    credentials: 'include',
    headers: { Authorization: 'original' },
    fetch: (url, options) => {
      authorization = new Headers(options?.headers).get('authorization') ?? '';
      expect(options?.credentials).toBe('include');
      return fetch(url, options);
    },
  });
  expect(authorization).toBe('original');
  book.destroy();
});

test('reads explicit remote and inline bytes while enforcing default policy', async () => {
  const book = await Book.open(`${origin}/book.epub`, { allowRemote: true });
  expect(await book.text(`${origin}/books/OPS/images/cover.jpg`)).toBe('original cover bytes');
  expect(await book.text('data:text/plain,inline')).toBe('inline');
  book.destroy();
  const strict = await Book.open(`${origin}/book.epub`);
  await expect(strict.bytes(`${origin}/books/OPS/images/cover.jpg`)).rejects.toThrow('disabled');
  strict.destroy();
});

test('propagates HTTP and transport failures', async () => {
  await expect(Book.open(`${origin}/missing.epub`)).rejects.toMatchObject({ status: 404 });
  await expect(Book.open(`${origin}/missing/`)).rejects.toMatchObject({ status: 404 });
  await expect(
    Book.open(`${origin}/book.epub`, { fetch: () => Promise.reject(new Error('offline')) }),
  ).rejects.toThrow('offline');
});
