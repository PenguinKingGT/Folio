/** Collapse reading whitespace with a sparse offset map instead of allocating a mapping for every character. */
import { lowerBound } from '../locations/search';

/** Only length-changing whitespace runs need mapping; single spaces/NBSP keep their original offsets. */
interface WhitespaceEdit {
  readonly index: number;
  readonly start: number;
  readonly end: number;
}

/** Case matching never changes this text, preserving original Unicode positions for native CFI ranges. */
export class SearchText {
  readonly text: string;
  private readonly edits: WhitespaceEdit[] = [];
  private readonly leading: number;

  /** Preserve literal text or collapse whitespace while recording only removed code units. */
  constructor(source: string, normalize: boolean) {
    let removed = 0;
    const text = normalize
      ? source.replace(/\s+/gu, (whitespace: string, index: number) => {
          if (whitespace.length !== 1) {
            this.edits.push({
              index: index - removed,
              start: index,
              end: index + whitespace.length,
            });
            removed += whitespace.length - 1;
          }
          return ' ';
        })
      : source;
    this.leading = normalize ? text.length - text.trimStart().length : 0;
    this.text = normalize ? text.trim() : text;
  }

  /** Map normalized boundaries back to original text without narrowing a collapsed whitespace run. */
  position(index: number): number {
    if (!Number.isSafeInteger(index) || index < 0 || index > this.text.length) {
      throw new RangeError('Search offset is outside the normalized text.');
    }
    const position = index + this.leading;
    const edit = this.edits[lowerBound(this.edits, (entry) => entry.index > position) - 1];
    if (edit === undefined) {
      return position;
    }
    return position === edit.index ? edit.start : position + edit.end - edit.index - 1;
  }
}
