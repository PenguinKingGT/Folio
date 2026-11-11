/** Original reading progress fixtures with inline words, blocks, active content and nonlinear chapters. */
import { Locations, parsePackage } from '../../../src/index';
import type { LocationLoader, PublicationPackage } from '../../../src/index';
import { opf } from '../package/fixture';

/** A small publication with two linear chapters and one explicitly excluded item. */
export function publication(language = 'en'): PublicationPackage {
  return parsePackage(
    opf({
      metadata: `<dc:identifier id="uid">original-progress</dc:identifier><dc:title>Original</dc:title><dc:language>${language}</dc:language>`,
      manifest:
        '<item id="a" href="a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="b.xhtml" media-type="application/xhtml+xml"/><item id="note" href="note.xhtml" media-type="application/xhtml+xml"/>',
      spine: '<itemref idref="a"/><itemref idref="note" linear="no"/><itemref idref="b"/>',
    }),
  );
}

/** Wrap original body content in valid XHTML. */
export function chapter(body: string): string {
  return `<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>${body}</body></html>`;
}

/** Build an index using original in-memory chapter content. */
export function locations(
  first = '<p id="one">Alpha <em>be</em>ta</p>',
  second = '<p id="two">Gamma delta</p>',
  language = 'en',
): Locations {
  const loader: LocationLoader = (href, signal) => {
    signal.throwIfAborted();
    if (href === 'note.xhtml') {
      throw new Error('Nonlinear notes must not be indexed.');
    }
    return Promise.resolve(chapter(href === 'a.xhtml' ? first : second));
  };
  return new Locations(publication(language), loader);
}
