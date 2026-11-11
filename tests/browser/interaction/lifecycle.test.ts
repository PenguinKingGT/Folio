/** Interaction ownership rejects foreign documents and releases listeners, deferred selection work, and retained errors. */
import { expect, test } from 'vitest';
import { Book } from '../../../src/index';
import { bookZip } from '../../unit/book/fixture';
import { interactionReader, interactionFiles, selectText, click } from './fixture';

test('rejects invalid document/section ownership and duplicate bindings', async () => {
  const { reader, book, release } = await interactionReader();
  const foreign = await Book.open(bookZip(interactionFiles()));
  try {
    const ownSection = book.section(0);
    const otherSection = foreign.section(0);
    const document = reader.getContents();
    if (!ownSection || !otherSection || !document) {
      throw new Error('Missing document ownership fixtures.');
    }
    expect(() => reader.interactions.attach(document, otherSection)).toThrow('Foreign');
    expect(() => reader.interactions.attach(document, ownSection)).toThrow('already attached');
    expect(() => reader.interactions.attach(window.document, ownSection)).toThrow('mounted');
    expect(() => reader.interactions.captureSelection(window.document)).toThrow('belong');
  } finally {
    foreign.destroy();
    release();
  }
});

test('reports invalid activation promises and native background errors without poisoning later navigation', async () => {
  const { reader, release } = await interactionReader();
  try {
    const failures: unknown[] = [];
    const unsubscribe = reader.interactions.onError((error) => failures.push(error));
    await expect(reader.interactions.activate('javascript:alert(1)')).rejects.toThrow();
    await expect(reader.interactions.whenIdle()).rejects.toThrow();
    expect(reader.interactions.lastError).toBeInstanceOf(Error);
    await expect(reader.interactions.activate('#tail', 99)).rejects.toThrow('origin');
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing error document.');
    }
    const bad = document.createElement('a');
    bad.href = '../../../outside.xhtml';
    document.body.appendChild(bad);
    reader.interactions.getLinks();
    click(bad);
    await expect(reader.interactions.whenIdle()).rejects.toThrow();
    expect(failures).toHaveLength(3);
    unsubscribe();
    unsubscribe();
    await reader.interactions.activate('../s2.xhtml');
    expect(reader.interactions.lastError).toBeNull();
    expect(reader.currentSection?.index).toBe(2);
  } finally {
    release();
  }
});

test('cancels queued selection work and rejects operations after reader destruction', async () => {
  const { reader, release } = await interactionReader();
  try {
    const document = reader.getContents();
    const realm = document?.defaultView;
    if (!document || !realm) {
      throw new Error('Missing disposable document.');
    }
    let calls = 0;
    reader.interactions.onSelection(() => {
      calls += 1;
    });
    selectText(document);
    reader.interactions.captureSelection();
    document.dispatchEvent(new realm.Event('selectionchange'));
    const event = new realm.KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    reader.destroy();
    reader.interactions.destroy();
    document.body.dispatchEvent(event);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(calls).toBe(1);
    expect(reader.interactions.selection).toBeNull();
    expect(() => reader.interactions.captureSelection()).toThrow('destroyed');
    expect(() => reader.interactions.getLinks()).toThrow('destroyed');
    expect(() => reader.interactions.activate('#tail')).toThrow('destroyed');
    await expect(reader.interactions.whenIdle()).rejects.toThrow('destroyed');
    expect(() => reader.interactions.onSelection(() => {})).toThrow('destroyed');
  } finally {
    release();
  }
});
