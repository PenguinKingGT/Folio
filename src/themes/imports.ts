/** Preserve CSS import media, support, and layer conditions while inlining loaded theme styles. */
import generate from 'css-tree/generator';
import type { CssNode } from 'css-tree';

/** Return the import URI and its ordered qualifiers, rejecting malformed preludes. */
export function importReference(node: CssNode): { href: string; qualifiers: readonly CssNode[] } {
  if (node.type !== 'Atrule' || node.prelude?.type !== 'AtrulePrelude') {
    throw new TypeError('Invalid theme CSS import.');
  }
  const [reference, ...qualifiers] = Array.from(node.prelude.children);
  if (reference?.type !== 'String' && reference?.type !== 'Url') {
    throw new TypeError('Theme CSS imports require a URL.');
  }
  return { href: reference.value, qualifiers };
}

/** Nest imported rules in the same condition order as a native CSS import. */
export function importConditions(css: string, qualifiers: readonly CssNode[]): string {
  return qualifiers.reduceRight((content, node) => {
    if (node.type === 'MediaQueryList') {
      return `@media ${generate(node)}{${content}}`;
    }
    if (node.type === 'Identifier' && node.name.toLowerCase() === 'layer') {
      return `@layer{${content}}`;
    }
    if (node.type === 'Function' && node.name.toLowerCase() === 'layer') {
      return `@layer ${Array.from(node.children)
        .map((child) => generate(child))
        .join('')}{${content}}`;
    }
    if (node.type === 'Function' && node.name.toLowerCase() === 'supports') {
      const condition = Array.from(node.children)
        .map((child) => generate(child))
        .join('');
      return `@supports (${condition}){${content}}`;
    }
    throw new TypeError('Unsupported theme CSS import condition.');
  }, css);
}
