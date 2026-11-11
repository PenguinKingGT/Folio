/** Public native-content interaction snapshots keep publication identity separate from host navigation policy. */
import type { Section } from '../spine/section';
import type { DisplayTarget } from '../render/target';
import type { RenderedPage } from '../render/fixed-spread';

/** A cloned Range belongs to the caller; editing it never changes the browser's actual selection. */
export interface ContentSelection {
  readonly section: Section;
  readonly range: Range;
  readonly cfi: string;
  readonly text: string;
}

/** Keyboard and pointer input preserve native event cancellation and modifier information. */
export type ContentInput =
  | { readonly kind: 'keyboard'; readonly section: Section; readonly event: KeyboardEvent }
  | { readonly kind: 'pointer'; readonly section: Section; readonly event: PointerEvent };

/** Internal spine links can navigate automatically; external/resource targets remain caller-owned. */
export interface ContentLink {
  readonly href: string;
  readonly resolvedHref: string;
  readonly kind: 'internal' | 'external' | 'resource';
  readonly section: Section;
  readonly target: Readonly<DisplayTarget> | null;
}

/** Cancel default internal navigation synchronously without cancelling notification to other subscribers. */
export interface LinkActivation extends ContentLink {
  readonly event: MouseEvent | KeyboardEvent | undefined;
  preventDefault(): void;
}

/** A passive native anchor retains its original URI for an accessible host navigation panel. */
export interface ContentAnchor {
  readonly element: Element;
  readonly section: Section;
  readonly href: string;
  readonly label: string;
}

/** Reader views own document lifetimes; interactions own only listeners and pending consumer work. */
export interface InteractionHost {
  getRenderedPages(): readonly RenderedPage[];
  readonly currentSection: Section | null;
  display(target?: DisplayTarget): Promise<Section>;
}
