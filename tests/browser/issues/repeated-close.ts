/** Repeated book ownership checks deterministic frame/source/URL release without relying on garbage-collection timing. */
import { Book } from '../../../src/index';
import { bookFiles, bookZip } from '../../unit/book/fixture';
import { host as createHost } from '../render/fixture';

/** Run bounded or continuous readers while intentionally retaining their exposed frames after closure. */
export async function repeatedClose(
  continuous: boolean,
): Promise<{ cycles: number; frames: boolean; sources: boolean; urls: boolean }> {
  const files = bookFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><p>Original repeated reading</p><!--${'Original retained source. '.repeat(10_000)}--></body></html>`,
  );
  const bytes = bookZip(files);
  const host = createHost();
  const frames: HTMLIFrameElement[] = [];
  const revoked: boolean[] = [];
  try {
    for (let cycle = 0; cycle < 8; cycle++) {
      const book = await Book.open(bytes);
      try {
        const reader = continuous ? book.renderContinuous(host) : book.renderTo(host);
        await reader.display();
        frames.push(...host.querySelectorAll('iframe'));
        const cover = await book.cover.url();
        const asset = await book.resources.url('images/cover.jpg');
        if (cover === null) {
          throw new Error('Expected the fixture cover URL.');
        }
        await Promise.all([fetch(cover), fetch(asset)]);
        await book.destroyAsync();
        book.destroy();
        const results = await Promise.allSettled([fetch(cover), fetch(asset)]);
        revoked.push(results.every((result) => result.status === 'rejected'));
      } finally {
        await book.destroyAsync();
      }
    }
    return {
      cycles: revoked.length,
      frames: frames.length === 8 && frames.every((frame) => !frame.isConnected),
      sources: frames.every((frame) => frame.srcdoc === '' && !frame.hasAttribute('srcdoc')),
      urls: revoked.every(Boolean),
    };
  } finally {
    host.remove();
  }
}
