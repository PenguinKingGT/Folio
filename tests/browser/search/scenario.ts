/** Exercise headless search results against native passive rendering in every supported browser engine. */
import { Book, rangeFromCfi } from '../../../src/index';

/** Resolve multilingual matches, navigate a result, and paint its annotation without modifying chapter text. */
export async function runSearchScenario(): Promise<{
  exact: boolean;
  painted: boolean;
  stable: boolean;
  packageStep: boolean;
}> {
  const book = await Book.open('/search.epub');
  const host = document.createElement('div');
  host.style.cssText = 'width:400px;height:300px';
  document.body.appendChild(host);
  const reader = book.renderTo(host);
  try {
    await reader.display();
    const document = reader.getContents();
    const section = book.section();
    if (!document || !section) {
      throw new Error('Missing search chapter.');
    }
    const before = document.body.innerHTML;
    let exact = true;
    let packageStep = true;
    for (const query of ['original text', 'one two three', 'abcdef', 'σ', '𐐨', 'ß', '.*']) {
      const results = await section.search(query);
      exact &&= results.length > 0;
      for (const result of results) {
        exact &&=
          rangeFromCfi(document, result.cfi).toString().replace(/\s+/gu, ' ') === result.match;
        packageStep &&= result.cfi.startsWith('epubcfi(/8/2[chapter]!');
      }
    }
    const result = (await section.search('original text'))[0];
    if (!result) {
      throw new Error('Missing navigable result.');
    }
    await reader.display(result.cfi);
    reader.annotations.highlight(result.cfi);
    return {
      exact,
      packageStep,
      painted: reader.annotations.element.querySelector('rect') !== null,
      stable: document.body.innerHTML === before,
    };
  } finally {
    book.destroy();
    host.remove();
  }
}
