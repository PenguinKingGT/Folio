/** Concurrent theme and chapter requests retain only the latest intent and release independently cancelled consumers. */
import { expect, test } from 'vitest';
import { host } from '../render/fixture';
import { delayedTheme } from './delayed-fixture';

test('supersedes a pending theme without waiting for its uncooperative producer', async () => {
  const { book, started, release } = await delayedTheme();
  const container = host();
  const reader = book.renderTo(container);
  try {
    await reader.display();
    const rejected = expect(reader.themes.registerUrl('slow', 'held.css')).rejects.toThrow();
    await started;
    const waiting = reader.themes.whenIdle();
    await reader.themes.registerRules('fast', { p: { color: 'green' } });
    await reader.themes.select('fast');
    await waiting;
    await rejected;
    release();
    expect(reader.themes.names).not.toContain('slow');
    expect(reader.themes.current).toBe('fast');
    expect(reader.getContents()?.querySelector('[data-folio-theme]')?.textContent).toContain(
      'color:green',
    );
  } finally {
    release();
    book.destroy();
    container.remove();
  }
});

test('a newer chapter request cancels a theme wait while the shared theme mutation can complete', async () => {
  const { book, started, release } = await delayedTheme();
  const container = host();
  const reader = book.renderTo(container);
  try {
    const registration = reader.themes.registerUrl('default', 'held.css');
    await started;
    const rejected = expect(reader.display(3)).rejects.toThrow();
    const latest = reader.display(4);
    await rejected;
    release();
    await registration;
    await latest;
    expect(reader.currentSection?.index).toBe(4);
    expect(reader.getContents()?.querySelector('[data-folio-theme]')?.textContent).toContain(
      'color:red',
    );
  } finally {
    release();
    book.destroy();
    container.remove();
  }
});

test('book destruction aborts pending theme consumers and clears every reader-owned surface', async () => {
  const { book, started, release } = await delayedTheme();
  const container = host();
  const reader = book.renderContinuous(container);
  try {
    const rejected = expect(reader.themes.registerUrl('slow', 'held.css')).rejects.toThrow();
    await started;
    book.destroy();
    await rejected;
    expect(container.children).toHaveLength(0);
    await expect(reader.themes.override('color', 'red')).rejects.toThrow('destroyed');
  } finally {
    release();
    book.destroy();
    container.remove();
  }
});
