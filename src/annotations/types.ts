/** Annotation models keep persistent CFI targets separate from transient native geometry and click events. */
import type { RenderedPage } from '../render/fixed-spread';
import type { RelocatedListener } from '../render/location-types';

/** Highlights and underlines target text ranges; marks also accept point/element CFIs. */
export type AnnotationType = 'highlight' | 'underline' | 'mark';

/** Colors belong to the host overlay; thickness and size use viewport CSS pixels. */
export interface AnnotationStyle {
  readonly color: string;
  readonly opacity: number;
  readonly thickness: number;
  readonly size: number;
}

/** Payloads remain caller-owned; interactive overlays opt into intercepting pointer/keyboard input. */
export interface AnnotationOptions {
  id?: string;
  data?: unknown;
  label?: string;
  interactive?: boolean;
  style?: Partial<AnnotationStyle>;
}

/** Existing IDs and types stay stable while targets, appearance, and caller metadata can change. */
export interface AnnotationUpdate {
  cfi?: string;
  data?: unknown;
  label?: string;
  interactive?: boolean;
  style?: Partial<AnnotationStyle>;
}

/** Immutable registration snapshots persist across chapter unload/reload for the reader lifetime. */
export interface Annotation {
  readonly id: string;
  readonly type: AnnotationType;
  readonly cfi: string;
  readonly sectionIndex: number;
  readonly data: unknown;
  readonly label: string;
  readonly interactive: boolean;
  readonly style: AnnotationStyle;
}

/** Native click/keyboard events originate in the host overlay, including with passive WebKit frames. */
export interface AnnotationClick {
  readonly annotation: Annotation;
  readonly event: MouseEvent | KeyboardEvent;
}

/** Rendered page access and relocation subscription are independent of the reader's view implementation. */
export interface AnnotationHost {
  getRenderedPages(): readonly RenderedPage[];
  onRelocated(listener: RelocatedListener): () => void;
}
