/** Original mixed-text chapters include passive links and stable CFI targets for interaction tests. */
import { Book } from '../../../src/index';
import type { Rendition, ContinuousReader } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { continuousFiles } from '../continuous/fixture';
import { host } from '../render/fixture';

/** Keep URI origins and text-node boundaries explicit in a locally authored publication. */
export function interactionFiles(): Map<string, string> {
  const files = continuousFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>
    <p id="selection">Alpha 😀 <em>original</em> selected text</p>
    <p><a id="internal" href="../s2.xhtml#start-2"><span>Next chapter</span></a></p>
    <a id="external" href="https://original.invalid/read">Outside</a>
    <a id="mail" href="mailto:reader@example.invalid">Mail</a>
    <a id="resource" href="../images/cover.jpg">Cover resource</a>
    <a id="same" href="#tail">Footnote</a>
    <a id="unsafe" href="javascript:alert(1)">Blocked</a>
    <a id="forged" data-folio-href="https://forged.invalid">Forged</a>
    <p>${'Original text for reading. '.repeat(80)}</p><p id="tail">Final note</p>
  </body></html>`,
  );
  return files;
}

/** Attach either native reader implementation and release all resources deterministically. */
export async function interactionReader(
  continuous = false,
  touch = false,
): Promise<{
  book: Book;
  reader: Rendition | ContinuousReader;
  container: HTMLDivElement;
  release: () => void;
}> {
  const book = await Book.open(bookZip(interactionFiles()));
  const container = host();
  const reader = continuous
    ? book.renderContinuous(container, { touch })
    : book.renderTo(container, { touch });
  await reader.display();
  return {
    book,
    reader,
    container,
    release: () => {
      book.destroy();
      container.remove();
    },
  };
}

/** Select text across an emoji, inline element, and neighboring text node. */
export function selectText(document: Document): Range {
  const paragraph = document.getElementById('selection');
  const start = paragraph?.firstChild;
  const end = paragraph?.lastChild;
  if (!start || !end) {
    throw new Error('Missing original selection nodes.');
  }
  const range = document.createRange();
  range.setStart(start, 6);
  range.setEnd(end, 9);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  return range;
}

/** Dispatch native input from its own realm so cross-frame constructor differences remain meaningful. */
export function click(element: Element, options: MouseEventInit = {}): MouseEvent {
  const realm = element.ownerDocument.defaultView;
  if (!realm) {
    throw new Error('Missing interaction event realm.');
  }
  const event = new realm.MouseEvent('click', { bubbles: true, cancelable: true, ...options });
  element.dispatchEvent(event);
  return event;
}
