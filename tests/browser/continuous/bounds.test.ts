/** Reject incompatible or insufficient continuous windows without dropping requested readable content. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { setDimension } from '../../../src/render/surface';
import { host } from '../render/fixture';
import { bookZip } from '../../unit/book/fixture';
import { continuousFiles, continuousChapter } from './fixture';

test('incompatible block axes produce observable segmented windows in both directions', async () => {
  const files = continuousFiles(5);
  files.set('OPS/s1.xhtml', continuousChapter(1, 100, 'vertical-rl'));
  files.set('OPS/s3.xhtml', continuousChapter(3, 100, 'vertical-lr'));
  const publication = await Book.open(bookZip(files));
  const container = host();
  const reader = publication.renderContinuous(container);
  try {
    await reader.display(2);
    await expect(reader.whenIdle()).rejects.toThrow('neighbor');
    expect(reader.loadedSections.map((section) => section.index)).toEqual([2]);
    expect(reader.currentSection?.index).toBe(2);
    await reader.display(1);
    expect(reader.flowState?.axis).toBe('horizontal');
    expect(reader.flowState?.reverse).toBe(true);
    expect(reader.loadedSections.map((section) => section.index)).toEqual([1]);
    await reader.display(3);
    expect(reader.flowState?.reverse).toBe(false);
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('reports insufficient view capacity for many tiny chapters instead of silently hiding the gap', async () => {
  const publication = await Book.open(bookZip(continuousFiles(20, 0)));
  const container = host();
  const reader = publication.renderContinuous(container, { maxViews: 3 });
  try {
    await reader.display(5);
    await expect(reader.whenIdle()).rejects.toThrow('neighbor');
    expect(reader.loadedSections).toHaveLength(3);
    expect(reader.currentSection?.index).toBe(5);
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('invalid CSS lengths retain previously valid dimensions', () => {
  const container = host();
  try {
    setDimension(container, 'width', 200);
    expect(() => setDimension(container, 'width', 'invalid')).toThrow('Invalid CSS');
    expect(container.style.width).toBe('200px');
  } finally {
    container.remove();
  }
});
