/** Immutable reading order with indexed, ID, and encoded-href chapter lookup. */
import type { PublicationPackage } from '../package/types';
import { Cfi } from '../cfi/cfi';
import { Section } from './section';
import type { SectionLoader } from './section';

/** Normalize URL fragments and Unicode encoding for chapter lookup. */
function hrefKey(value: string): string {
  return decodeURI(value.split('#', 1)[0] ?? '');
}

/** Manage chapter identities and navigation separately from rendering. */
export class Spine {
  private readonly sections: Section[];
  private destroyed = false;

  /** Create sections in OPF order; loading remains lazy. */
  constructor(publication: PublicationPackage, loader: SectionLoader) {
    this.sections = publication.spine.map((item) => {
      const resource = publication.manifest.get(item.idref);
      if (resource === undefined) {
        throw new TypeError(`Spine references missing resource: ${item.idref}`);
      }
      return new Section(item, resource, loader);
    });
  }

  /** Return a copy of the ordered section collection, including non-linear entries. */
  all(): readonly Section[] {
    this.assertActive();
    return this.sections.slice();
  }

  /** Get the first linear section, index, CFI, #idref, or OPF-relative href. */
  get(target?: number | string): Section | null {
    this.assertActive();
    if (target === undefined) {
      return this.sections.find((section) => section.linear) ?? null;
    }
    if (typeof target === 'number') {
      return this.sections[target] ?? null;
    }
    if (target.startsWith('epubcfi(') || target.startsWith('#epubcfi(')) {
      const cfi = new Cfi(target);
      const asserted = this.sections.find((section) => section.idref === cfi.spineId);
      return asserted ?? this.sections[cfi.spineIndex ?? -1] ?? null;
    }
    if (target.startsWith('#')) {
      return this.sections.find((section) => section.idref === target.slice(1)) ?? null;
    }
    return this.sections.find((section) => hrefKey(section.href) === hrefKey(target)) ?? null;
  }

  /** Find the adjacent linear chapter; non-linear entries remain explicitly accessible. */
  adjacent(index: number, direction: 'next' | 'previous'): Section | null {
    this.assertActive();
    if (!Number.isInteger(index) || index < 0 || index >= this.sections.length) {
      return null;
    }
    const step = direction === 'next' ? 1 : -1;
    for (let cursor = index + step; cursor >= 0 && cursor < this.sections.length; cursor += step) {
      const section = this.sections[cursor];
      if (section?.linear) {
        return section;
      }
    }
    return null;
  }

  /** Destroy every chapter and release reading-order references; safe to repeat. */
  destroy(): void {
    for (const section of this.sections) {
      section.destroy();
    }
    this.sections.length = 0;
    this.destroyed = true;
  }

  /** Fail consistently after destruction. */
  private assertActive(): void {
    if (this.destroyed) {
      throw new Error('Spine has been destroyed.');
    }
  }
}
