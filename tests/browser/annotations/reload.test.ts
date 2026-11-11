/** Annotation registrations survive native document replacement, continuous trimming, and page movement. */
import { expect, test } from 'vitest';
import { rangeFromCfi } from '../../../src/index';
import { annotationReader, annotationGroup } from './fixture';

for (const continuous of [false, true]) {
  test(`restores annotations after ${continuous ? 'continuous trimming' : 'chapter reload'}`, async () => {
    const { reader, document, cfi, release } = await annotationReader(continuous);
    try {
      const annotation = reader.annotations.highlight(cfi, { id: 'persistent' });
      const text = rangeFromCfi(document, cfi).toString();
      await reader.display(4);
      await reader.annotations.whenIdle();
      expect(annotationGroup(reader, annotation.id)).toBeNull();
      expect(reader.annotations.all()).toHaveLength(1);
      await reader.display(0);
      await reader.annotations.whenIdle();
      const restored = reader.getContents();
      if (!restored) {
        throw new Error('Missing restored annotated chapter.');
      }
      expect(restored).not.toBe(document);
      expect(rangeFromCfi(restored, cfi).toString()).toBe(text);
      expect(
        annotationGroup(reader, annotation.id)?.querySelectorAll('rect').length,
      ).toBeGreaterThan(0);
      await reader.next();
      await reader.annotations.whenIdle();
      expect(annotationGroup(reader, annotation.id)).toBeNull();
      await reader.prev();
      await reader.annotations.whenIdle();
      expect(annotationGroup(reader, annotation.id)).not.toBeNull();
    } finally {
      release();
    }
  });
}

test('reports invalid unloaded targets without blocking readable content and recovers after removal', async () => {
  const { reader, release } = await annotationReader();
  try {
    const errors: unknown[] = [];
    const unsubscribe = reader.annotations.onError((error) => errors.push(error));
    const annotation = reader.annotations.highlight('epubcfi(/6/6[s2]!/4/200,/1:0,/1:5)');
    expect(reader.annotations.lastError).toBeNull();
    await reader.display(2);
    expect(reader.currentSection?.index).toBe(2);
    await expect(reader.annotations.whenIdle()).rejects.toThrow('could not be rendered');
    expect(errors.length).toBeGreaterThan(0);
    reader.annotations.remove(annotation.id);
    await reader.annotations.whenIdle();
    expect(reader.annotations.lastError).toBeNull();
    unsubscribe();
    unsubscribe();
  } finally {
    release();
  }
});

test('clips offscreen mark targets instead of pinning badges to the viewport edge', async () => {
  const { reader, cfi, release } = await annotationReader();
  try {
    const annotation = reader.annotations.mark(cfi);
    expect(annotationGroup(reader, annotation.id)).not.toBeNull();
    await reader.next();
    await reader.annotations.whenIdle();
    expect(annotationGroup(reader, annotation.id)).toBeNull();
    await reader.prev();
    await reader.annotations.whenIdle();
    expect(annotationGroup(reader, annotation.id)).not.toBeNull();
  } finally {
    release();
  }
});

test('moves a registration to another chapter without leaving geometry at its previous target', async () => {
  const { reader, cfi, release } = await annotationReader();
  try {
    const annotation = reader.annotations.highlight(cfi, { id: 'moving' });
    const target = 'epubcfi(/6/6[s2]!/4/4,/1:0,/1:5)';
    const updated = reader.annotations.update(annotation.id, { cfi: target });
    expect(updated.sectionIndex).toBe(2);
    expect(annotationGroup(reader, annotation.id)).toBeNull();
    await reader.display(2);
    await reader.annotations.whenIdle();
    expect(reader.annotations.get(annotation.id)?.cfi).toBe(target);
    expect(annotationGroup(reader, annotation.id)).not.toBeNull();
    expect(reader.annotations.all()).toHaveLength(1);
  } finally {
    release();
  }
});
