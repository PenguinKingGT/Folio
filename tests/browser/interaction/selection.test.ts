/** Selection events preserve exact native text/Range/CFI mappings and release cached document ownership. */
import { expect, test } from 'vitest';
import { rangeFromCfi } from '../../../src/index';
import { interactionReader, selectText } from './fixture';

test('captures a cloned Unicode selection and deduplicates explicit/native notifications', async () => {
  const { reader, release } = await interactionReader();
  try {
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing selectable content.');
    }
    const snapshots: (string | null)[] = [];
    const unsubscribe = reader.interactions.onSelection((selection) =>
      snapshots.push(selection?.text ?? null),
    );
    const native = selectText(document);
    const selected = reader.interactions.captureSelection();
    expect(selected?.text).toBe(native.toString());
    expect(selected?.text).toContain('😀');
    expect(selected?.range).not.toBe(native);
    expect(rangeFromCfi(document, selected?.cfi ?? '').toString()).toBe(native.toString());
    selected?.range.collapse(true);
    expect(document.getSelection()?.isCollapsed).toBe(false);
    reader.interactions.captureSelection(document);
    expect(snapshots).toHaveLength(1);
    document.getSelection()?.removeAllRanges();
    document.dispatchEvent(new Event('selectionchange'));
    await expect.poll(() => snapshots.at(-1)).toBeNull();
    expect(reader.interactions.selection).toBeNull();
    unsubscribe();
    unsubscribe();
    selectText(document);
    reader.interactions.captureSelection(document);
    expect(snapshots).toHaveLength(2);
  } finally {
    release();
  }
});

test('coalesces native selection work and clears snapshots when a chapter is replaced', async () => {
  const { reader, release } = await interactionReader();
  try {
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing selection document.');
    }
    let calls = 0;
    reader.interactions.onSelection(() => {
      calls += 1;
    });
    selectText(document);
    document.dispatchEvent(new Event('selectionchange'));
    document.dispatchEvent(new Event('selectionchange'));
    await reader.interactions.whenIdle();
    expect(calls).toBe(1);
    await reader.display(2);
    expect(reader.interactions.selection).toBeNull();
    expect(calls).toBe(2);
    expect(() => reader.interactions.captureSelection(document)).toThrow('belong');
    expect(reader.interactions.captureSelection()).toBeNull();
  } finally {
    release();
  }
});

test('ignores textless, head-only, and collapsed native ranges without inventing reading CFIs', async () => {
  const { reader, release } = await interactionReader();
  try {
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing boundary document.');
    }
    expect(reader.interactions.captureSelection()).toBeNull();
    const selection = document.getSelection();
    const range = document.createRange();
    const headText = document.createTextNode('Head only');
    document.head.appendChild(headText);
    range.selectNodeContents(headText);
    selection?.addRange(range);
    expect(reader.interactions.captureSelection()).toBeNull();
    selection?.removeAllRanges();
    const image = document.createElement('img');
    document.body.appendChild(image);
    range.selectNode(image);
    selection?.addRange(range);
    expect(reader.interactions.captureSelection()).toBeNull();
    selection?.removeAllRanges();
  } finally {
    release();
  }
});
