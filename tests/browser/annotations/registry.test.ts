/** Annotation registration changes overlay geometry while preserving publication text, native ranges, and CFI paths. */
import { expect, test } from 'vitest';
import { Cfi, rangeFromCfi } from '../../../src/index';
import { annotationReader, annotationGroup } from './fixture';

test('adds all annotation kinds outside the chapter DOM and supports atomic metadata/style updates', async () => {
  const { reader, document, cfi, release } = await annotationReader();
  try {
    const html = document.body.innerHTML;
    const text = rangeFromCfi(document, cfi).toString();
    const highlight = reader.annotations.highlight(cfi, {
      id: 'highlight',
      data: { note: 'Original' },
    });
    const underlined = reader.annotations.underline(cfi, { id: 'underline' });
    const marked = reader.annotations.mark(new Cfi(cfi).collapse().toString(), {
      id: 'mark',
      label: 'Original mark',
    });
    expect(document.body.innerHTML).toBe(html);
    expect(rangeFromCfi(document, cfi).toString()).toBe(text);
    expect(reader.annotations.element.ownerDocument).not.toBe(document);
    expect(annotationGroup(reader, highlight.id)?.querySelectorAll('rect').length).toBeGreaterThan(
      0,
    );
    expect(annotationGroup(reader, underlined.id)?.querySelectorAll('line').length).toBeGreaterThan(
      0,
    );
    expect(annotationGroup(reader, marked.id)?.getAttribute('role')).toBe('button');
    const changed = reader.annotations.update(highlight.id, {
      style: { color: '#112233', opacity: 0.7 },
      interactive: true,
      label: 'Updated highlight',
      data: null,
    });
    expect(changed.style.color).toBe('#112233');
    expect(changed.data).toBeNull();
    expect(annotationGroup(reader, highlight.id)?.querySelector('rect')?.getAttribute('fill')).toBe(
      '#112233',
    );
    expect(reader.annotations.get(highlight.id)).toBe(changed);
    expect(reader.annotations.all()).toHaveLength(3);
    expect(reader.annotations.remove(highlight.id)).toBe(true);
    expect(reader.annotations.remove(highlight.id)).toBe(false);
    expect(reader.annotations.get(highlight.id)).toBeNull();
    expect(annotationGroup(reader, highlight.id)).toBeNull();
    reader.annotations.clear();
    expect(reader.annotations.all()).toEqual([]);
    expect(reader.annotations.element.querySelectorAll('g')).toHaveLength(0);
  } finally {
    release();
  }
});

test('rejects invalid loaded targets and CSS values without retaining partial registrations', async () => {
  const { reader, cfi, release } = await annotationReader();
  try {
    const invalid = 'epubcfi(/6/2[chapter]!/4/200,/1:0,/1:5)';
    expect(() => reader.annotations.highlight(invalid)).toThrow();
    expect(() => reader.annotations.mark(cfi, { style: { color: 'not-a-color' } })).toThrow(
      'color',
    );
    expect(reader.annotations.all()).toEqual([]);
    const valid = reader.annotations.highlight(cfi, { id: 'valid' });
    expect(() => reader.annotations.update(valid.id, { cfi: invalid })).toThrow();
    expect(reader.annotations.get(valid.id)).toBe(valid);
    expect(() => reader.annotations.update('missing', {})).toThrow('Unknown');
  } finally {
    release();
  }
});

test('preserves registrations and geometry through annotation/reader visibility changes', async () => {
  const { reader, cfi, release } = await annotationReader();
  try {
    reader.annotations.highlight(cfi);
    reader.annotations.hide();
    expect(reader.annotations.element.style.display).toBe('none');
    reader.hide();
    reader.show();
    expect(reader.annotations.element.style.display).toBe('none');
    reader.annotations.show();
    expect(reader.annotations.element.style.display).toBe('block');
    reader.hide();
    expect(reader.annotations.element.style.display).toBe('none');
    reader.show();
    expect(reader.annotations.element.style.display).toBe('block');
    reader.annotations.refresh();
    expect(reader.annotations.all()).toHaveLength(1);
  } finally {
    release();
  }
});
