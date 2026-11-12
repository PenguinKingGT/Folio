/** Authored multi-chapter packages provide independent identities for bounded chapter-loading tests. */
import { parsePackage } from '../../../src/index';
import type { PublicationPackage } from '../../../src/index';
import { opf } from '../package/fixture';

/** Parse the same authored package used by native transport integration tests. */
export function manyPublication(count: number): PublicationPackage {
  return parsePackage(manyPackage(count));
}

/** Build independent linear identities without navigation or asset requests obscuring chapter scheduling. */
export function manyPackage(count: number): string {
  return opf({
    manifest: Array.from(
      { length: count },
      (_, index) =>
        `<item id="c${index}" href="c${index}.xhtml" media-type="application/xhtml+xml"/>`,
    ).join(''),
    spine: Array.from({ length: count }, (_, index) => `<itemref idref="c${index}"/>`).join(''),
  });
}
