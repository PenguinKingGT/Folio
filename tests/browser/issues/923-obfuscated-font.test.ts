/** A native font decoder must receive the original font, not the obfuscated prefix from the ZIP. */
import { expect, test } from 'vitest';
import { obfuscatedFontScenario } from './obfuscated-font';

test('loads and uses an IDPF-obfuscated embedded font without fallback glyph metrics', async () => {
  const result = await obfuscatedFontScenario();
  expect(result.loaded).toBe(1);
  expect(result.width).toBe(96);
});

test('retains native font loading for ordinary unmodified embedded fonts', async () => {
  const result = await obfuscatedFontScenario(false);
  expect(result.loaded).toBe(1);
  expect(result.width).toBe(96);
});
