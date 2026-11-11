/** Coordinate intra-chapter movement and linear spine transitions. */
import type { Section } from '../spine/section';
import type { Spine } from '../spine/spine';
import type { FlowState } from '../layout/flow';
import type { PaginationState } from '../layout/pagination';
import { lastOffset, scrollOffset, scrollToOffset } from './position';
import type { DisplayTarget } from './target';
import { measureFrame } from '../layout/columns';
import type { FixedLayoutState, RenderedPage } from './fixed-spread';

/** Minimal reader surface needed by sequential navigation. */
export interface NavigationHost {
  readonly frame: HTMLIFrameElement;
  readonly currentSection: Section | null;
  readonly flowState: FlowState | null;
  readonly pagination: PaginationState | null;
  readonly fixedLayout: FixedLayoutState | null;
  getRenderedPages(): readonly RenderedPage[];
  getContents(): Document | null;
  display(target?: DisplayTarget): Promise<Section>;
}

/** Measure and move hidden surfaces without changing the reader's visibility state. */
function turnWithinChapter(
  host: NavigationHost,
  document: Document,
  state: FlowState,
  next: boolean,
): boolean {
  return measureFrame(host.frame, () => {
    const offset = scrollOffset(document, state);
    const last = lastOffset(state, host.pagination);
    if (next ? offset >= last - 1 : offset <= 1) {
      return false;
    }
    const step = host.pagination?.advance ?? state.viewport;
    scrollToOffset(document, state, Math.max(0, Math.min(last, offset + (next ? step : -step))));
    return true;
  });
}

/** Move one viewport; return null at book boundaries and skip non-linear chapters. */
export async function turnPage(
  host: NavigationHost,
  spine: Spine,
  direction: 'next' | 'previous',
): Promise<Section | null> {
  const document = host.getContents();
  const section = host.currentSection;
  if (document === null || section === null) {
    return host.display();
  }
  const state = host.flowState;
  if (state === null) {
    throw new Error('Reading navigation requires a measured layout.');
  }
  const next = direction === 'next';
  if (turnWithinChapter(host, document, state, next)) {
    return section;
  }
  const pages = host.getRenderedPages();
  const edge = next ? pages.at(-1) : pages[0];
  const adjacent = spine.adjacent(edge?.section.index ?? section.index, direction);
  if (adjacent === null) {
    return null;
  }
  const result = await host.display(adjacent.index);
  const contents = host.getContents();
  const updated = host.flowState;
  if (!next && contents !== null && updated !== null) {
    measureFrame(host.frame, () =>
      scrollToOffset(contents, updated, lastOffset(updated, host.pagination)),
    );
  }
  return result;
}
