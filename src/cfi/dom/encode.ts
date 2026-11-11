/** Convert real DOM nodes to CFI paths through the virtual annotation-free tree. */
import { isElement, isText, logicalChildren, virtualParent } from './children';
import type { CfiPath, CfiStep } from '../types';

/** Encode a node and optional text offset relative to its document element. */
export function encodeNode(target: Node, offset = 0, ignoreClass?: string): CfiPath {
  const root = target.ownerDocument?.documentElement;
  if (
    root === undefined ||
    root === null ||
    target === root ||
    (!isText(target) && !isElement(target))
  ) {
    throw new TypeError('CFIs require a non-root element or text node.');
  }
  const steps: CfiStep[] = [];
  let node = target;
  let textOffset = offset;
  while (node !== root) {
    const parent = virtualParent(node, ignoreClass);
    if (parent === null) {
      throw new TypeError('CFI target is detached from the document.');
    }
    const child = logicalChildren(parent, ignoreClass).find((entry) => entry.nodes.includes(node));
    if (child === undefined) {
      throw new TypeError('CFI target is not visible in the logical document tree.');
    }
    if (node === target && isText(target)) {
      for (const sibling of child.nodes) {
        if (sibling === target) {
          break;
        }
        textOffset += (sibling.nodeValue || '').length;
      }
    }
    steps.unshift(child.step);
    node = parent;
  }
  return { steps, offset: isText(target) ? textOffset : null, assertion: null };
}
