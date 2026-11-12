/** Verify the inline compatibility boundary against real host styles, native documents, and passive script isolation. */
import { Book, IframeView } from '../../../src/index';

/** Legacy inline mode fails explicitly; the supported iframe mode keeps publisher markup out of host DOM. */
export async function runViewModeScenario(): Promise<{
  rejected: boolean;
  untouched: boolean;
  isolated: boolean;
}> {
  const book = await Book.open('/view-mode.epub');
  const host = document.createElement('div');
  const marker = document.createElement('p');
  marker.textContent = 'Original host marker';
  marker.style.color = 'rgb(4, 5, 6)';
  host.style.cssText = 'width:400px;height:300px';
  document.body.append(host, marker);
  let rejected = 0;
  let factories = 0;
  const createView = (container: HTMLElement) => {
    factories += 1;
    return new IframeView(container);
  };
  try {
    for (const factory of [book.renderTo.bind(book), book.renderContinuous.bind(book)]) {
      try {
        Reflect.apply(factory, book, [host, { view: 'inline', createView }]);
      } catch (error) {
        if (error instanceof TypeError) {
          rejected += 1;
        } else {
          throw error;
        }
      }
    }
    const untouched = host.children.length === 0 && factories === 0;
    const reader = book.renderTo(host, { view: 'iframe' });
    await reader.display();
    return {
      rejected: rejected === 2,
      untouched,
      isolated:
        reader.getContents() !== host.ownerDocument &&
        host.querySelector('body') === null &&
        getComputedStyle(marker).color === 'rgb(4, 5, 6)' &&
        reader.frame.getAttribute('sandbox') === 'allow-same-origin',
    };
  } finally {
    book.destroy();
    host.remove();
    marker.remove();
  }
}
