/** Cross-engine host extensions decorate passive views and drain asynchronous unload work before book cleanup. */
import { Book, IframeView, Rendition, ContinuousReader } from '../../../src/index';
import type { ViewOptions } from '../../../src/index';

/** Use the supported subclass seam while retaining every built-in sandbox and document-load invariant. */
function customView(target: HTMLElement, options: ViewOptions): IframeView {
  const view = new IframeView(target, options);
  view.frame.title = 'Original extension view';
  return view;
}

/** Register trusted headless, serialization, native style, and asynchronous unload extensions. */
function extend(book: Book, count: { rendered: number; unloaded: number }): void {
  book.hooks.content.register(async ({ document }) => {
    await Promise.resolve();
    document.documentElement?.setAttribute('data-original-extension', 'headless');
  });
  book.hooks.serialize.register(async (context) => {
    await Promise.resolve();
    context.source = context.source.replace(
      'data-original-extension="headless"',
      'data-original-extension="serialized"',
    );
  });
  book.hooks.render.register(async ({ document }) => {
    await Promise.resolve();
    count.rendered += 1;
    const style = document.createElement('style');
    style.textContent = 'p{color:rgb(1,2,3)}';
    document.head.appendChild(style);
  });
  book.hooks.unload.register(async () => {
    await Promise.resolve();
    count.unloaded += 1;
  });
}

/** Exercise factories and hook ordering through actual navigation, styles, and native frame destruction. */
export async function runExtensionScenario(continuous: boolean): Promise<{
  decorated: boolean;
  custom: boolean;
  cleaned: boolean;
  drained: boolean;
}> {
  const book = await Book.open('/extensions.epub');
  const host = document.createElement('div');
  host.style.cssText = 'width:400px;height:300px';
  document.body.appendChild(host);
  const count = { rendered: 0, unloaded: 0 };
  extend(book, count);
  const reader = book.renderWith(
    (publication, target, options) =>
      continuous
        ? new ContinuousReader(publication, target, options)
        : new Rendition(publication, target, options),
    host,
    { createView: customView },
  );
  try {
    await reader.display();
    const document = reader.getContents();
    const paragraph = document?.querySelector('p');
    const decorated =
      document?.documentElement.getAttribute('data-original-extension') === 'serialized' &&
      paragraph !== undefined &&
      paragraph !== null &&
      document.defaultView?.getComputedStyle(paragraph).color === 'rgb(1, 2, 3)';
    const custom = reader
      .getRenderedPages()
      .every(
        (page) =>
          page.frame.title === 'Original extension view' &&
          page.frame.getAttribute('sandbox') === 'allow-same-origin',
      );
    await reader.display(4);
    await book.destroyAsync();
    return {
      decorated,
      custom,
      cleaned: host.querySelector('iframe') === null,
      drained: count.rendered > 1 && count.unloaded === count.rendered,
    };
  } finally {
    book.destroy();
    host.remove();
  }
}
