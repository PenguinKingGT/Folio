/** Reject malformed OPF structures rather than producing partial publication models. */
import { expect, test } from 'vitest';
import { parsePackage } from '../../../src/index';
import { manifest, metadata, opf } from './fixture';

test.each([
  '<package/>',
  '<other xmlns="http://www.idpf.org/2007/opf"/>',
  opf({ attributes: 'version="1.0" unique-identifier="uid"' }),
  opf({ attributes: 'unique-identifier="uid"' }),
  opf({ attributes: 'version=" " unique-identifier="uid"' }),
  opf({ attributes: 'version="3.0"' }),
  opf({ attributes: 'version="3.0" unique-identifier="missing"' }),
  opf({ metadata: metadata.replace('urn:folio:test', '') }),
  opf({ metadata: metadata.replace('<dc:title>Original title</dc:title>', '') }),
  opf({ metadata: metadata.replace('<dc:language>en</dc:language>', '') }),
  opf({ manifest: `${manifest}<item id="chapter" href="duplicate" media-type="text/plain"/>` }),
  opf({ manifest: '<item id="chapter" media-type="text/plain"/>' }),
  opf({ manifest: '<item id="chapter" href="book"/>' }),
  opf({
    manifest: `${manifest}<item id="bad" href="x" media-type="text/plain" fallback="missing"/>`,
  }),
  opf({ spine: '<itemref idref="missing"/>' }),
  opf({ spine: '<itemref/>' }),
  opf({ spine: '<itemref idref="chapter" linear="maybe"/>' }),
  opf({ spine: '' }),
  opf()
    .replace('page-progression-direction="rtl"', 'page-progression-direction="bad"')
    .replace('<spine ', '<spine page-progression-direction="bad" '),
  opf().replace('<spine ', '<spine toc="missing" '),
  opf().replace('<manifest>', '<wrapper>').replace('</manifest>', '</wrapper>'),
  opf().replace('</metadata>', '</metadata><metadata/>'),
])('rejects invalid package %#', (xml) => {
  expect(() => parsePackage(xml)).toThrow(TypeError);
});
