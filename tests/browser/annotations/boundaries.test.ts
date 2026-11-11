/** Native target validation respects body ownership, assertion recovery, atomic content, and terminal cleanup. */
import { expect, test } from 'vitest';
import { Annotations, cfiFromNode } from '../../../src/index';
import { annotationReader, annotationGroup } from './fixture';
import { host } from '../render/fixture';

test('rejects assertions that leave the body or resolve a nominal range to collapsed/textless content', async () => {
  const { reader, document, release } = await annotationReader();
  try {
    document.head.id = 'head-target';
    expect(() => reader.annotations.mark('epubcfi(/6/2[chapter]!/4[head-target])')).toThrow(
      'reading text',
    );
    expect(() =>
      reader.annotations.highlight('epubcfi(/6/2[chapter]!/4,/2[selection]/1:0,/4[selection]/1:0)'),
    ).toThrow('reading text');
    const first = document.createElement('img');
    first.id = 'image-a';
    const second = document.createElement('img');
    second.id = 'image-b';
    first.style.cssText = 'width:30px;height:30px';
    second.style.cssText = 'width:30px;height:30px';
    document.body.prepend(first, second);
    expect(() =>
      reader.annotations.highlight('epubcfi(/6/2[chapter]!/4,/2[image-a],/4[image-b])'),
    ).toThrow('reading text');
    const cfi = cfiFromNode(first, { base: '/6/2[chapter]' }).toString();
    const mark = reader.annotations.mark(cfi);
    expect(annotationGroup(reader, mark.id)?.querySelectorAll('rect')).toHaveLength(1);
    expect(reader.annotations.all()).toHaveLength(1);
  } finally {
    release();
  }
});

test('failed standalone construction cleans up its overlay and invalid surfaces fail before allocation', async () => {
  const { book, reader, release } = await annotationReader();
  const surface = host();
  try {
    expect(() => new Annotations(book, reader, document.createElement('div'))).toThrow('attached');
    expect(
      () =>
        new Annotations(
          book,
          {
            getRenderedPages: () => [],
            onRelocated: () => {
              throw new Error('Subscription failure');
            },
          },
          surface,
        ),
    ).toThrow('Subscription failure');
    expect(surface.children).toHaveLength(0);
  } finally {
    release();
    surface.remove();
  }
});

test('destruction releases scheduled geometry and rejects further registration/subscription work', async () => {
  const { reader, cfi, container, release } = await annotationReader();
  try {
    reader.annotations.mark(cfi);
    reader.annotations.element.dispatchEvent(new Event('scroll', { bubbles: true }));
    reader.destroy();
    reader.annotations.destroy();
    reader.annotations.refresh();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(container.children).toHaveLength(0);
    expect(reader.annotations.lastError).toBeNull();
    expect(() => reader.annotations.mark(cfi)).toThrow('destroyed');
    expect(() => reader.annotations.onClick(() => {})).toThrow('destroyed');
    await expect(reader.annotations.whenIdle()).rejects.toThrow('destroyed');
  } finally {
    release();
  }
});
