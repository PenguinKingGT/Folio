/** Logical viewport turns clamp to measured bounds and remain unavailable before geometry exists. */
import { expect, test } from 'vitest';
import { continuousTurnPosition } from '../../../src/continuous/turn';
import type { FlowState } from '../../../src/layout/flow';

test('handles absent geometry, short documents, fractional edges, and both logical directions', () => {
  const state: FlowState = {
    flow: 'scrolled-continuous',
    axis: 'vertical',
    writingMode: 'horizontal-tb',
    direction: 'ltr',
    reverse: false,
    length: 1000,
    viewport: 300,
  };
  expect(continuousTurnPosition(0, null, 1)).toBeNull();
  expect(continuousTurnPosition(0, state, -1)).toBeNull();
  expect(continuousTurnPosition(700, state, 1)).toBeNull();
  expect(continuousTurnPosition(699.5, state, 1)).toBeNull();
  expect(continuousTurnPosition(0, state, 1)).toBe(300);
  expect(continuousTurnPosition(600, state, 1)).toBe(700);
  expect(continuousTurnPosition(400, state, -1)).toBe(100);
  expect(continuousTurnPosition(100, state, -1)).toBe(0);
  expect(continuousTurnPosition(0, { ...state, length: 200 }, 1)).toBeNull();
});
