/** Opaque-frame protocol decoding accepts only the current token, bounded strings, and valid JSON without privileged actions. */
import { expect, test } from 'vitest';
import { scriptMessage } from '../../../src/scripted/protocol';
import { dataUrl, textUrl } from '../../../src/scripted/data';

test('decodes session-ready, errors and publication JSON while rejecting malformed or stale messages', () => {
  const token = 'original-session';
  expect(scriptMessage({ folio: token, type: 'ready' }, token)).toEqual({ type: 'ready' });
  expect(scriptMessage({ folio: token, type: 'error', value: 'publisher failure' }, token)).toEqual(
    { type: 'error', value: 'publisher failure' },
  );
  expect(
    scriptMessage({ folio: token, type: 'message', value: '{"original":true}' }, token),
  ).toEqual({ type: 'message', value: { original: true } });
  for (const input of [
    null,
    1,
    {},
    { folio: 'old', type: 'ready' },
    { folio: token },
    { folio: token, type: 'message' },
    { folio: token, type: 'message', value: 1 },
    { folio: token, type: 'unknown', value: '' },
    { folio: token, type: 'message', value: '{broken' },
    { folio: token, type: 'message', value: 'x'.repeat(65_537) },
    { folio: token, type: 'error', value: 'x'.repeat(513) },
  ]) {
    expect(scriptMessage(input, token)).toBeNull();
  }
});

test('encodes large Unicode and binary sources without raw script terminators or unsafe media types', () => {
  const source = 'Original 😀 </script> & <'.repeat(3000);
  const url = textUrl(source, 'text/javascript');
  const bytes = Uint8Array.from(atob(url.split(',')[1] ?? ''), (char) => char.charCodeAt(0));
  expect(new TextDecoder().decode(bytes)).toBe(source);
  expect(url).not.toContain('</script>');
  expect(dataUrl(new Uint8Array(), 'image/png')).toBe('data:image/png;base64,');
  expect(() => dataUrl(new Uint8Array([1]), 'text/html;unsafe')).toThrow(TypeError);
});
