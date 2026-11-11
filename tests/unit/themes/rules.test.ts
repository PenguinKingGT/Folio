/** Theme maps and import qualifiers cannot escape their explicit CSS parsing contexts. */
import { expect, test } from 'vitest';
import parse from 'css-tree/parser';
import { declaration, serializeRules, serializeOverride } from '../../../src/themes/rules';
import { importConditions, importReference } from '../../../src/themes/imports';

test('serializes selector maps, custom properties, and scoped important overrides', () => {
  expect(serializeRules({ 'body, p': { color: 'red', '--reader-color': 'blue !important' } })).toBe(
    'body,p{color:red;--reader-color:blue!important}',
  );
  expect(serializeOverride('line-height', '1.5', { important: true })).toBe(
    'html,body{line-height:1.5!important}',
  );
  expect(serializeOverride('color', 'green', { selector: 'p' })).toBe('p{color:green}');
  expect(serializeRules({ body: {} })).toBe('body{}');
  expect(declaration('font-family', 'serif', false)).toBe('font-family:serif');
});

test('rejects declaration/selector injection, invalid properties, and malformed runtime maps', () => {
  for (const [property, value] of [
    ['color;', 'red'],
    ['color', 'red;}body{color:blue'],
    ['color', ''],
  ]) {
    expect(() => declaration(property ?? '', value ?? '')).toThrow();
  }
  expect(() => serializeRules({ 'p}body{': { color: 'red' } })).toThrow();
  for (const rules of [null, [], { body: null }, { body: [] }, { body: { color: 1 } }]) {
    expect(() => {
      Reflect.apply(serializeRules, undefined, [rules]);
    }).toThrow();
  }
});

test('rejects malformed import AST boundaries without unchecked casts', () => {
  expect(() => importReference(parse('red', { context: 'value' }))).toThrow('import');
  expect(() => importConditions('p{}', [parse('red', { context: 'value' })])).toThrow('condition');
  const ast = parse('@import;');
  if (ast.type !== 'StyleSheet' || ast.children.first === null) {
    throw new Error('Missing import fixture.');
  }
  const first = ast.children.first;
  expect(() => importReference(first)).toThrow();
});
