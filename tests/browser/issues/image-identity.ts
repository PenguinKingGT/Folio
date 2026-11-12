/** Original PNG fixtures verify exact resource identity and inline-image decoding in native readers. */
import { strToU8, zipSync } from 'fflate';
import { Book } from '../../../src/index';
import { bookFiles, bookZip } from '../../unit/book/fixture';
import { host } from '../render/fixture';

/** Native canvas creates licensed original image bytes instead of copying opaque upstream fixtures. */
function png(width: number, color: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 1;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Expected native canvas support.');
  }
  context.fillStyle = color;
  context.fillRect(0, 0, width, 1);
  return canvas.toDataURL('image/png');
}

/** Decode original canvas bytes only when the PNG is stored as an archive entry. */
function pngBytes(source: string): Uint8Array<ArrayBuffer> {
  const encoded = source.split(',')[1];
  if (encoded === undefined) {
    throw new Error('Missing original PNG payload.');
  }
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

/** Give similar filenames distinct intrinsic dimensions and unique manifest IDs. */
function imageBook(firstId: string, secondId: string): Promise<Book> {
  const files = bookFiles();
  files.set(
    'OPS/package.opf',
    (files.get('OPS/package.opf') ?? '').replace(
      '</manifest>',
      `<item id="${firstId}" href="images/17.3.png" media-type="image/png"/><item id="${secondId}" href="images/173.png" media-type="image/png"/></manifest>`,
    ),
  );
  files.set(
    'OPS/text/chapter one.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><head/><body><img src="../images/17.3.png"/><img src="../images/173.png"/></body></html>',
  );
  const entries = Object.fromEntries(
    Array.from(files, ([path, source]) => [path, strToU8(source)]),
  );
  entries['OPS/images/17.3.png'] = pngBytes(png(1, 'red'));
  entries['OPS/images/173.png'] = pngBytes(png(2, 'blue'));
  return Book.open(zipSync(entries, { level: 0 }));
}

/** Decode images with ordinary or leading-digit manifest IDs and compare the cache against exact hrefs. */
export async function imageIdentity(digitIds = false): Promise<{
  widths: readonly number[];
  distinct: boolean;
  exact: boolean;
}> {
  const firstId = digitIds ? '1-image-1' : 'first-image';
  const secondId = digitIds ? '2-image-2' : 'second-image';
  const book = await imageBook(firstId, secondId);
  const container = host();
  try {
    const reader = book.renderTo(container);
    await reader.display();
    const document = reader.getContents();
    if (document === null) {
      throw new Error('Missing native image chapter.');
    }
    const images = Array.from(document.images);
    const first = await book.resources.url('images/17.3.png');
    const second = await book.resources.url('images/173.png');
    return {
      widths: images.map((image) => image.naturalWidth),
      distinct: first !== second,
      exact:
        images[0]?.src === first &&
        images[1]?.src === second &&
        book.publication.manifest.get(firstId)?.href === 'images/17.3.png' &&
        book.publication.manifest.get(secondId)?.href === 'images/173.png',
    };
  } finally {
    book.destroy();
    container.remove();
  }
}

/** Inline PNGs must survive rewriting as data URIs without being looked up as container paths. */
export async function inlineImageIdentity(): Promise<{
  widths: readonly number[];
  retained: boolean;
  canonical: boolean;
}> {
  const sources = [png(1, 'red'), png(2, 'blue')];
  const files = bookFiles();
  files.set(
    'OPS/text/chapter one.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>${sources.map((source) => `<img src="${source}"/>`).join('')}</body></html>`,
  );
  const book = await Book.open(bookZip(files));
  const container = host();
  try {
    const reader = book.renderTo(container);
    await reader.display();
    const document = reader.getContents();
    if (document === null) {
      throw new Error('Missing inline image chapter.');
    }
    const images = Array.from(document.images);
    const resolved = await Promise.all(sources.map((source) => book.resources.url(source)));
    return {
      widths: images.map((image) => image.naturalWidth),
      retained: sources.every(
        (source, index) => images[index]?.src === source && resolved[index] === source,
      ),
      canonical: sources.every((source) => book.resources.canonical(source) === source),
    };
  } finally {
    book.destroy();
    container.remove();
  }
}
