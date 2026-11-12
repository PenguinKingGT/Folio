/** Native preparation barriers include cancellation-triggered cleanup and can be closed without browser globals. */
import { expect, test } from 'vitest';
import { PublicationHooks } from '../../../src/index';

test('native preparation barriers keep idle pending until released and handles remain idempotent', async () => {
  const hooks = new PublicationHooks();
  const finish = hooks.trackView();
  let settled = false;
  const idle = hooks.whenIdle().then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  finish();
  finish();
  await idle;
  expect(settled).toBe(true);
  hooks.destroy();
  expect(() => hooks.trackView()).toThrow('destroyed');
});

test('synchronous destruction releases preparation barriers even if a custom loader never finishes', async () => {
  const hooks = new PublicationHooks();
  const finish = hooks.trackView();
  const idle = hooks.whenIdle();
  hooks.destroy();
  await idle;
  finish();
  await hooks.whenIdle();
});
