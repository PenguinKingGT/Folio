/** Continuous-reader errors are observable without committing stale or unbounded views. */
import { afterEach, expect, test } from 'vitest';
import { Book, ContinuousReader } from '../../../src/index';
import type { Book as Publication } from '../../../src/index';
import { host } from '../render/fixture';
import { bookZip } from '../../unit/book/fixture';
import { continuousFiles, continuousBook, continuousChapter } from './fixture';

const opened: { publication: Publication; container: HTMLElement }[] = [];
afterEach(() =>
  opened.splice(0).forEach(({ publication, container }) => {
    publication.destroy();
    container.remove();
  }),
);

/** Register a host/book pair independently of whether construction succeeds. */
function setup(publication: Publication) {
  const container = host();
  opened.push({ publication, container });
  return container;
}

test('validates view-window and browser options before leaving any owned DOM behind', async () => {
  const publication = await continuousBook();
  const container = setup(publication);
  const render = publication.renderContinuous.bind(publication);
  for (const options of [
    { preloadBefore: 0 },
    { preloadAfter: 5 },
    { maxViews: 2 },
    { maxViews: 129 },
    { width: -1 },
    { height: 'invalid' },
    { loadTimeoutMs: 0 },
    { direction: 'up' },
  ]) {
    expect(() => {
      Reflect.apply(render, undefined, [container, options]);
    }).toThrow();
    expect(container.children).toHaveLength(0);
  }
  expect(() => publication.renderContinuous('#missing-continuous-reader')).toThrow('not found');
});

test('reports optional neighbor failures while leaving the requested valid chapter readable', async () => {
  const files = continuousFiles(3);
  files.delete('OPS/s1.xhtml');
  const publication = await Book.open(bookZip(files));
  const reader = publication.renderContinuous(setup(publication));
  const failures: unknown[] = [];
  const release = reader.onError((error) => failures.push(error));
  expect((await reader.display())?.index).toBe(0);
  await expect(reader.whenIdle()).rejects.toThrow('neighbor');
  expect(reader.currentSection?.index).toBe(0);
  expect(reader.getContents()?.body.textContent).toContain('Chapter 0');
  expect(failures).toHaveLength(1);
  release();
  release();
  await reader.display(2);
  expect(failures).toHaveLength(1);
});

test('a primary failure retains prior content and does not create an automatic retry loop', async () => {
  const files = continuousFiles(4);
  files.delete('OPS/s3.xhtml');
  const publication = await Book.open(bookZip(files));
  const reader = publication.renderContinuous(setup(publication));
  await reader.display();
  const original = reader.getContents();
  const failures: unknown[] = [];
  reader.onError((error) => failures.push(error));
  await expect(reader.display(3)).rejects.toThrow();
  await expect(reader.whenIdle()).rejects.toThrow();
  expect(failures).toHaveLength(1);
  expect(reader.getContents()).toBe(original);
  await reader.display(0);
  await reader.whenIdle();
  expect(reader.lastError).toBeNull();
});

test('rejects unbounded CSS expansion and oversized chapter geometry', async () => {
  for (const style of ['p{height:100vh}h2{height:20px}', 'body{height:2000000px!important}']) {
    const files = continuousFiles(1);
    files.set(
      'OPS/text/chapter one.xhtml',
      continuousChapter(0).replace('</style>', `${style}</style>`),
    );
    const publication = await Book.open(bookZip(files));
    const container = setup(publication);
    const reader = publication.renderContinuous(container);
    await expect(reader.display()).rejects.toThrow('extent');
    expect(reader.getLoadedPages()).toEqual([]);
    expect(container.querySelectorAll('iframe')).toHaveLength(0);
  }
});

test('rejects invalid display targets and exposes explicit reader destruction consistently', async () => {
  const publication = await continuousBook();
  const container = setup(publication);
  const reader = new ContinuousReader(publication, container);
  await expect(reader.display(99)).rejects.toThrow('spine');
  reader.layout();
  reader.destroy();
  reader.destroy();
  expect(container.children).toHaveLength(0);
  expect(reader.loadedSections).toEqual([]);
  expect(reader.currentSection).toBeNull();
  await expect(reader.display()).rejects.toThrow('destroyed');
  await expect(reader.whenIdle()).rejects.toThrow('destroyed');
  await expect(reader.next()).rejects.toThrow('destroyed');
  expect(() => reader.getContents()).toThrow('destroyed');
  expect(() => reader.onRelocated(() => {})).toThrow('destroyed');
});
