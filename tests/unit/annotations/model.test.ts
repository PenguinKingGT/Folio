/** Annotation registration validates publication identity, styles, and atomic updates without chapter IO. */
import { expect, test, vi } from 'vitest';
import { Book } from '../../../src/index';
import { AnnotationStore } from '../../../src/annotations/store';
import { annotationModel, annotationTarget } from '../../../src/annotations/model';
import { bookZip } from '../book/fixture';

const point = 'epubcfi(/6/2[chapter]!/4/2/1:0)';
const range = 'epubcfi(/6/2[chapter]!/4/2,/1:0,/1:5)';

test('keeps immutable registrations and updates separate from chapter loading and payload ownership', async () => {
  const book = await Book.open(bookZip());
  const reads = vi.spyOn(book, 'text');
  try {
    const store = new AnnotationStore(book);
    const data = { note: 'Original note' };
    const mark = store.create('mark', point, { id: 'annotation-1', data });
    store.commit(mark);
    const highlighted = store.create('highlight', range, {
      style: { color: '#00ff00', opacity: 0.5 },
    });
    store.commit(highlighted);
    expect(highlighted.id).toBe('annotation-2');
    expect(highlighted.interactive).toBe(false);
    expect(mark.interactive).toBe(true);
    expect(Object.isFrozen(mark)).toBe(true);
    expect(Object.isFrozen(mark.style)).toBe(true);
    expect(Object.isFrozen(store.all())).toBe(true);
    expect(Object.isFrozen(data)).toBe(false);
    const changed = store.change(mark.id, {
      data: null,
      label: 'Updated note',
      interactive: false,
      cfi: range,
      style: { color: '#112233', size: 18 },
    });
    expect(store.get(mark.id)).toBe(mark);
    store.commit(changed);
    expect(store.get(mark.id)?.data).toBeNull();
    expect(store.get(mark.id)?.label).toBe('Updated note');
    expect(store.change(mark.id, {}).style).toEqual(changed.style);
    expect(store.create('underline', range, {}).type).toBe('underline');
    expect(store.remove(mark.id)).toBe(true);
    expect(store.remove(mark.id)).toBe(false);
    expect(store.get(mark.id)).toBeNull();
    store.clear();
    expect(store.all()).toEqual([]);
    expect(reads).not.toHaveBeenCalled();
  } finally {
    reads.mockRestore();
    book.destroy();
  }
});

test('rejects foreign and empty annotation targets', async () => {
  const book = await Book.open(bookZip());
  try {
    for (const cfi of [
      'epubcfi(/8/2[chapter]!/4/2)',
      'epubcfi(/6/2[other]!/4/2)',
      'epubcfi(/6/200[missing]!/4/2)',
      'epubcfi(/6/2[chapter]!/2/2)',
      'epubcfi(/6/2[chapter]/2!/4/2)',
      'epubcfi(/4/2)',
      'invalid',
    ]) {
      expect(() => annotationTarget(book, 'mark', cfi)).toThrow();
    }
    expect(() => annotationTarget(book, 'highlight', point)).toThrow('range');
    expect(() =>
      annotationTarget(book, 'underline', 'epubcfi(/6/2[chapter]!/4/2,/1:0,/1:0)'),
    ).toThrow('range');
    expect(() => {
      Reflect.apply(annotationTarget, undefined, [book, 'unknown', point]);
    }).toThrow('type');
  } finally {
    book.destroy();
  }
});

test('rejects malformed runtime options without publishing partial updates', async () => {
  const book = await Book.open(bookZip());
  try {
    const store = new AnnotationStore(book);
    for (const id of ['', 'x'.repeat(129), 'bad\nID', 1]) {
      expect(() => {
        Reflect.apply(annotationModel, undefined, [book, 'mark', point, id, {}]);
      }).toThrow();
    }
    for (const options of [
      null,
      [],
      { label: 1 },
      { label: 'x'.repeat(257) },
      { interactive: 1 },
      { style: null },
      { style: [] },
      { style: { opacity: 2 } },
      { style: { thickness: 0 } },
      { style: { size: Infinity } },
      { style: { color: '' } },
      { style: { color: '\nred' } },
      { style: { color: 'x'.repeat(257) } },
      { style: { color: 1 } },
    ]) {
      expect(() => {
        Reflect.apply(annotationModel, undefined, [book, 'mark', point, 'valid', options]);
      }).toThrow();
    }
    const mark = store.create('mark', point, { id: 'note' });
    store.commit(mark);
    expect(() => store.create('mark', point, { id: 'note' })).toThrow('registered');
    expect(() => store.change('missing', {})).toThrow('Unknown');
    for (const patch of [null, [], { style: null }, { style: [] }, { style: 'red' }]) {
      expect(() => {
        Reflect.apply(store.change.bind(store), undefined, ['note', patch]);
      }).toThrow();
    }
    expect(store.get('note')).toBe(mark);
  } finally {
    book.destroy();
  }
});

test('bounds registrations while permitting updates and monotonic identities after clearing', async () => {
  const book = await Book.open(bookZip());
  try {
    const store = new AnnotationStore(book);
    for (let index = 0; index < 4096; index += 1) {
      store.commit(store.create('mark', point, {}));
    }
    expect(() => store.create('mark', point, {})).toThrow('Too many');
    store.commit(store.change('annotation-1', { data: 'updated' }));
    expect(store.all()).toHaveLength(4096);
    store.clear();
    expect(store.create('mark', point, {}).id).not.toBe('annotation-1');
  } finally {
    book.destroy();
  }
});
