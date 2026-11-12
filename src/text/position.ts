/** Map logical reading corpus positions to structurally accurate text CFIs. */
import { lowerBound } from '../locations/search';
import { serializeCfiPath } from '../cfi/path';
import type { TextCorpus } from './corpus';
import type { CfiPath } from '../cfi/types';
import { scalarBoundary } from './scalars';

/** Map an abstract character position to its nearest concrete text slot without splitting surrogates. */
export function corpusPoint(
  corpus: TextCorpus,
  offset: number,
  base: string,
): { cfi: string; offset: number } {
  const index = lowerBound(corpus.runs, (entry) => offset < entry.start + entry.text.length);
  const run = corpus.runs[index] ?? corpus.runs[corpus.runs.length - 1];
  if (run === undefined) {
    throw new RangeError('Cannot locate text in an empty chapter.');
  }
  let local = Math.min(run.text.length, Math.max(0, offset - run.start));
  const code = run.text.charCodeAt(local);
  if (local > 0 && code >= 0xdc00 && code <= 0xdfff) {
    local += 1;
  }
  return {
    cfi: `epubcfi(${base}!${serializeCfiPath({ steps: run.steps, offset: local, assertion: null })})`,
    offset: run.start + local,
  };
}

/** Resolve starts toward the next text run and ends toward the preceding run at exact boundaries. */
function endpoint(corpus: TextCorpus, offset: number, end: boolean): CfiPath {
  const index = end
    ? lowerBound(corpus.runs, (run) => run.start >= offset) - 1
    : lowerBound(corpus.runs, (run) => run.start + run.text.length > offset);
  const run = corpus.runs[Math.max(0, index)] ?? corpus.runs.at(-1);
  if (run === undefined) {
    throw new RangeError('Cannot locate a range in an empty chapter.');
  }
  const local = Math.max(0, Math.min(run.text.length, offset - run.start));
  return { steps: run.steps, offset: scalarBoundary(run.text, local, end), assertion: null };
}

/** Encode a non-empty textual match as one complete CFI range without native DOM globals. */
export function corpusRange(corpus: TextCorpus, start: number, end: number, base: string): string {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    end > corpus.text.length
  ) {
    throw new RangeError('Invalid corpus range boundaries.');
  }
  const first = endpoint(corpus, start, false);
  const last = endpoint(corpus, end, true);
  let common = 0;
  while (common < first.steps.length && first.steps[common]?.value === last.steps[common]?.value) {
    common += 1;
  }
  const prefix = serializeCfiPath({
    steps: first.steps.slice(0, common),
    offset: null,
    assertion: null,
  });
  const from = serializeCfiPath({ ...first, steps: first.steps.slice(common) });
  const to = serializeCfiPath({ ...last, steps: last.steps.slice(common) });
  return `epubcfi(${base}!${prefix},${from},${to})`;
}
