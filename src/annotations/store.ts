/** Own bounded annotation registrations independently of native views and overlay rendering. */
import type { Book } from '../book/book';
import { annotationModel } from './model';
import type { Annotation, AnnotationType, AnnotationOptions, AnnotationUpdate } from './types';

/** Immutable entries keep caller identity stable across layout and chapter reloads. */
export class AnnotationStore {
  private readonly entries = new Map<string, Annotation>();
  private sequence = 0;

  /** Bind structural CFI validation without requesting chapter bodies. */
  constructor(private readonly book: Book) {}

  /** Prepare a validated registration without changing the registry. */
  create(type: AnnotationType, cfi: string, options: AnnotationOptions): Annotation {
    let id = options.id;
    if (id === undefined) {
      do {
        id = `annotation-${++this.sequence}`;
      } while (this.entries.has(id));
    }
    if (this.entries.has(id)) {
      throw new RangeError('Annotation ID is already registered.');
    }
    if (this.entries.size >= 4096) {
      throw new RangeError('Too many annotations.');
    }
    return annotationModel(this.book, type, cfi, id, options);
  }

  /** Prepare an update without exposing partially validated metadata or appearance. */
  change(id: string, patch: AnnotationUpdate): Annotation {
    if (
      patch === null ||
      typeof patch !== 'object' ||
      Array.isArray(patch) ||
      (patch.style !== undefined &&
        (patch.style === null || typeof patch.style !== 'object' || Array.isArray(patch.style)))
    ) {
      throw new TypeError('Invalid annotation update.');
    }
    const current = this.entries.get(id);
    if (current === undefined) {
      throw new RangeError('Unknown annotation.');
    }
    return annotationModel(
      this.book,
      current.type,
      patch.cfi === undefined ? current.cfi : patch.cfi,
      id,
      {
        data: 'data' in patch ? patch.data : current.data,
        label: patch.label === undefined ? current.label : patch.label,
        interactive: patch.interactive === undefined ? current.interactive : patch.interactive,
        style: { ...current.style, ...patch.style },
      },
    );
  }

  /** Commit only after the controller validates any currently loaded native target. */
  commit(annotation: Annotation): void {
    this.entries.set(annotation.id, annotation);
  }
  /** Resolve an ID without exposing the mutable map. */
  get(id: string): Annotation | null {
    return this.entries.get(id) ?? null;
  }
  /** Return registration order as an immutable snapshot. */
  all(): readonly Annotation[] {
    return Object.freeze(Array.from(this.entries.values()));
  }
  /** Remove one registration; repeated removal is harmless. */
  remove(id: string): boolean {
    return this.entries.delete(id);
  }
  /** Release all registrations while keeping automatically generated IDs monotonic. */
  clear(): void {
    this.entries.clear();
  }
}
