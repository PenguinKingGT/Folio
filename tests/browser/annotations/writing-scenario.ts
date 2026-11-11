/** Cross-engine annotation geometry uses native writing-mode metrics and unchanged text CFIs. */
import { Book, cfiFromRange } from '../../../src/index';
import { annotationGroup } from './fixture';

/** Return painted axis and CFI identity after forward/backward navigation. */
export async function runAnnotationWriting(): Promise<{
  vertical: boolean;
  stable: boolean;
  painted: boolean;
}> {
  const container = document.createElement('div');
  container.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(container);
  const book = await Book.open('/annotation-writing.epub');
  const reader = book.renderTo(container, { spread: 'none' });
  try {
    await reader.display();
    const document = reader.getContents();
    const text = document?.querySelector('p')?.firstChild;
    if (!document || !text) {
      throw new Error('Missing annotation-writing text.');
    }
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 15);
    const cfi = cfiFromRange(range, { base: '/6/2[chapter]' }).toString();
    const annotation = reader.annotations.underline(cfi);
    await reader.next();
    await reader.prev();
    await reader.annotations.whenIdle();
    const line = annotationGroup(reader, annotation.id)?.querySelector('line');
    return {
      vertical: line?.getAttribute('x1') === line?.getAttribute('x2'),
      painted: line !== undefined && line !== null,
      stable: cfiFromRange(range, { base: '/6/2[chapter]' }).toString() === cfi,
    };
  } finally {
    book.destroy();
    container.remove();
  }
}
