/** Resolve fixed-layout metadata and stable synthetic-spread partners in spine order. */
import type { PublicationPackage } from '../package/types';
import type { Section } from '../spine/section';

/** Physical page placement; centered pages always occupy their own spread. */
export type PageSide = 'left' | 'right' | 'center';

/** Resolve an item-level rendition override before the package default. */
export function renditionValue(
  publication: PublicationPackage,
  section: Section,
  key: string,
  fallback: string,
): string {
  const prefix = `rendition:${key}-`;
  const override = section.properties.find((property) => property.startsWith(prefix));
  return override?.slice(prefix.length) ?? publication.rendition[key] ?? fallback;
}

/** Fixed documents retain their authored viewport instead of entering column pagination. */
export function isFixed(publication: PublicationPackage, section: Section): boolean {
  return renditionValue(publication, section, 'layout', 'reflowable') === 'pre-paginated';
}

/** Assign default sides while honoring explicit left/right/center overrides. */
export function pageSides(
  publication: PublicationPackage,
  sections: readonly Section[],
): ReadonlyMap<number, PageSide> {
  const result = new Map<number, PageSide>();
  let next: PageSide = publication.direction === 'rtl' ? 'left' : 'right';
  for (const section of sections) {
    const explicit = section.properties.find((property) =>
      /^(rendition:)?page-spread-(left|right|center)$/.test(property),
    );
    let side: PageSide = next;
    if (explicit !== undefined) {
      side = explicit.endsWith('left') ? 'left' : 'right';
      if (explicit.endsWith('center')) {
        side = 'center';
      }
    }
    result.set(section.index, side);
    if (section.linear) {
      next = side === 'left' ? 'right' : 'left';
      if (side === 'center') {
        next = publication.direction === 'rtl' ? 'left' : 'right';
      }
    }
  }
  return result;
}

/** Pair only adjacent linear fixed pages that fit opposing slots in reading order. */
export function spreadPartner(
  publication: PublicationPackage,
  sections: readonly Section[],
  current: Section,
): Section | null {
  if (!current.linear || !isFixed(publication, current)) {
    return null;
  }
  const sides = pageSides(publication, sections);
  const side = sides.get(current.index);
  if (side === 'center') {
    return null;
  }
  const firstSide = publication.direction === 'rtl' ? 'right' : 'left';
  const delta = side === firstSide ? 1 : -1;
  const partner = sections.find((section) => section.index === current.index + delta);
  if (
    partner === undefined ||
    !partner.linear ||
    !isFixed(publication, partner) ||
    sides.get(partner.index) !== (side === 'left' ? 'right' : 'left')
  ) {
    return null;
  }
  return partner;
}
