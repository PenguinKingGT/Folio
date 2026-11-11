/** Cross-engine native interaction scenarios verify manual capture/activation under unchanged passive isolation. */
import { Book, rangeFromCfi } from '../../../src/index';
import { selectText } from './fixture';

/** Capture a native cross-node selection and activate an explicit chapter-relative URI. */
export async function runInteractionScenario(
  continuous: boolean,
): Promise<{ text: string; restored: string; chapter: number | undefined; passive: boolean }> {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(host);
  const book = await Book.open('/interactions.epub');
  const reader = continuous ? book.renderContinuous(host) : book.renderTo(host);
  try {
    await reader.display();
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing native interaction document.');
    }
    selectText(document);
    const selection = reader.interactions.captureSelection();
    if (!selection) {
      throw new Error('Missing native selection.');
    }
    const restored = rangeFromCfi(document, selection.cfi).toString();
    const passive = reader
      .getRenderedPages()
      .every((page) => !page.frame.sandbox.contains('allow-scripts'));
    await reader.interactions.activate('../s2.xhtml#start-2');
    await reader.interactions.whenIdle();
    return { text: selection.text, restored, chapter: reader.currentSection?.index, passive };
  } finally {
    book.destroy();
    host.remove();
  }
}
