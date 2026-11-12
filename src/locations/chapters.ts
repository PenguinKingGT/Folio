/** Prefetch a bounded window of chapter markup while yielding results strictly in linear spine order. */
import { withAbort } from '../async/cancellation';
import type { PublicationPackage, SpineItem } from '../package/types';
import { validateXmlSource } from '../xml/constraints';
import type { LocationLoader } from './types';

/** Keep parsing and sampling in the consumer; queued work retains only bounded XHTML strings. */
interface ChapterSource {
  item: SpineItem;
  source: string;
}
type Outcome = ChapterSource | { error: unknown };

/** Observe every producer failure immediately and cancel siblings, including when an earlier producer ignores abort. */
async function readChapter(
  publication: PublicationPackage,
  item: SpineItem,
  load: LocationLoader,
  controller: AbortController,
  signal: AbortSignal,
): Promise<Outcome> {
  try {
    signal.throwIfAborted();
    const resource = publication.manifest.get(item.idref);
    if (resource === undefined) {
      throw new TypeError('Location chapter is missing from the manifest.');
    }
    const source = await withAbort(
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return load(resource.href, signal);
      }),
      signal,
    );
    validateXmlSource(source, 'xhtml');
    return { item, source };
  } catch (error) {
    controller.abort(error);
    return { error };
  }
}

/** Limit outstanding work and cancel remaining producers on read errors, parser failure, cancellation, or early return. */
export async function* chapterSources(
  publication: PublicationPackage,
  load: LocationLoader,
  consumer: AbortSignal,
  concurrency = 4,
): AsyncGenerator<ChapterSource> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 16) {
    throw new RangeError('Location concurrency must be an integer from 1 through 16.');
  }
  consumer.throwIfAborted();
  const controller = new AbortController();
  const signal = AbortSignal.any([consumer, controller.signal]);
  const chapters = publication.spine.filter((entry) => entry.linear);
  const start = (item: SpineItem) => readChapter(publication, item, load, controller, signal);
  const pending = chapters.slice(0, concurrency).map(start);
  let next = pending.length;
  try {
    while (true) {
      const operation = pending.shift();
      if (operation === undefined) {
        break;
      }
      const result = await operation;
      if ('error' in result) {
        throw result.error;
      }
      signal.throwIfAborted();
      yield result;
      const item = chapters[next++];
      if (item !== undefined) {
        pending.push(start(item));
      }
    }
  } finally {
    if (pending.length > 0) {
      controller.abort();
    }
  }
}
