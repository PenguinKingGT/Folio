/** Native view extension cleanup stays exactly once across standalone services and forced synchronous cancellation. */
import { expect, test } from 'vitest';
import { Book, IframeView } from '../../../src/index';
import { loadViewContent } from '../../../src/render/view-content';
import { chapterMarkup } from '../../../src/render/load-chapter';
import { bookFiles, bookZip } from '../../unit/book/fixture';
import { host } from '../render/fixture';
import { gate } from '../../unit/extensions/fixture';

test('standalone view loading supports absent reader services and releases native contexts exactly once', async () => {
  const book = await Book.open(bookZip(bookFiles()));
  const container = host();
  const view = new IframeView(container);
  const section = book.section();
  const signal = new AbortController().signal;
  let unloaded = 0;
  book.hooks.unload.register(() => {
    unloaded += 1;
  });
  try {
    if (!section) {
      throw new Error('Missing standalone extension chapter.');
    }
    const content = await chapterMarkup(book, section, 'standalone', signal);
    const loaded = await loadViewContent({
      book,
      section,
      view,
      content,
      token: 'standalone',
      signal,
      themes: undefined,
      interactions: undefined,
    });
    expect(loaded.document.body.textContent).toContain('Original');
    loaded.release();
    loaded.release();
    await book.hooks.whenIdle();
    expect(unloaded).toBe(1);
    book.destroy();
    book.hooks.release({ section, frame: view.frame, document: loaded.document });
    await book.hooks.whenIdle();
    expect(unloaded).toBe(1);
  } finally {
    view.destroy();
    book.destroy();
    container.remove();
  }
});

test('synchronous book destruction cancels pending unload waits without retaining an uncooperative callback', async () => {
  const book = await Book.open(bookZip(bookFiles()));
  const container = host();
  const reader = book.renderTo(container);
  const started = gate();
  const waiting = gate();
  let completed = false;
  book.hooks.unload.register(async (_context, signal) => {
    started.release();
    await waiting.promise;
    signal.throwIfAborted();
    completed = true;
  });
  try {
    await reader.display();
    reader.destroy();
    await started.promise;
    book.destroy();
    await book.hooks.whenIdle();
    expect(completed).toBe(false);
    expect(container.querySelector('iframe')).toBeNull();
  } finally {
    waiting.release();
    book.destroy();
    container.remove();
  }
});
