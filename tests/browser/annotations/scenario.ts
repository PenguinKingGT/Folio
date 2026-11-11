/** Annotation persistence and host input remain observable without executing any code inside publication frames. */
import { Book, rangeFromCfi } from '../../../src/index';
import type { Rendition, ContinuousReader } from '../../../src/index';
import { selectText } from '../interaction/fixture';
import { annotationGroup } from './fixture';

/** Validate reload restoration across both renderer implementations. */
export async function runAnnotationScenario(
  continuous: boolean,
): Promise<{ restored: boolean; stable: boolean; clipped: boolean }> {
  const container = document.createElement('div');
  container.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(container);
  const book = await Book.open('/annotations.epub');
  const reader = continuous ? book.renderContinuous(container) : book.renderTo(container);
  try {
    await reader.display();
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing annotated document.');
    }
    selectText(document);
    const selection = reader.interactions.captureSelection();
    if (!selection) {
      throw new Error('Missing annotation CFI.');
    }
    document.getSelection()?.removeAllRanges();
    reader.annotations.highlight(selection.cfi, { id: 'persistent' });
    const stable = rangeFromCfi(document, selection.cfi).toString() === selection.text;
    await reader.display(4);
    const clipped = annotationGroup(reader, 'persistent') === null;
    await reader.display(0);
    await reader.annotations.whenIdle();
    return {
      stable,
      clipped,
      restored:
        annotationGroup(reader, 'persistent') !== null && reader.annotations.all().length === 1,
    };
  } finally {
    book.destroy();
    container.remove();
  }
}

let mounted: {
  book: Book;
  reader: Rendition | ContinuousReader;
  container: HTMLDivElement;
  clicks: unknown[];
} | null = null;

/** Mount a visible interactive host badge for real browser mouse and keyboard tests. */
export async function mountAnnotationClick(): Promise<void> {
  const container = document.createElement('div');
  container.id = 'annotation-click-host';
  container.style.cssText = 'position:fixed;left:0;top:0;z-index:100;width:320px;height:240px';
  document.body.appendChild(container);
  const book = await Book.open('/annotations.epub');
  const reader = book.renderTo(container);
  const clicks: unknown[] = [];
  mounted = { book, reader, container, clicks };
  await reader.display();
  const content = reader.getContents();
  if (!content) {
    throw new Error('Missing clickable annotation document.');
  }
  selectText(content);
  const selection = reader.interactions.captureSelection();
  if (!selection) {
    throw new Error('Missing clickable CFI.');
  }
  content.getSelection()?.removeAllRanges();
  reader.annotations.onClick((event) => clicks.push(event.annotation.data));
  reader.annotations.mark(selection.cfi, { id: 'note', label: 'Open note', data: 'payload' });
}

/** Return only caller metadata rather than serializing native events across browser realms. */
export function annotationClicks(): readonly unknown[] {
  return mounted?.clicks ?? [];
}

/** Release every observer, native view, and overlay after input assertions. */
export function disposeAnnotationClick(): void {
  mounted?.book.destroy();
  mounted?.container.remove();
  mounted = null;
}
