/** Native documents and ranges built from original markup under the project license. */

export const options = { base: '/6/2[chapter]' };

/** Create an independent browser document so fixtures never leak into the runner page. */
export function fixture(markup = '<p id="para">A😀BC</p>'): Document {
  const result = document.implementation.createHTMLDocument('Original');
  result.body.innerHTML = markup;
  return result;
}

/** Require a fixture element without unchecked DOM casts. */
export function element(document: Document, selector: string): Element {
  const result = document.querySelector(selector);
  if (result === null) {
    throw new Error(`Missing fixture element: ${selector}`);
  }
  return result;
}

/** Select a specific native child node and fail clearly for malformed fixtures. */
export function child(parent: Node, index = 0): Node {
  const result = parent.childNodes.item(index);
  if (result === null) {
    throw new Error('Missing fixture child.');
  }
  return result;
}

/** Create a deterministic range with native boundary validation. */
export function range(
  document: Document,
  start: Node,
  offset: number,
  end = start,
  endOffset = offset,
): Range {
  const result = document.createRange();
  result.setStart(start, offset);
  result.setEnd(end, endOffset);
  return result;
}
