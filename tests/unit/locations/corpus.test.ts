/** Passive text extraction shares rendering policy and preserves structural text slots. */
import { expect, test } from 'vitest';
import { chapterCorpus } from '../../../src/text/corpus';
import { corpusPoint } from '../../../src/text/position';
import { chapter } from './fixture';

test('merges adjacent text and skips scripts, style text and formatting-only slots', () => {
  const corpus = chapterCorpus(
    chapter(
      '<style>p{color:red}</style> \n <p id="x">ab<!-- comment --><![CDATA[cd]]><script>bad</script>ef</p><meta http-equiv="refresh" content="bad"/><p>next<br/>line</p>',
    ),
  );
  expect(corpus.text).toBe('abcdef\nnext\nline');
  expect(corpusPoint(corpus, 3, '/6/2').cfi).toContain('/4/4[x]/1:3');
  expect(corpusPoint(corpus, 6, '/6/2').offset).toBe(7);
});

test('supports body IDs and empty, invalid or excessively nested corpora', () => {
  const corpus = chapterCorpus(chapter('<p>one</p>').replace('<body>', '<body id="body">'));
  expect(corpusPoint(corpus, 0, '/6/2').cfi).toContain('/4[body]');
  expect(() => corpusPoint(chapterCorpus(chapter('')), 0, '/6/2')).toThrow(RangeError);
  expect(() => chapterCorpus('<root/>')).toThrow(TypeError);
  expect(() => chapterCorpus(chapter('<div>'.repeat(130) + 'text' + '</div>'.repeat(130)))).toThrow(
    RangeError,
  );
});
