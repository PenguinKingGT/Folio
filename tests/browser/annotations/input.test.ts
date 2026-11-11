/** Host overlay activation works independently of frame scripts and reads current annotation metadata. */
import { expect, test } from 'vitest';
import { annotationReader, annotationGroup } from './fixture';

test('interactive annotations support mouse/keyboard activation and use updated payloads', async () => {
  const { reader, cfi, release } = await annotationReader();
  try {
    const entry = reader.annotations.mark(cfi, {
      id: 'note',
      label: 'Open original note',
      data: 'first',
    });
    const group = annotationGroup(reader, entry.id);
    if (!group) {
      throw new Error('Missing interactive annotation.');
    }
    const values: unknown[] = [];
    const unsubscribe = reader.annotations.onClick((click) => values.push(click.annotation.data));
    group.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    reader.annotations.update(entry.id, { data: 'second' });
    expect(annotationGroup(reader, entry.id)).toBe(group);
    group.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    );
    group.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
    );
    group.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true }));
    expect(values).toEqual(['first', 'second', 'second']);
    group.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true }),
    );
    group.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    group.dispatchEvent(new MouseEvent('click', { button: 1, bubbles: true }));
    expect(values).toHaveLength(3);
    reader.annotations.hide();
    group.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(values).toHaveLength(3);
    reader.annotations.show();
    reader.annotations.update(entry.id, { interactive: false });
    group.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(group.getAttribute('tabindex')).toBeNull();
    expect(values).toHaveLength(3);
    unsubscribe();
    unsubscribe();
  } finally {
    release();
  }
});

test('passive highlights preserve selection interaction and do not acquire keyboard focus', async () => {
  const { reader, cfi, release } = await annotationReader();
  try {
    const entry = reader.annotations.highlight(cfi);
    const group = annotationGroup(reader, entry.id);
    if (!group) {
      throw new Error('Missing passive annotation.');
    }
    let clicks = 0;
    reader.annotations.onClick(() => {
      clicks += 1;
    });
    expect(group.style.pointerEvents).toBe('none');
    expect(group.getAttribute('role')).toBeNull();
    group.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    reader.annotations.element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(clicks).toBe(0);
  } finally {
    release();
  }
});
