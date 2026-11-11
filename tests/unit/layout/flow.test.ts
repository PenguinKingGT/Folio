/** Flow resolution covers metadata defaults, explicit overrides and invalid JavaScript inputs. */
import { expect, test } from 'vitest';
import { resolveFlow } from '../../../src/index';

test('resolves automatic and explicit flows with suitable default axes', () => {
  expect(resolveFlow()).toEqual({ flow: 'paginated', axis: 'horizontal' });
  expect(resolveFlow({}, 'scrolled-doc')).toEqual({ flow: 'scrolled-doc', axis: 'vertical' });
  expect(resolveFlow({}, 'scrolled-continuous')).toEqual({
    flow: 'scrolled-continuous',
    axis: 'vertical',
  });
  expect(resolveFlow({}, 'unknown')).toEqual({ flow: 'paginated', axis: 'horizontal' });
  expect(resolveFlow({ flow: 'paginated' }, 'scrolled-doc')).toEqual({
    flow: 'paginated',
    axis: 'horizontal',
  });
  expect(resolveFlow({ flow: 'scrolled-doc', axis: 'horizontal' })).toEqual({
    flow: 'scrolled-doc',
    axis: 'horizontal',
  });
});

test('rejects unsupported flow and axis values rather than ignoring them', () => {
  expect(() => {
    Reflect.apply(resolveFlow, undefined, [{ flow: 'invalid' }]);
  }).toThrow(TypeError);
  expect(() => {
    Reflect.apply(resolveFlow, undefined, [{ axis: 'invalid' }]);
  }).toThrow(TypeError);
  expect(() => resolveFlow({ flow: 'paginated', axis: 'vertical' })).toThrow('F19');
});
