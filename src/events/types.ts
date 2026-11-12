/** Public event maps preserve payload types across books, both reader modes, and progress indexes. */
import type { Section } from '../spine/section';
import type { Rendition } from '../render/rendition';
import type { ContinuousReader } from '../continuous/reader';
import type { VisibleLocation } from '../render/location-types';
import type { ContentSelection, ContentInput, LinkActivation } from '../interaction/types';
import type { AnnotationClick } from '../annotations/types';
import type { ReadingLocation } from '../locations/types';

/** Opening failures reject Book.open(); these events cover an already opened book's owned operations. */
export interface BookEventMap {
  resourceLoaded: { readonly href: string; readonly from: string; readonly bytes: number };
  readerCreated: Rendition | ContinuousReader;
  error: unknown;
  destroyed: undefined;
}

/** Reader events forward native interaction snapshots without enabling publication scripts. */
export interface ReaderEventMap {
  displayed: Section;
  relocated: VisibleLocation;
  selected: ContentSelection | null;
  input: ContentInput;
  link: LinkActivation;
  annotationClick: AnnotationClick;
  error: unknown;
  destroyed: undefined;
}

/** Progress events are published after an atomic snapshot/current-position commit. */
export interface LocationsEventMap {
  generated: readonly ReadingLocation[];
  restored: readonly ReadingLocation[];
  changed: { readonly index: number; readonly cfi: string; readonly percentage: number };
  error: unknown;
  destroyed: undefined;
}
