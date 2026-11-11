/** Convert element-based DOM Range boundaries to equivalent character-data positions. */
import { isElement, isText } from './children';

/** A native DOM position accepted by Range.setStart / Range.setEnd. */
export interface DomPoint {
  node: Node;
  offset: number;
}

/** Find the first or last text descendant, including a text root itself. */
function descendantText(node: Node, last: boolean): Node | null {
  if (isText(node)) {
    return node;
  }
  const walker = node.ownerDocument?.createTreeWalker(node, 0x4 | 0x8);
  if (walker === undefined) {
    return null;
  }
  let result = walker.nextNode();
  if (last) {
    for (let next = walker.nextNode(); next !== null; next = walker.nextNode()) {
      result = next;
    }
  }
  return result;
}

/** Select a neighboring text position without inventing element-child character offsets. */
export function normalizeBoundary(node: Node, offset: number, end: boolean): DomPoint {
  if (isText(node)) {
    return { node, offset };
  }
  if (!isElement(node)) {
    throw new TypeError('Unsupported DOM Range boundary node.');
  }
  const children = Array.from(node.childNodes);
  const directions = end ? [true, false] : [false, true];
  for (const backwards of directions) {
    // oxlint-disable-next-line unicorn/no-array-reverse -- Reverse a fresh slice for ES2022 compatibility.
    const candidates = backwards ? children.slice(0, offset).reverse() : children.slice(offset);
    for (const child of candidates) {
      const text = descendantText(child, backwards);
      if (text !== null) {
        return { node: text, offset: backwards ? (text.nodeValue || '').length : 0 };
      }
    }
  }
  return { node, offset: 0 };
}
