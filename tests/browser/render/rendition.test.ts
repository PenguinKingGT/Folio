/** Test actual iframe display, dimensions, visibility, chapter switching and ownership. */
import { expect, test } from 'vitest';
import { Rendition } from '../../../src/index';
import { book, delayedBook, host, xhtml } from './fixture';

test('mounts a hidden surface and displays native chapter contents', async () => {
  const publication = await book();
  const container = host();
  container.id = 'original-reader';
  const reader = publication.renderTo('#original-reader', { width: '100%', height: 120 });
  try {
    expect(reader.getContents()).toBeNull();
    expect(reader.currentSection).toBeNull();
    reader.show();
    expect(reader.frame.hidden).toBe(true);
    expect((await reader.display()).index).toBe(0);
    expect(reader.getContents()?.body.textContent).toBe('Original chapter text');
    expect(reader.currentSection?.index).toBe(0);
    expect(reader.frame.getBoundingClientRect().width).toBe(320);
    expect(reader.frame.getBoundingClientRect().height).toBe(120);
    expect(reader.frame.sandbox.contains('allow-scripts')).toBe(false);
    reader.hide();
    expect(getComputedStyle(reader.frame).display).toBe('none');
    await reader.display();
    expect(reader.frame.hidden).toBe(true);
    reader.show();
    expect(getComputedStyle(reader.frame).display).toBe('block');
    reader.destroy();
    reader.destroy();
    expect(container.children.length).toBe(0);
    expect(() => reader.getContents()).toThrow('destroyed');
    await expect(reader.display()).rejects.toThrow('destroyed');
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('book destruction owns every mounted reader and direct readers can be released separately', async () => {
  const publication = await book();
  const container = host();
  const first = publication.renderTo(container);
  const second = publication.renderTo(container);
  await Promise.all([first.display(), second.display()]);
  expect(container.children.length).toBe(2);
  publication.destroy();
  expect(container.children.length).toBe(0);
  expect(() => publication.renderTo(container)).toThrow();
  const other = await book();
  const direct = new Rendition(other, container);
  direct.destroy();
  other.destroy();
  container.remove();
});

test('fails missing targets, invalid dimensions and out-of-range chapters', async () => {
  const publication = await book();
  const container = host();
  try {
    expect(() => publication.renderTo('#missing-reader')).toThrow('not found');
    expect(() => publication.renderTo(document.createElement('div'))).toThrow('attached');
    expect(() => publication.renderTo(container, { width: -1 })).toThrow(RangeError);
    expect(() => publication.renderTo(container, { height: 'invalid-value' })).toThrow(TypeError);
    expect(() => publication.renderTo(container, { loadTimeoutMs: 0 })).toThrow(RangeError);
    const reader = publication.renderTo(container, { width: 300, height: '200px' });
    await expect(reader.display(99)).rejects.toThrow('spine');
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('accepts prefixed XHTML and creates a missing head before inserting CSP', async () => {
  const publication = await book(
    xhtml
      .replaceAll('<html', '<h:html')
      .replaceAll('</html>', '</h:html>')
      .replace('xmlns=', 'xmlns:h=')
      .replaceAll('<head/>', '')
      .replace('<body>', '<h:body>')
      .replace('</body>', '</h:body>')
      .replace('<p>', '<h:p>')
      .replace('</p>', '</h:p>'),
  );
  const container = host();
  try {
    const reader = publication.renderTo(container);
    await reader.display();
    expect(reader.getContents()?.body.textContent).toBe('Original chapter');
    expect(reader.getContents()?.head.firstElementChild?.getAttribute('http-equiv')).toBe(
      'Content-Security-Policy',
    );
  } finally {
    publication.destroy();
    container.remove();
  }
});

test('a newer display cancels the old wait without allowing late content to replace it', async () => {
  const { publication, release } = await delayedBook();
  const container = host();
  const reader = publication.renderTo(container);
  try {
    const older = reader.display(0);
    const rejected = expect(older).rejects.toThrow();
    await reader.display(1);
    await rejected;
    release();
    await publication.section(0)?.load();
    expect(reader.currentSection?.idref).toBe('second');
    expect(reader.getContents()?.body.textContent).toBe('Second chapter');
  } finally {
    release();
    publication.destroy();
    container.remove();
  }
});
