/** Virtual CFI children merge adjacent text and flatten ignored annotation wrappers. */
import { escapeCfi } from '../syntax';
import type { CfiStep } from '../types';

/** One logical step may represent several adjacent text nodes. */
export interface LogicalChild {
  step: CfiStep;
  nodes: Node[];
}

/** Identify elements by node type rather than realm-sensitive instanceof checks. */
export function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

/** CDATA and text share CFI character-data indexing. */
export function isText(node: Node): boolean {
  return node.nodeType === 3 || node.nodeType === 4;
}

/** Annotation wrappers are transparent when the caller explicitly supplies their class. */
export function ignored(node: Node, ignoreClass?: string): boolean {
  return isElement(node) && ignoreClass !== undefined && node.classList.contains(ignoreClass);
}

/** Flatten transparent wrappers without losing meaningful child elements or text order. */
function flattened(parent: Node, ignoreClass: string | undefined, depth = 0): Node[] {
  if (depth > 128) {
    throw new RangeError('Ignored wrapper nesting exceeds the supported limit.');
  }
  const result: Node[] = [];
  for (const child of Array.from(parent.childNodes)) {
    if (ignored(child, ignoreClass)) {
      result.push(...flattened(child, ignoreClass, depth + 1));
    } else if (isElement(child) || isText(child)) {
      result.push(child);
    }
  }
  return result;
}

/** Assign even element steps and odd text slots according to element sibling positions. */
export function logicalChildren(parent: Node, ignoreClass?: string): LogicalChild[] {
  const result: LogicalChild[] = [];
  let elements = 0;
  for (const node of flattened(parent, ignoreClass)) {
    if (isElement(node)) {
      elements += 1;
      const id = node.getAttribute('id');
      result.push({
        step: { value: elements * 2, assertion: id === null || id === '' ? null : escapeCfi(id) },
        nodes: [node],
      });
    } else {
      const value = elements * 2 + 1;
      const previous = result[result.length - 1];
      if (previous?.step.value === value) {
        previous.nodes.push(node);
      } else {
        result.push({ step: { value, assertion: null }, nodes: [node] });
      }
    }
  }
  return result;
}

/** Locate the parent in the virtual tree, skipping transparent wrappers. */
export function virtualParent(node: Node, ignoreClass?: string): Node | null {
  let parent = node.parentNode;
  while (parent !== null && ignored(parent, ignoreClass)) {
    parent = parent.parentNode;
  }
  return parent;
}
