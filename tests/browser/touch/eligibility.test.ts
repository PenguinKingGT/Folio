/** Swipes never replace native control, text-selection, pinch, or nested-scroller interactions. */
import { expect, test } from 'vitest';
import { touchEligible } from '../../../src/touch/eligibility';
import { touchReader, swipe, pointer } from './fixture';

test('ignores links, form controls, editable content and nested scrolling regions', async () => {
  const { reader, release } = await touchReader();
  try {
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing interaction document.');
    }
    for (const tag of ['a', 'button', 'input', 'textarea', 'select', 'video']) {
      const element = document.createElement(tag);
      document.body.appendChild(element);
      expect(swipe(element)).toBe(false);
    }
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    document.body.appendChild(editor);
    expect(swipe(editor)).toBe(false);
    const scroller = document.createElement('div');
    scroller.style.cssText = 'width:50px;height:50px;overflow:auto';
    const content = document.createElement('div');
    content.style.cssText = 'width:500px;height:500px';
    scroller.appendChild(content);
    document.body.appendChild(scroller);
    expect(swipe(content)).toBe(false);
    expect(touchEligible(document, content, 'vertical')).toBe(false);
    await reader.touch.whenIdle();
    expect(reader.currentLocation()?.atStart).toBe(true);
    expect(touchEligible(document, null, 'horizontal')).toBe(true);
    expect(touchEligible(document, new EventTarget(), 'horizontal')).toBe(true);
  } finally {
    release();
  }
});

test('preserves selected text and cancels multi-touch, mouse, cancelled and stale geometry gestures', async () => {
  const { reader, release } = await touchReader();
  try {
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing touch document.');
    }
    const selection = document.getSelection();
    const range = document.createRange();
    range.selectNodeContents(document.body);
    selection?.addRange(range);
    expect(swipe(document.body)).toBe(false);
    selection?.removeAllRanges();
    pointer(document.body, 'pointerdown');
    pointer(document.body, 'pointerdown', { pointerId: 2, isPrimary: false });
    pointer(document.body, 'pointerup', { pointerId: 2, isPrimary: false });
    pointer(document.body, 'pointerup', { clientX: -100 });
    pointer(document.body, 'pointerdown', { pointerType: 'mouse' });
    pointer(document.body, 'pointerup', { pointerType: 'mouse', clientX: -100 });
    pointer(document.body, 'pointerdown');
    pointer(document.body, 'pointercancel');
    pointer(document.body, 'pointerup', { clientX: -100 });
    pointer(document.body, 'pointerdown');
    reader.layout({ gap: 40 });
    pointer(document.body, 'pointerup', { clientX: -100 });
    await reader.touch.whenIdle();
    expect(reader.currentLocation()?.atStart).toBe(true);
    expect(reader.touch.lastError).toBeNull();
  } finally {
    release();
  }
});
