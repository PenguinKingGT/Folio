/** Actual passive views await render extensions and retain detached contexts until asynchronous unload completes. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { interactionFiles } from '../interaction/fixture';
import { host } from '../render/fixture';
import { gate } from '../../unit/extensions/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} native render hooks apply styles before successful display`, async () => {
    const book = await Book.open(bookZip(interactionFiles()));
    const container = host();
    const reader = continuous ? book.renderContinuous(container) : book.renderTo(container);
    const started = gate();
    const waiting = gate();
    const rendered: number[] = [];
    const unloaded: number[] = [];
    book.hooks.render.register(async ({ document, section }) => {
      if (section.index === 0) {
        started.release();
        await waiting.promise;
      }
      rendered.push(section.index);
      const style = document.createElement('style');
      style.textContent = 'p{color:rgb(1,2,3)}';
      document.head.appendChild(style);
    });
    book.hooks.unload.register(async ({ section }) => {
      await Promise.resolve();
      unloaded.push(section.index);
    });
    try {
      const display = reader.display();
      await started.promise;
      expect(reader.getContents()).toBeNull();
      waiting.release();
      await display;
      const document = reader.getContents();
      const paragraph = document?.querySelector('p');
      expect(document?.defaultView?.getComputedStyle(paragraph ?? document.body).color).toBe(
        'rgb(1, 2, 3)',
      );
      expect(
        reader
          .getRenderedPages()
          .every((page) => page.frame.getAttribute('sandbox') === 'allow-same-origin'),
      ).toBe(true);
      reader.destroy();
      await book.hooks.whenIdle();
      expect(unloaded).toEqual(rendered);
      await book.destroyAsync();
    } finally {
      waiting.release();
      book.destroy();
      container.remove();
    }
  });
}

test('destroyAsync drains unload hooks before shared resources close and rejects new reader ownership', async () => {
  const book = await Book.open(bookZip(interactionFiles()));
  const container = host();
  const reader = book.renderTo(container);
  const started = gate();
  const waiting = gate();
  let unloads = 0;
  book.hooks.unload.register(async ({ document }, signal) => {
    started.release();
    await waiting.promise;
    signal.throwIfAborted();
    expect(document.body.textContent).toContain('original');
    expect(await book.text('text/chapter%20one.xhtml')).toContain('original');
    unloads += 1;
  });
  try {
    await reader.display();
    const closing = book.destroyAsync();
    expect(book.destroyAsync()).toBe(closing);
    await started.promise;
    expect(container.querySelector('iframe')).toBeNull();
    expect(() => book.renderTo(container)).toThrow('closing');
    waiting.release();
    await closing;
    expect(unloads).toBe(1);
    expect(() => book.hooks.render.register(() => {})).toThrow();
    await book.destroyAsync();
  } finally {
    waiting.release();
    book.destroy();
    container.remove();
  }
});

test('render failures release the failed native context and unload failures remain observable without blocking cleanup', async () => {
  const book = await Book.open(bookZip(interactionFiles()));
  const container = host();
  const reader = book.renderTo(container);
  const failure = new Error('native extension');
  let unloads = 0;
  const remove = book.hooks.render.register(() => {
    throw failure;
  });
  book.hooks.unload.register(() => {
    unloads += 1;
    throw new Error('unload extension');
  });
  try {
    await expect(reader.display()).rejects.toBe(failure);
    await expect(book.hooks.whenIdle()).rejects.toThrow(AggregateError);
    await book.hooks.whenIdle();
    remove();
    await reader.display();
    await expect(book.destroyAsync()).rejects.toThrow(AggregateError);
    expect(unloads).toBe(2);
    expect(container.querySelector('iframe')).toBeNull();
    expect(() => book.hooks.content.register(() => {})).toThrow();
  } finally {
    book.destroy();
    container.remove();
  }
});
