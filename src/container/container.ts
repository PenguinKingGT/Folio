/** Resolve the default OPF from an OCF container document by expanded XML names. */
import { validateArchivePath } from '../archive/path';
import { children, parseXml } from '../xml/parse';

const namespace = 'urn:oasis:names:tc:opendocument:xmlns:container';
const packageType = 'application/oebps-package+xml';

/** A validated package location relative to the container root, never META-INF. */
export interface Container {
  packagePath: string;
  directory: string;
  rootfiles: readonly string[];
}

/**
 * Parse an OCF container and choose its first OPF rendition in document order.
 * @see https://www.w3.org/TR/epub-rs-33/#sec-container
 * @throws TypeError for malformed XML, missing OPF rootfiles, or unsafe paths.
 */
export function parseContainer(source: string): Container {
  const root = parseXml(source).documentElement;
  if (root === null || root.localName !== 'container' || root.namespaceURI !== namespace) {
    throw new TypeError('Expected an OCF container root.');
  }
  const rootfiles = children(root, 'rootfiles', namespace);
  if (rootfiles.length !== 1 || rootfiles[0] === undefined) {
    throw new TypeError('Container must contain exactly one rootfiles element.');
  }
  const paths = children(rootfiles[0], 'rootfile', namespace)
    .filter((element) => element.getAttribute('media-type') === packageType)
    .map((element) => validateArchivePath(element.getAttribute('full-path') ?? ''));
  const packagePath = paths[0];
  if (packagePath === undefined || packagePath.endsWith('/')) {
    throw new TypeError('Container has no valid OPF rootfile.');
  }
  const slash = packagePath.lastIndexOf('/');
  return { packagePath, directory: packagePath.slice(0, slash + 1), rootfiles: paths };
}
