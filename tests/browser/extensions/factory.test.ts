/** Host factories customize real passive iframe views and managers while preserving book-owned cleanup. */
import { expect, test } from 'vitest';
import { Book, IframeView, Rendition } from '../../../src/index';
import { createView } from '../../../src/render/view-factory';
import type { ViewOptions } from '../../../src/index';
import { bookZip, bookFiles } from '../../unit/book/fixture';
import { continuousFiles } from '../continuous/fixture';
import { host } from '../render/fixture';
import { fixedFiles } from '../../unit/layout/fixed-fixture';

/** Customization stays in a host subclass; publication content never receives a factory or executable option. */
class CaptionView extends IframeView {
  /** Set host accessibility metadata without changing the passive sandbox contract. */
  constructor(container: HTMLElement, options: ViewOptions) {
    super(container, options);
    this.frame.setAttribute('title', 'Original custom chapter');
    this.frame.setAttribute('data-custom-view', 'original');
  }
}

test('a custom manager factory receives typed options and owns customized native views', async () => {
  const book = await Book.open(bookZip(bookFiles()));
  const container = host();
  const options: ViewOptions = {
    createView: (target, settings) => new CaptionView(target, settings),
  };
  const created: unknown[] = [];
  book.on('readerCreated', (reader) => created.push(reader));
  const reader = book.renderWith(
    (publication, target, settings) => new Rendition(publication, target, settings),
    container,
    options,
  );
  try {
    expect(created).toEqual([reader]);
    await reader.display();
    expect(reader.frame.title).toBe('Original custom chapter');
    expect(reader.frame.getAttribute('sandbox')).toBe('allow-same-origin');
    expect(reader.getContents()?.body.textContent).toContain('Original');
    await book.destroyAsync();
    expect(container.querySelector('iframe')).toBeNull();
  } finally {
    book.destroy();
    container.remove();
  }
});

test('continuous readers use customized views for every preload and remove their owned cells on factory failure', async () => {
  const book = await Book.open(bookZip(continuousFiles()));
  const container = host();
  const reader = book.renderContinuous(container, {
    createView: (target, options) => new CaptionView(target, options),
  });
  try {
    await reader.display();
    expect(
      reader.getLoadedPages().every((page) => page.frame.hasAttribute('data-custom-view')),
    ).toBe(true);
    reader.destroy();
    const failed = book.renderContinuous(container, {
      createView: () => {
        throw new Error('factory failure');
      },
    });
    await expect(failed.display()).rejects.toThrow('factory failure');
    expect(failed.viewport.querySelector('[data-folio-section]')).toBeNull();
    failed.destroy();
  } finally {
    book.destroy();
    container.remove();
  }
});

test('rejects invalid factories and releases customized frames with foreign ownership or active sandbox flags', () => {
  const container = host();
  const other = host();
  try {
    for (const factory of [
      null,
      () => null,
      () => new IframeView(other),
      (target: HTMLElement) => {
        const view = new IframeView(target);
        view.frame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
        return view;
      },
    ]) {
      expect(() => {
        Reflect.apply(createView, null, [container, { createView: factory }]);
      }).toThrow();
    }
    expect(container.querySelector('iframe')).toBeNull();
    expect(other.querySelector('iframe')).toBeNull();
  } finally {
    container.remove();
    other.remove();
  }
});

test('fixed companions use the same view factory and render/unload hooks as primary pages', async () => {
  const book = await Book.open(bookZip(fixedFiles()));
  const container = host();
  const rendered: number[] = [];
  const unloaded: number[] = [];
  book.hooks.render.register(({ section }) => {
    rendered.push(section.index);
  });
  book.hooks.unload.register(({ section }) => {
    unloaded.push(section.index);
  });
  const reader = book.renderTo(container, {
    spread: 'always',
    createView: (target, options) => new CaptionView(target, options),
  });
  try {
    await reader.display(1);
    expect(reader.getRenderedPages()).toHaveLength(2);
    expect(
      reader.getRenderedPages().every((page) => page.frame.hasAttribute('data-custom-view')),
    ).toBe(true);
    await book.destroyAsync();
    expect(unloaded.length).toBe(rendered.length);
    expect(new Set(unloaded)).toEqual(new Set(rendered));
  } finally {
    book.destroy();
    container.remove();
  }
});

test('manager factories wrapping an already owned reader do not duplicate its creation notification', async () => {
  const book = await Book.open(bookZip(bookFiles()));
  const container = host();
  let created = 0;
  book.on('readerCreated', () => {
    created += 1;
  });
  try {
    const reader = book.renderWith(
      (publication, target, options) => publication.renderTo(target, options),
      container,
      {},
    );
    await reader.display();
    expect(created).toBe(1);
    await book.destroyAsync();
  } finally {
    book.destroy();
    container.remove();
  }
});
