/** Passive links are inventoried and activated through reader policy instead of native iframe navigation. */
import { expect, test } from 'vitest';
import { interactionReader, click } from './fixture';

test('activates a nested anchor as a chapter-relative spine target and clears old event ownership', async () => {
  const { reader, release } = await interactionReader();
  try {
    const document = reader.getContents();
    const anchor = document?.getElementById('internal');
    const child = anchor?.firstElementChild;
    if (!document || !anchor || !child) {
      throw new Error('Missing internal hyperlink.');
    }
    expect(anchor.getAttribute('href')).toBeNull();
    expect(anchor.getAttribute('role')).toBe('link');
    expect(anchor.getAttribute('tabindex')).toBe('0');
    expect(reader.interactions.getLinks().map((link) => link.href)).toContain(
      '../s2.xhtml#start-2',
    );
    expect(click(child).defaultPrevented).toBe(true);
    await reader.interactions.whenIdle();
    expect(reader.currentSection?.index).toBe(2);
    expect(() => reader.interactions.getLinks(document)).toThrow('belong');
  } finally {
    release();
  }
});

test('emits safe outbound/resource links and supports cancellation of default internal navigation', async () => {
  const { reader, release } = await interactionReader();
  try {
    const links: string[] = [];
    const unsubscribe = reader.interactions.onLink((link) => {
      links.push(link.kind);
      if (link.kind === 'internal') {
        link.preventDefault();
      }
    });
    expect(await reader.interactions.activate('https://original.invalid/read')).toBeNull();
    expect(await reader.interactions.activate('mailto:reader@example.invalid')).toBeNull();
    expect(await reader.interactions.activate('../images/cover.jpg')).toBeNull();
    expect(await reader.interactions.activate('../s2.xhtml')).toBeNull();
    expect(reader.currentSection?.index).toBe(0);
    expect(links).toEqual(['external', 'external', 'resource', 'internal']);
    unsubscribe();
    unsubscribe();
    await reader.interactions.activate('#tail');
    expect(reader.currentSection?.index).toBe(0);
    expect(reader.currentLocation()?.start.displayed.page).toBeGreaterThan(1);
  } finally {
    release();
  }
});

test('resolves fragments against a preloaded continuous chapter rather than the current one', async () => {
  const { reader, release } = await interactionReader(true);
  try {
    await reader.display(4);
    await reader.interactions.activate('#end-3', 3);
    expect(reader.currentSection?.index).toBe(3);
    expect(reader.interactions.lastError).toBeNull();
  } finally {
    release();
  }
});

test('modified clicks notify the host without unexpectedly replacing the current chapter', async () => {
  const { reader, release } = await interactionReader();
  try {
    const anchor = reader.getContents()?.getElementById('internal');
    if (!anchor) {
      throw new Error('Missing modified hyperlink.');
    }
    let calls = 0;
    reader.interactions.onLink(() => {
      calls += 1;
    });
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey'] as const) {
      click(anchor, { [modifier]: true });
      await reader.interactions.whenIdle();
      expect(reader.currentSection?.index).toBe(0);
    }
    expect(calls).toBe(4);
  } finally {
    release();
  }
});

test('chapter links remain exact under fractional host positioning and CSS scaling', async () => {
  const { reader, container, release } = await interactionReader(true);
  try {
    container.style.transformOrigin = '0 0';
    container.style.transform = 'translateY(0.433333px) scale(0.8)';
    await reader.interactions.activate('../s2.xhtml#start-2');
    expect(reader.currentSection?.index).toBe(2);
    expect(reader.currentLocation()?.start.index).toBe(2);
    expect(reader.getRenderedPages()[0]?.section.index).toBe(2);
  } finally {
    release();
  }
});

test('refreshes newly inserted links and does not trust forged or executable source metadata', async () => {
  const { reader, release } = await interactionReader();
  try {
    const document = reader.getContents();
    if (!document) {
      throw new Error('Missing passive document.');
    }
    expect(
      reader.interactions.getLinks().some((link) => ['forged', 'unsafe'].includes(link.element.id)),
    ).toBe(false);
    const anchor = document.createElement('a');
    anchor.href = '../s3.xhtml';
    anchor.textContent = 'Dynamic chapter';
    document.body.appendChild(anchor);
    await expect.poll(() => anchor.getAttribute('href')).toBeNull();
    expect(reader.interactions.getLinks().some((link) => link.element === anchor)).toBe(true);
    click(anchor);
    await reader.interactions.whenIdle();
    expect(reader.currentSection?.index).toBe(3);
  } finally {
    release();
  }
});
