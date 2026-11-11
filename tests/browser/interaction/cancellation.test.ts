/** Link activations and deferred selection callbacks respect newer intents and terminal reader cleanup. */
import { expect, test } from 'vitest';
import { host } from '../render/fixture';
import { delayedLink } from './delayed-fixture';
import { interactionReader } from './fixture';

test('a newer link supersedes a delayed chapter and whenIdle follows the newest activation', async () => {
  const { book, started, release } = await delayedLink();
  const container = host();
  const reader = book.renderTo(container);
  try {
    await reader.display();
    const rejected = expect(reader.interactions.activate('../s2.xhtml')).rejects.toThrow();
    await started;
    const waiting = reader.interactions.whenIdle();
    await reader.interactions.activate('../s3.xhtml');
    await rejected;
    await waiting;
    release();
    await book.section(2)?.load();
    expect(reader.currentSection?.index).toBe(3);
    expect(reader.interactions.lastError).toBeNull();
    expect(container.querySelectorAll('iframe')).toHaveLength(1);
  } finally {
    release();
    book.destroy();
    container.remove();
  }
});

test('book destruction rejects an outstanding activation and suppresses late background errors', async () => {
  const { book, started, release } = await delayedLink();
  const container = host();
  const reader = book.renderTo(container);
  try {
    await reader.display();
    const rejected = expect(reader.interactions.activate('../s2.xhtml')).rejects.toThrow();
    await started;
    book.destroy();
    await rejected;
    expect(reader.interactions.lastError).toBeNull();
    expect(container.children).toHaveLength(0);
  } finally {
    release();
    book.destroy();
    container.remove();
  }
});

test('a synchronous link callback can destroy the reader without starting a new display', async () => {
  const { reader, container, release } = await interactionReader();
  try {
    reader.interactions.onLink(() => reader.destroy());
    await expect(reader.interactions.activate('../s2.xhtml')).rejects.toThrow();
    expect(container.children).toHaveLength(0);
  } finally {
    release();
  }
});
