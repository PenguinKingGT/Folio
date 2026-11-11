/** Destroying a reader during a touch turn cancels subscribers and suppresses late background errors. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { continuousFiles } from '../continuous/fixture';
import { host } from '../render/fixture';
import { swipe } from './fixture';

/** Hold the second chapter while keeping the initial short chapter readable. */
async function delayedTurn() {
  const files = continuousFiles(2, 0);
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
      if (path === 'OPS/s1.xhtml') {
        begin?.();
        return pending;
      }
      return Promise.resolve(
        new Response(files.get(path) ?? 'missing', { status: files.has(path) ? 200 : 404 }),
      );
    },
  });
  return { book, started, release: () => finish?.(new Response(files.get('OPS/s1.xhtml'))) };
}

test('book destruction cancels a pending gesture without retaining a destruction error', async () => {
  const { book, started, release } = await delayedTurn();
  const container = host();
  const reader = book.renderTo(container, { touch: true });
  try {
    await reader.display();
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing short chapter.');
    }
    swipe(document.body);
    await started;
    const rejected = expect(reader.touch.whenIdle()).rejects.toThrow();
    book.destroy();
    await rejected;
    expect(container.children).toHaveLength(0);
    expect(reader.touch.lastError).toBeNull();
  } finally {
    release();
    book.destroy();
    container.remove();
  }
});
