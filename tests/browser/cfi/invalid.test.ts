/** Native DOM failures cover unsupported targets, offsets, detached nodes and invalid wrapper settings. */
import { expect, test } from 'vitest';
import { cfiFromNode, cfiFromRange, rangeFromCfi } from '../../../src/index';
import { child, element, fixture, options, range } from './fixture';

test.each(['', 'two classes'])('rejects invalid ignoreClass %s', (ignoreClass) => {
  const document = fixture();
  const p = element(document, '#para');
  expect(() => cfiFromNode(p, { ...options, ignoreClass })).toThrow(TypeError);
  expect(() => rangeFromCfi(document, 'epubcfi(/6/2!/4/2)', ignoreClass)).toThrow(TypeError);
});

test.each([
  'epubcfi(/4/2)',
  'epubcfi(/6/2!/4/2!/2)',
  'epubcfi(/6/2!/4/200)',
  'epubcfi(/6/2!/4/2[missing])',
  'epubcfi(/6/2!/4/2/1:100)',
  'epubcfi(/6/2!/4/2:1)',
])('rejects unresolved native CFI %s', (cfi) => {
  expect(() => rangeFromCfi(fixture(), cfi)).toThrow();
});

test('rejects detached, root, document, comment, and ignored wrapper targets', () => {
  const document = fixture('<p id="para"><span class="mark">Original</span></p>');
  for (const target of [
    document,
    document.documentElement,
    document.createElement('p'),
    document.createComment('Original'),
  ]) {
    expect(() => cfiFromNode(target, options)).toThrow(TypeError);
  }
  const wrapper = element(document, '.mark');
  expect(() => cfiFromNode(wrapper, { ...options, ignoreClass: 'mark' })).toThrow('logical');
  wrapper.setAttribute('id', 'wrapper');
  expect(() => rangeFromCfi(document, 'epubcfi(/6/2!/4/2/2[wrapper])', 'mark')).toThrow(
    'unresolved',
  );
});

test('rejects textless selections, comment boundaries and ranges without a content ancestor', () => {
  const document = fixture('<p>text</p><img/>');
  const image = element(document, 'img');
  const selected = document.createRange();
  selected.selectNode(image);
  expect(() => cfiFromRange(selected, options)).toThrow('Textless');
  const comment = document.createComment('original');
  document.body.appendChild(comment);
  expect(() => cfiFromRange(range(document, comment, 0), options)).toThrow('boundary');
  expect(() =>
    cfiFromRange(
      range(document, child(element(document, 'title')), 0, child(element(document, 'p')), 2),
      options,
    ),
  ).toThrow('ancestor');
});

test('rejects absent document roots and overly nested ignored wrappers', () => {
  const empty = document.implementation.createDocument(null, null);
  expect(() => rangeFromCfi(empty, 'epubcfi(/6/2!/4/2)')).toThrow('document element');
  const nested = fixture(`<p>${'<span class="mark">'.repeat(130)}text${'</span>'.repeat(130)}</p>`);
  const text = element(nested, 'p').getElementsByTagName('span').item(129)?.firstChild;
  if (text === null || text === undefined) {
    throw new Error('Missing nested fixture text.');
  }
  expect(() => cfiFromNode(text, { ...options, ignoreClass: 'mark' })).toThrow(RangeError);
});

test('rejects reversed endpoints after moved-ID recovery', () => {
  const document = fixture('<p id="a">First</p><p id="b">Second</p>');
  const cfi = cfiFromRange(
    range(document, child(element(document, '#a')), 1, child(element(document, '#b')), 2),
    options,
  );
  document.body.appendChild(element(document, '#a'));
  expect(() => rangeFromCfi(document, cfi)).toThrow('reversed');
});
