/** Original native annotation fixtures reuse mixed inline text and explicit reader ownership. */
import { interactionReader, selectText } from '../interaction/fixture';
import type { Book, Rendition, ContinuousReader } from '../../../src/index';

/** Both native view implementations expose the same annotation contract. */
export type AnnotationReader = Rendition | ContinuousReader;

/** Capture one valid cross-node range and release native selection before testing overlay input. */
export async function annotationReader(continuous = false): Promise<{
  reader: AnnotationReader;
  book: Book;
  container: HTMLDivElement;
  document: Document;
  range: Range;
  cfi: string;
  release: () => void;
}> {
  const mounted = await interactionReader(continuous);
  const document = mounted.reader.getContents();
  if (!document) {
    throw new Error('Missing annotation document.');
  }
  const range = selectText(document);
  const cfi = mounted.reader.interactions.captureSelection()?.cfi;
  if (!cfi) {
    throw new Error('Missing annotation selection CFI.');
  }
  document.getSelection()?.removeAllRanges();
  return { ...mounted, document, range, cfi };
}

/** Locate only owned native SVG groups without asserting an arbitrary selector's runtime type. */
export function annotationGroup(reader: AnnotationReader, id: string): SVGGElement | null {
  return (
    Array.from(reader.annotations.element.querySelectorAll('g')).find(
      (group) => group.getAttribute('data-folio-annotation') === id,
    ) ?? null
  );
}
