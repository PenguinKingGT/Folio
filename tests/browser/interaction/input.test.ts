/** Input callbacks remain typed, cancellable, and compatible with opt-in touch and keyboard hyperlink activation. */
import { expect, test } from 'vitest';
import { interactionReader, click } from './fixture';
import { swipe } from '../touch/fixture';

test('forwards keyboard/pointer modifiers and lets host input callbacks cancel touch turns', async () => {
  const { reader, release } = await interactionReader(false, true);
  try {
    const document = reader.getContents();
    const realm = document?.defaultView;
    if (!document || !realm) {
      throw new Error('Missing input document.');
    }
    const events: string[] = [];
    const unsubscribe = reader.interactions.onInput((input) => {
      events.push(`${input.kind}:${input.event.type}`);
      if (input.kind === 'pointer' && input.event.type === 'pointerdown') {
        input.event.preventDefault();
      }
      if (input.kind === 'keyboard') {
        expect(input.event.ctrlKey).toBe(true);
      }
    });
    expect(swipe(document.body)).toBe(false);
    document.body.dispatchEvent(
      new realm.KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true }),
    );
    document.body.dispatchEvent(
      new realm.KeyboardEvent('keyup', { key: 'ArrowRight', ctrlKey: true, bubbles: true }),
    );
    await reader.touch.whenIdle();
    expect(events).toEqual([
      'pointer:pointerdown',
      'pointer:pointermove',
      'pointer:pointerup',
      'keyboard:keydown',
      'keyboard:keyup',
    ]);
    expect(reader.currentLocation()?.atStart).toBe(true);
    const count = events.length;
    document.body.dispatchEvent(new realm.Event('keydown', { bubbles: true }));
    document.body.dispatchEvent(new realm.Event('pointerdown', { bubbles: true }));
    expect(events).toHaveLength(count);
    unsubscribe();
    unsubscribe();
    document.body.dispatchEvent(new realm.KeyboardEvent('keyup', { ctrlKey: true, bubbles: true }));
    expect(events).toHaveLength(count);
  } finally {
    release();
  }
});

test('keyboard Enter activates passive anchors and synchronous input cancellation prevents navigation', async () => {
  const { reader, release } = await interactionReader();
  try {
    const document = reader.getContents();
    const realm = document?.defaultView;
    const anchor = document?.getElementById('internal');
    if (!document || !realm || !anchor) {
      throw new Error('Missing keyboard link.');
    }
    const stop = reader.interactions.onInput((input) => input.event.preventDefault());
    anchor.dispatchEvent(
      new realm.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await reader.interactions.whenIdle();
    expect(reader.currentSection?.index).toBe(0);
    stop();
    click(anchor, { button: 1 });
    await reader.interactions.whenIdle();
    expect(reader.currentSection?.index).toBe(0);
    anchor.dispatchEvent(
      new realm.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    await reader.interactions.whenIdle();
    expect(reader.currentSection?.index).toBe(2);
  } finally {
    release();
  }
});
