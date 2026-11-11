/** Original CSS, font, image and XHTML resources under the project license. */
import { parsePackage, Resources } from '../../../src/index';
import type { ResourceOptions, ResourceReader } from '../../../src/index';
import { opf } from '../package/fixture';

export const files = new Map<string, string>([
  [
    'OPS/styles/main.css',
    '@import "nested.css" screen; @font-face {font-family:Original;src:url(../font.woff2)} p {background:url("../images/cover%20x.png")}',
  ],
  ['OPS/styles/nested.css', 'body {color: black}'],
  ['OPS/font.woff2', 'original font'],
  ['OPS/images/cover x.png', 'original image'],
  ['OPS/unknown.custom', 'original binary'],
]);

/** Read local original fixtures with no external service or asset dependency. */
export const readFixture: ResourceReader = (path, signal) => {
  signal.throwIfAborted();
  const value = files.get(path);
  if (value === undefined) {
    return Promise.reject(new Error(`Missing fixture: ${path}`));
  }
  return Promise.resolve(new TextEncoder().encode(value));
};

/** Build an OPF-scoped resource manager with a manifest CSS resource. */
export function resources(options: ResourceOptions = {}, read = readFixture): Resources {
  const publication = parsePackage(
    opf({
      manifest:
        '<item id="chapter" href="text/chapter.xhtml" media-type="application/xhtml+xml"/><item id="css" href="styles/main.css" media-type="text/css"/>',
    }),
  );
  return new Resources(publication, 'OPS/book.opf', read, options);
}
