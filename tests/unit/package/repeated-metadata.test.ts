/** Upstream #950: repeated Dublin Core values survive package parsing without changing primary metadata. */
import { expect, test } from 'vitest';
import { parsePackage } from '../../../src/index';
import { metadata, opf } from './fixture';

for (const version of ['2.0', '3.0']) {
  test(`preserves repeated Dublin Core fields for EPUB ${version}`, () => {
    const result = parsePackage(
      opf({
        attributes: `version="${version}" unique-identifier="uid"`,
        metadata: `${metadata}<dc:language> fr </dc:language><dc:subject>History</dc:subject>
        <dc:subject>History</dc:subject><dc:subject>Science</dc:subject>
        <dc:title>Other title</dc:title><dc:identifier>secondary</dc:identifier>
        <dc:contributor>Editor</dc:contributor><dc:contributor/>
        <dc:description>First</dc:description><dc:description>Second</dc:description>
        <other:subject xmlns:other="urn:other">Ignored</other:subject>`,
      }),
    );
    expect(result.metadata).toMatchObject({
      title: 'Original title',
      language: 'en',
      identifier: 'urn:folio:test',
      creators: ['First author', 'Second author'],
      dublinCore: {
        title: ['Original title', 'Other title'],
        language: ['en', 'fr'],
        subject: ['History', 'History', 'Science'],
        identifier: ['urn:folio:test', 'secondary'],
        creator: ['First author', 'Second author'],
        contributor: ['Editor', ''],
        description: ['First', 'Second'],
      },
    });
  });
}

test('preserves document order and namespace aliases while excluding nested extension children', () => {
  const xml = opf({
    metadata: `${metadata}<dc:subject>One</dc:subject>
    <alias:subject xmlns:alias="http://purl.org/dc/elements/1.1/">Two</alias:subject>
    <extension><dc:subject>Nested</dc:subject></extension>`,
  });
  expect(parsePackage(xml).metadata).toMatchObject({ dublinCore: { subject: ['One', 'Two'] } });
});
