/** Hold a link target chapter while keeping all other publication reads local and immediate. */
import { Book } from '../../../src/index';
import { interactionFiles } from './fixture';

/** Expose controlled producer start/completion for deterministic navigation races. */
export async function delayedLink(): Promise<{
  book: Book;
  started: Promise<void>;
  release: () => void;
}> {
  const files = interactionFiles();
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
      if (path === 'OPS/s2.xhtml') {
        begin?.();
        return pending;
      }
      return Promise.resolve(
        new Response(files.get(path) ?? 'missing', { status: files.has(path) ? 200 : 404 }),
      );
    },
  });
  return { book, started, release: () => finish?.(new Response(files.get('OPS/s2.xhtml'))) };
}
