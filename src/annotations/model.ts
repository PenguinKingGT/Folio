/** Validate annotation identity, CFI ownership, and immutable style snapshots without loading chapter content. */
import type { Book } from '../book/book';
import { Cfi } from '../cfi/cfi';
import type { Annotation, AnnotationType, AnnotationOptions, AnnotationStyle } from './types';

/** Bound overlay dimensions and opacity before native SVG attributes are created. */
function dimension(value: number, minimum: number, maximum: number, name: string): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`Invalid annotation ${name}.`);
  }
  return value;
}

/** Validate CSS colors in browsers and retain a portable, bounded representation for headless models. */
function color(value: string): string {
  if (
    typeof value !== 'string' ||
    value.trim() === '' ||
    value.length > 256 ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32) ||
    (globalThis.CSS !== undefined && !CSS.supports('color', value))
  ) {
    throw new TypeError('Invalid annotation color.');
  }
  return value;
}

/** Return a fully populated immutable style; payload objects are deliberately not cloned or frozen. */
function appearance(type: AnnotationType, style: Partial<AnnotationStyle> = {}): AnnotationStyle {
  if (style === null || typeof style !== 'object' || Array.isArray(style)) {
    throw new TypeError('Annotation style must be an object.');
  }
  const defaultColor = type === 'mark' ? '#2864dc' : '#ffcf00';
  return Object.freeze({
    color: color(style.color ?? defaultColor),
    opacity: dimension(style.opacity ?? (type === 'highlight' ? 0.35 : 1), 0, 1, 'opacity'),
    thickness: dimension(style.thickness ?? 2, 0.5, 12, 'thickness'),
    size: dimension(style.size ?? 14, 8, 64, 'size'),
  });
}

/** Ensure a target belongs to this package and can identify the requested annotation kind. */
export function annotationTarget(
  book: Book,
  type: AnnotationType,
  value: string,
): { cfi: string; index: number } {
  if (!['highlight', 'underline', 'mark'].includes(type)) {
    throw new TypeError('Unknown annotation type.');
  }
  const cfi = new Cfi(value);
  const section = book.section(cfi.toString());
  if (
    section === null ||
    cfi.data.paths.length !== 2 ||
    cfi.data.paths[0]?.steps.length !== 2 ||
    cfi.data.paths[0]?.steps[0]?.value !== book.publication.spineStep ||
    cfi.data.paths[1]?.steps[0]?.value !== 4 ||
    (cfi.spineId !== null && cfi.spineId !== section.idref)
  ) {
    throw new TypeError('Annotation CFI does not identify this publication.');
  }
  if (type !== 'mark' && (!cfi.isRange || cfi.collapse().compare(cfi.collapse(false)) === 0)) {
    throw new TypeError('Text annotations require a non-empty range CFI.');
  }
  return { cfi: cfi.toString(), index: section.index };
}

/** Normalize one registration before it is published by the store. */
export function annotationModel(
  book: Book,
  type: AnnotationType,
  cfi: string,
  id: string,
  options: AnnotationOptions,
): Annotation {
  const target = annotationTarget(book, type, cfi);
  if (
    typeof id !== 'string' ||
    id.trim() === '' ||
    id.length > 128 ||
    Array.from(id).some((character) => character.charCodeAt(0) < 32)
  ) {
    throw new TypeError('Invalid annotation ID.');
  }
  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options) ||
    (options.label !== undefined &&
      (typeof options.label !== 'string' || options.label.length > 256)) ||
    (options.interactive !== undefined && typeof options.interactive !== 'boolean')
  ) {
    throw new TypeError('Invalid annotation options.');
  }
  return Object.freeze({
    id,
    type,
    cfi: target.cfi,
    sectionIndex: target.index,
    data: options.data,
    label: options.label ?? 'Annotation',
    interactive: options.interactive ?? type === 'mark',
    style: appearance(type, options.style),
  });
}
