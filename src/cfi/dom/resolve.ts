/** Resolve CFI paths to native positions, with ID recovery and logical text offsets. */
import { assertionId } from '../syntax';
import type { CfiPath } from '../types';
import { afterBias, assertedOffset } from './assertion';
import { ignored, logicalChildren } from './children';
import type { LogicalChild } from './children';
import type { DomPoint } from './boundary';

/** Convert a logical character offset to a concrete adjacent text-node position. */
function textPoint(nodes: readonly Node[], path: CfiPath): DomPoint {
  const text = nodes.map((node) => node.nodeValue || '').join('');
  let offset = assertedOffset(text, path.offset ?? 0, path.assertion);
  if (offset > text.length) {
    throw new RangeError('CFI text offset exceeds the available UTF-16 length.');
  }
  for (const [index, node] of nodes.entries()) {
    const length = (node.nodeValue || '').length;
    if (
      offset < length ||
      (offset === length && (!afterBias(path.assertion) || index === nodes.length - 1))
    ) {
      return { node, offset };
    }
    offset -= length;
  }
  throw new TypeError('CFI text slot is empty.');
}

/** Follow a local document path; asserted IDs can repair moved element indices. */
export function resolvePoint(document: Document, path: CfiPath, ignoreClass?: string): DomPoint {
  let node: Node | null = document.documentElement;
  if (node === null) {
    throw new TypeError('CFI resolution requires a document element.');
  }
  for (const step of path.steps) {
    const child: LogicalChild | undefined = logicalChildren(node, ignoreClass).find(
      (entry) => entry.step.value === step.value,
    );
    const id = assertionId(step.assertion);
    if (step.value % 2 === 0 && id !== null) {
      const asserted = document.getElementById(id);
      if (asserted === null || ignored(asserted, ignoreClass)) {
        throw new TypeError(`CFI element ID assertion is unresolved: ${id}`);
      }
      node = asserted;
    } else if (child === undefined) {
      throw new RangeError(`CFI step is outside the document: ${step.value}`);
    } else if (step.value % 2 === 1) {
      return textPoint(child.nodes, path);
    } else {
      node = child.nodes[0] ?? null;
      if (node === null) {
        throw new TypeError('CFI element step has no node.');
      }
    }
  }
  if (path.offset !== null) {
    throw new TypeError('Character offsets require a text step.');
  }
  return { node, offset: 0 };
}
