/** JSON normalization retains repeated metadata consistently with the OPF metadata contract for upstream #950. */
import { expect, expectTypeOf, test } from 'vitest';
import { parseJsonManifest } from '../../../src/index';
import type { PackageMetadata } from '../../../src/index';
import { jsonManifest } from './fixture';

test('retains language and subject arrays, creator aliases, and optional Dublin Core values', () => {
  const input = jsonManifest();
  input.metadata = {
    identifier: 'multi',
    title: 'Original',
    language: ['en', 'fr'],
    creator: ['One', 'Two'],
    subject: ['Science', 'Science', 'History'],
    contributor: ['Editor', 'Translator'],
    rights: 'Original license',
  };
  const result = parseJsonManifest(input).publication.metadata;
  expect(result.language).toBe('en');
  expect(result.dublinCore).toMatchObject({
    language: ['en', 'fr'],
    creator: ['One', 'Two'],
    subject: ['Science', 'Science', 'History'],
    contributor: ['Editor', 'Translator'],
    rights: ['Original license'],
  });
  expect(result.dublinCore.publisher).toBeUndefined();
  expectTypeOf<PackageMetadata['dublinCore']>().toEqualTypeOf<
    Readonly<Record<string, readonly string[]>>
  >();
});

test.each([null, [null], [42], {}])(
  'rejects invalid newly supported Dublin Core field %j',
  (subject) => {
    const input = jsonManifest();
    input.metadata = { identifier: 'multi', title: 'Original', language: 'en', subject };
    expect(() => parseJsonManifest(input)).toThrow(TypeError);
  },
);
