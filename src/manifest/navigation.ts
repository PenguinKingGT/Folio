/** Parse bounded nested JSON tables of contents without loading chapters or creating a browser view. */
import { Navigation } from '../navigation/navigation';
import type { NavigationItem, Landmark } from '../navigation/navigation';
import type { PrintPageLink } from '../pages/types';
import { dictionary, field, href, list, text, tokens } from './values';

/** One recursive budget prevents deeply nested or cyclic host objects from exhausting the stack. */
interface Budget {
  remaining: number;
}

/** Keep grouping headings and support the historical subitems alias alongside children. */
function item(value: unknown, depth: number, budget: Budget): NavigationItem {
  if (depth > 32 || budget.remaining <= 0) {
    throw new RangeError('JSON navigation exceeds supported depth or entry count.');
  }
  budget.remaining -= 1;
  const entry = dictionary(value, 'TOC entry');
  const children = list(field(entry, 'children', 'subitems'), 'TOC children', true).map((child) =>
    item(child, depth + 1, budget),
  );
  const target = entry.href === undefined ? null : href(entry.href, 'TOC href');
  if (target === null && children.length === 0) {
    throw new TypeError('A JSON TOC entry requires an href or children.');
  }
  return {
    id: entry.id === undefined ? null : text(entry.id, 'TOC ID'),
    label: text(field(entry, 'title', 'label'), 'TOC title'),
    href: target,
    children,
  };
}

/** Inline page destinations use the JSON document as their base, matching inline TOC links. */
function page(value: unknown): PrintPageLink {
  const entry = dictionary(value, 'page-list entry');
  return {
    id: entry.id === undefined ? null : text(entry.id, 'page ID'),
    label: text(field(entry, 'title', 'label'), 'page label'),
    href: href(entry.href, 'page href'),
    type: entry.type === undefined ? null : text(entry.type, 'page type'),
  };
}

/** Retain declared semantic destinations alongside the nested table of contents. */
function landmark(value: unknown): Landmark {
  const entry = dictionary(value, 'landmark');
  const types = tokens(field(entry, 'rel', 'types'), 'landmark types');
  if (types.length === 0) {
    throw new TypeError('JSON landmarks require semantic types.');
  }
  return {
    types,
    label: text(field(entry, 'title', 'label'), 'landmark title'),
    href: href(entry.href, 'landmark href'),
  };
}

/** Absent inline navigation lets the existing nav/NCX loader discover a declared resource instead. */
export function manifestNavigation(root: Record<string, unknown>): Navigation | undefined {
  if (root.toc === undefined && root.landmarks === undefined && root.pageList === undefined) {
    return undefined;
  }
  const budget = { remaining: 10_000 };
  return new Navigation(
    list(root.toc, 'toc', true).map((entry) => item(entry, 0, budget)),
    list(root.landmarks, 'landmarks', true).map(landmark),
    list(root.pageList, 'page list', true).map(page),
  );
}
