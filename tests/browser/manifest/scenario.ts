/** Cross-engine JSON URL reading uses the same CFI, passive rendering, and cleanup contracts as EPUB archives. */
import { Book, rangeFromCfi } from '../../../src/index';

/** Validate inline navigation, headless search, native range mapping, printed pages, and final frame release. */
export async function runManifestScenario(continuous: boolean): Promise<{
  metadata: boolean;
  navigation: boolean;
  exact: boolean;
  passive: boolean;
  pages: boolean;
  cleaned: boolean;
}> {
  const book = await Book.open('/json-publication/OPS/manifest.json');
  const host = document.createElement('div');
  host.style.cssText = 'width:400px;height:300px';
  document.body.appendChild(host);
  const reader = continuous ? book.renderContinuous(host) : book.renderTo(host);
  try {
    const match = (await book.section()?.search('Original JSON'))?.[0];
    if (!match) {
      throw new Error('Missing JSON scenario match.');
    }
    await reader.display(match.cfi);
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing JSON scenario document.');
    }
    await book.pageList.generate();
    const result = {
      metadata: book.publication.metadata.title === 'Original JSON',
      navigation:
        book.navigation.get('#entry')?.label === 'Original chapter' &&
        book.spine.adjacent(0, 'next')?.index === 2,
      exact: rangeFromCfi(document, match.cfi).toString() === 'Original JSON',
      passive:
        document.querySelector('script') === null &&
        reader
          .getRenderedPages()
          .every((page) => page.frame.getAttribute('sandbox') === 'allow-same-origin'),
      pages: book.pageList.entries[0]?.cfi?.includes('/6/2[chapter]!') === true,
      cleaned: false,
    };
    await reader.display(2);
    await book.destroyAsync();
    result.cleaned = host.querySelector('iframe') === null;
    return result;
  } finally {
    book.destroy();
    host.remove();
  }
}
