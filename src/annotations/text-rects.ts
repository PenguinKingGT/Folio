/** Read selected text fragments without the block-element rectangles returned by aggregate Range geometry. */

/** Bound traversal and output before projecting native fragments into the annotation overlay. */
export function selectedTextRects(range: Range): readonly DOMRect[] {
  const root = range.commonAncestorContainer;
  const document = root.ownerDocument;
  if (document === null) {
    throw new TypeError('Annotation geometry requires a document-owned target.');
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null = root.nodeType === Node.TEXT_NODE ? root : walker.nextNode();
  const rects: DOMRect[] = [];
  let visited = 0;
  while (node !== null) {
    if (++visited > 20_000) {
      throw new RangeError('Too many annotation text nodes.');
    }
    if (range.intersectsNode(node)) {
      const selected = document.createRange();
      selected.selectNodeContents(node);
      if (node === range.startContainer) {
        selected.setStart(node, range.startOffset);
      }
      if (node === range.endContainer) {
        selected.setEnd(node, range.endOffset);
      }
      const fragments = selected.getClientRects();
      if (rects.length + fragments.length > 20_000) {
        throw new RangeError('Too many native annotation fragments.');
      }
      rects.push(...fragments);
    }
    node = walker.nextNode();
  }
  return rects;
}
