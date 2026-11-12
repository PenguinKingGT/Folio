/** Native transport integration checks ordered headless progress without allocating publication views. */
import { Book, Cfi } from '../../../src/index';

/** Return observable sampling and DOM effects after bounded parallel generation. */
export async function parallelLocations(url: string): Promise<{
  samples: number;
  first: number | null;
  last: number | null;
  ordered: boolean;
  frames: boolean;
}> {
  const frames = document.querySelectorAll('iframe').length;
  const book = await Book.open(url);
  try {
    const entries = await book.locations.generate({ concurrency: 2, breakSize: 3 });
    return {
      samples: entries.length,
      first: new Cfi(entries[0]?.cfi ?? '').spineIndex,
      last: new Cfi(entries.at(-1)?.cfi ?? '').spineIndex,
      ordered: entries.every((entry, index) => {
        const previous = entries[index - 1];
        return previous === undefined || new Cfi(previous.cfi).compare(entry.cfi) <= 0;
      }),
      frames: document.querySelectorAll('iframe').length === frames,
    };
  } finally {
    book.destroy();
  }
}
