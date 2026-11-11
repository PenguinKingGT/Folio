/** Retain one logical reading point across repeated column, font, theme, and viewport reflows. */
import type { Rendition } from './rendition';
import type { Relocations } from './relocation';
import { measureFrame } from '../layout/columns';
import { scrollOffset, seekTarget } from './position';
import type { ResolvedTarget } from './target';

/** Distinguish user navigation from layout compensation so new line starts cannot accumulate drift. */
export class RenditionAnchor {
  private offset = 0;
  cfi: string | null = null;

  /** Relocations own subscriber lifetime; the anchor owns only its reading point and compensated pixels. */
  constructor(
    private readonly reader: Rendition,
    private readonly relocations: Relocations,
  ) {
    relocations.subscribe((location) => {
      if (reader.fixedLayout !== null) {
        this.cfi = null;
        return;
      }
      const document = reader.getContents();
      const state = reader.flowState;
      if (document !== null && state !== null) {
        const offset = measureFrame(reader.frame, () => scrollOffset(document, state));
        if (this.cfi === null || offset !== this.offset) {
          this.cfi = location.start.cfi;
          this.offset = offset;
        }
      }
    });
  }

  /** Seek and record compensated pixels together so a relocation cannot adopt a temporary layout position. */
  seek(target: ResolvedTarget, preserve = false): void {
    const document = this.reader.getContents();
    const state = this.reader.flowState;
    if (document !== null && state !== null) {
      measureFrame(this.reader.frame, () => {
        seekTarget(document, state, this.reader.pagination, target);
        this.offset = scrollOffset(document, state);
        if (!preserve) {
          this.cfi = target.cfi?.collapse().toString() ?? null;
        }
      });
      this.relocations.report();
    }
  }
}
