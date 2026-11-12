/** Apple display preferences retain false/absent distinctions and deterministic platform precedence under strict XML parsing. */
import { expect, test } from 'vitest';
import { parseAppleDisplayOptions } from '../../../src/index';
import { appleXml } from './fixture';

test('parses known options without treating interactive metadata as execution permission', () => {
  const options = parseAppleDisplayOptions(appleXml());
  expect(options).toEqual({
    fixedLayout: true,
    openToSpread: true,
    interactive: true,
    orientationLock: 'landscape-only',
  });
  expect(Object.isFrozen(options)).toBe(true);
  expect(
    parseAppleDisplayOptions(
      appleXml(
        '<option name="fixed-layout">false</option><option name="open-to-spread">false</option><option name="interactive">false</option><option name="orientation-lock">none</option>',
      ),
    ),
  ).toEqual({
    fixedLayout: false,
    openToSpread: false,
    interactive: false,
    orientationLock: 'none',
  });
  expect(parseAppleDisplayOptions('<display_options/>')).toEqual({
    fixedLayout: null,
    openToSpread: null,
    interactive: null,
    orientationLock: null,
  });
});

test('selected platform overrides wildcard and root defaults regardless of element order', () => {
  const source = `<display_options>
    <option name="fixed-layout">false</option>
    <platform name="ipad"><option name="fixed-layout">true</option><option name="orientation-lock">portrait-only</option></platform>
    <platform name="*"><option name="orientation-lock">landscape-only</option></platform>
    <platform><option name="interactive">true</option></platform>
    <platform name="unknown"><option name="fixed-layout">unsupported</option></platform>
  </display_options>`;
  expect(parseAppleDisplayOptions(source, 'ipad')).toMatchObject({
    fixedLayout: true,
    orientationLock: 'portrait-only',
    interactive: null,
  });
  expect(parseAppleDisplayOptions(source, 'iphone')).toMatchObject({
    fixedLayout: false,
    orientationLock: 'landscape-only',
    interactive: true,
  });
  expect(parseAppleDisplayOptions(source)).toMatchObject({ fixedLayout: false, interactive: null });
  expect(
    parseAppleDisplayOptions(
      appleXml('<option name="unknown">anything</option><option name="unknown">repeated</option>'),
    ).fixedLayout,
  ).toBeNull();
});

test('rejects malformed roots, ambiguous settings, invalid values, DTDs and unsupported host platforms', () => {
  for (const source of [
    '<wrong/>',
    '<display_options xmlns="urn:wrong"/>',
    '<broken',
    appleXml('<option>true</option>'),
    appleXml('<option name="fixed-layout">yes</option>'),
    appleXml('<option name="orientation-lock">sideways</option>'),
    appleXml('<option name="interactive">true</option><option name="interactive">false</option>'),
    '<display_options><platform name="*"/><platform name="*"/></display_options>',
    '<!DOCTYPE display_options><display_options/>',
  ]) {
    expect(() => parseAppleDisplayOptions(source)).toThrow();
  }
  expect(() => {
    Reflect.apply(parseAppleDisplayOptions, null, [appleXml(), 'android']);
  }).toThrow('platform');
});
