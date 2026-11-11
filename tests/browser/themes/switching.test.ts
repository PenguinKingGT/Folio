/** Theme switching must preserve authored DOM/CFIs and apply to current, future, and independently mounted readers. */
import { expect, test } from 'vitest';
import { themedBook } from './fixture';

test('registers CSS, URL and rules before display and composes default, selected, and override styles', async () => {
  const { book, container, release } = await themedBook();
  const reader = book.renderTo(container);
  try {
    await reader.themes.registerRules('default', { body: { 'background-color': 'white' } });
    await reader.themes.registerUrl('night', 'themes/night.css');
    await reader.themes.select('night');
    expect(reader.themes.current).toBe('night');
    expect(reader.themes.names).toEqual(['default', 'night']);
    await reader.display(3);
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing themed document.');
    }
    expect(document.defaultView?.getComputedStyle(document.body).backgroundColor).toBe(
      'rgb(10, 20, 30)',
    );
    expect(
      document.defaultView?.getComputedStyle(document.querySelector('p') ?? document.body).color,
    ).toBe('rgb(230, 240, 250)');
    expect(document.body.className).toBe('');
    await reader.themes.override('color', 'rgb(1,2,3)', { selector: 'p', important: true });
    await reader.themes.registerCss('night', 'p{color:rgb(4,5,6)}');
    expect(
      document.defaultView?.getComputedStyle(document.querySelector('p') ?? document.body).color,
    ).toBe('rgb(1, 2, 3)');
    await reader.themes.removeOverride('color');
    await reader.themes.removeOverride('color');
    expect(
      document.defaultView?.getComputedStyle(document.querySelector('p') ?? document.body).color,
    ).toBe('rgb(4, 5, 6)');
    await reader.themes.select('default');
    await reader.themes.select('default');
    expect(document.defaultView?.getComputedStyle(document.body).backgroundColor).toBe(
      'rgb(255, 255, 255)',
    );
    expect(document.querySelectorAll('[data-folio-theme]')).toHaveLength(1);
  } finally {
    release();
  }
});

test('keeps styles independent between readers and applies the active theme to subsequent chapters', async () => {
  const { book, container, release } = await themedBook();
  const first = book.renderTo(container);
  const second = book.renderTo(container);
  try {
    await first.themes.registerCss('default', 'p{color:rgb(1,2,3)}');
    await first.display(0);
    await second.display(0);
    expect(second.getContents()?.querySelector('[data-folio-theme]')).toBeNull();
    await first.display(3);
    const document = first.getContents();
    expect(document?.querySelector('[data-folio-theme]')?.textContent).toContain('rgb(1,2,3)');
    first.themes.destroy();
    first.themes.destroy();
    expect(document?.querySelector('[data-folio-theme]')).toBeNull();
    await expect(first.themes.select('default')).rejects.toThrow('destroyed');
    expect(second.getContents()).not.toBeNull();
  } finally {
    release();
  }
});

test('failed registrations and unknown selections retain valid styles and do not block later chapter display', async () => {
  const { book, container, release } = await themedBook();
  const reader = book.renderTo(container);
  try {
    await reader.themes.registerCss('default', 'p{color:red}');
    await reader.display();
    await expect(reader.themes.registerCss('default', 'p{broken}')).rejects.toThrow();
    await expect(reader.themes.select('unknown')).rejects.toThrow('Unknown');
    await expect(reader.themes.whenIdle()).rejects.toThrow('Unknown');
    await reader.display(3);
    expect(reader.getContents()?.querySelector('[data-folio-theme]')?.textContent).toContain(
      'color:red',
    );
    expect(reader.themes.current).toBe('default');
    await expect(reader.themes.registerCss('bad name', 'p{}')).rejects.toThrow('name');
    await expect(reader.themes.fontSize(0)).rejects.toThrow('positive');
    await expect(reader.themes.fontSize('invalid')).rejects.toThrow('font size');
  } finally {
    release();
  }
});
