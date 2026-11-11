/** Build bounded, monotonic character/word locations across linear chapters. */
import { Cfi } from '../cfi/cfi';
import { escapeCfi } from '../cfi/syntax';
import type { PublicationPackage } from '../package/types';
import { chapterCorpus, corpusPoint } from './corpus';
import type { TextCorpus } from './corpus';
import type { LocationLoader, LocationOptions, LocationSnapshot, ReadingLocation } from './types';

/** Choose Unicode word segmentation using publication language, with an ICU fallback for invalid tags. */
function segmenter(language: string): Intl.Segmenter {
  try {
    return new Intl.Segmenter(language, { granularity: 'word' });
  } catch {
    return new Intl.Segmenter(undefined, { granularity: 'word' });
  }
}

/** Add unique CFI points in document order and enforce a bounded table size. */
function append(locations: ReadingLocation[], cfi: string, position: number): void {
  const previous = locations[locations.length - 1];
  if (previous?.cfi === cfi) {
    return;
  }
  if (locations.length >= 100_000) {
    throw new RangeError('Location index exceeds 100,000 entries.');
  }
  locations.push(Object.freeze({ cfi: new Cfi(cfi).toString(), position }));
}

/** Mutable state exists only during one generation and is published after all chapters succeed. */
interface Generation {
  locations: ReadingLocation[];
  total: number;
  lastCfi: string | null;
}

/** Sample character boundaries without placing a reading point inside a surrogate pair. */
function characters(corpus: TextCorpus, base: string, interval: number, state: Generation): void {
  if (corpus.text.length === 0) {
    return;
  }
  append(state.locations, corpusPoint(corpus, 0, base).cfi, state.total);
  for (
    let offset = (interval - (state.total % interval)) % interval;
    offset < corpus.text.length;
    offset += interval
  ) {
    const point = corpusPoint(corpus, offset, base);
    append(state.locations, point.cfi, state.total + point.offset);
  }
  state.total += corpus.text.length;
  state.lastCfi = corpusPoint(corpus, corpus.text.length, base).cfi;
}

/** Count semantic words across inline nodes while respecting block boundaries. */
function wordLocations(
  corpus: TextCorpus,
  base: string,
  interval: number,
  words: Intl.Segmenter,
  state: Generation,
): void {
  let first = true;
  for (const word of words.segment(corpus.text)) {
    if (word.isWordLike) {
      if (first || state.total % interval === 0) {
        append(state.locations, corpusPoint(corpus, word.index, base).cfi, state.total);
      }
      first = false;
      state.total += 1;
      state.lastCfi = corpusPoint(corpus, word.index + word.segment.length, base).cfi;
    }
  }
}

/** Index the linear spine without populating Section DOM caches; cancellation prevents partial delivery. */
export async function generateLocations(
  publication: PublicationPackage,
  load: LocationLoader,
  options: LocationOptions,
  signal: AbortSignal,
): Promise<LocationSnapshot> {
  const unit = options.unit ?? 'characters';
  const breakSize = options.breakSize ?? (unit === 'characters' ? 150 : 50);
  if (
    (unit !== 'characters' && unit !== 'words') ||
    !Number.isSafeInteger(breakSize) ||
    breakSize <= 0
  ) {
    throw new RangeError('Location units and positive integer interval are required.');
  }
  const state: Generation = { locations: [], total: 0, lastCfi: null };
  const words = segmenter(publication.metadata.language);
  for (const item of publication.spine.filter((entry) => entry.linear)) {
    signal.throwIfAborted();
    const resource = publication.manifest.get(item.idref);
    if (resource === undefined) {
      throw new TypeError('Location chapter is missing from the manifest.');
    }
    const corpus = chapterCorpus(await load(resource.href, signal));
    signal.throwIfAborted();
    const base = `/${publication.spineStep}/${(item.index + 1) * 2}[${escapeCfi(item.idref)}]`;
    if (unit === 'characters') {
      characters(corpus, base, breakSize, state);
    } else {
      wordLocations(corpus, base, breakSize, words, state);
    }
  }
  if (state.lastCfi !== null) {
    append(state.locations, state.lastCfi, state.total);
  }
  return {
    version: 1,
    identifier: publication.metadata.identifier,
    unit,
    breakSize,
    total: state.total,
    current: state.locations.length === 0 ? null : 0,
    locations: Object.freeze(state.locations),
  };
}
