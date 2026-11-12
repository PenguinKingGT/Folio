/** Rejected legacy modes allocate no publisher content and cannot bypass iframe isolation through custom view factories. */
import { expect, test } from 'vitest';
import { Book, IframeView } from '../../../src/index';
import { bookFiles, bookZip } from '../../unit/book/fixture';
import { host } from './fixture';

test('both built-in readers reject inline selectors before reading chapters or invoking view factories', async () => {
  const book = await Book.open(bookZip(bookFiles()));
  const container = host();
  let loaded = 0;
  let created = 0;
  book.on('resourceLoaded', () => {
    loaded += 1;
  });
  const factory = (target: HTMLElement) => {
    created += 1;
    return new IframeView(target);
  };
  try {
    for (const method of [book.renderTo.bind(book), book.renderContinuous.bind(book)]) {
      expect(() => {
        Reflect.apply(method, book, [container, { view: 'inline', createView: factory }]);
      }).toThrow('view="iframe"');
      expect(container.children).toHaveLength(0);
    }
    expect(loaded).toBe(0);
    expect(created).toBe(0);
    expect(() => {
      Reflect.construct(IframeView, [container, { view: 'inline' }]);
    }).toThrow('view="iframe"');
    expect(container.children).toHaveLength(0);
    const valid = book.renderTo(container, { view: 'iframe' });
    await valid.display();
    expect(valid.getContents()?.body.textContent).toContain('Original');
    expect(valid.frame.getAttribute('sandbox')).toBe('allow-same-origin');
  } finally {
    book.destroy();
    container.remove();
  }
});
