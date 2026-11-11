/** A held theme response makes cancellation and chapter/theme races deterministic without arbitrary delays. */
import { Book } from '../../../src/index';
import { themeFiles } from './fixture';

/** Allow package and chapter requests while holding one stylesheet producer. */
export async function delayedTheme(): Promise<{
  book: Book;
  started: Promise<void>;
  release: () => void;
}> {
  const files = themeFiles();
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
      const path = decodeURIComponent(
        new URL(input instanceof Request ? input.url : input).pathname.slice(1),
      );
      if (path === 'OPS/held.css') {
        begin?.();
        return pending;
      }
      return Promise.resolve(
        new Response(files.get(path) ?? 'missing', { status: files.has(path) ? 200 : 404 }),
      );
    },
  });
  return { book, started, release: () => finish?.(new Response('p{color:red}')) };
}
