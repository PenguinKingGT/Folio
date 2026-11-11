/** Touch fixtures use real native documents and dispatch the same pointer contracts as browser contact input. */
import { Book } from '../../../src/index';
import type { RenditionOptions, Rendition } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { host } from '../render/fixture';
import { writingFiles } from '../render/writing-fixture';

/** Register a complete publication, mounted paginated reader, and explicit cleanup. */
export async function touchReader(
  options: RenditionOptions = { touch: true },
  files = writingFiles('horizontal-tb', 'ltr'),
): Promise<{ book: Book; container: HTMLDivElement; reader: Rendition; release: () => void }> {
  const book = await Book.open(bookZip(files));
  const container = host();
  const reader = book.renderTo(container, { spread: 'none', ...options });
  await reader.display();
  return {
    book,
    container,
    reader,
    release: () => {
      book.destroy();
      container.remove();
    },
  };
}

/** Construct native events in their target realm, including script-disabled chapter documents. */
export function pointer(target: Element, type: string, init: PointerEventInit = {}): PointerEvent {
  const realm = target.ownerDocument.defaultView;
  if (realm === null) {
    throw new Error('Missing pointer event realm.');
  }
  const event = new realm.PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerType: 'touch',
    pointerId: 1,
    isPrimary: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/** Exercise a physical swipe while returning whether the recognizer cancelled native scrolling. */
export function swipe(target: Element, x = -100, y = 0): boolean {
  pointer(target, 'pointerdown');
  const move = pointer(target, 'pointermove', { clientX: x, clientY: y });
  pointer(target, 'pointerup', { clientX: x, clientY: y });
  return move.defaultPrevented;
}
