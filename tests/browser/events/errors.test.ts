/** Reader event forwarding preserves failure identity, cancellation, native input, and preventable links. */
import { expect, test } from 'vitest';
import { interactionReader } from '../interaction/fixture';

for (const continuous of [false, true]) {
  test(`${continuous ? 'continuous' : 'bounded'} display errors emit once and cancelled display intents stay silent`, async () => {
    const { reader, release } = await interactionReader(continuous);
    const errors: unknown[] = [];
    const displayed: number[] = [];
    reader.on('error', (error) => errors.push(error));
    reader.on('displayed', (section) => displayed.push(section.index));
    try {
      let rejected: unknown;
      try {
        await reader.display('missing.xhtml');
      } catch (error) {
        rejected = error;
      }
      expect(rejected).toBeInstanceOf(Error);
      expect(errors).toEqual([rejected]);
      const cancelled = expect(reader.display(2)).rejects.toThrow();
      await reader.display(0);
      await cancelled;
      expect(errors).toEqual([rejected]);
      expect(displayed).toEqual([0]);
      const failure = reader.interactions.activate('#tail', 999);
      await expect(failure).rejects.toThrow('origin');
      await expect(reader.interactions.whenIdle()).rejects.toThrow('origin');
      expect(errors).toHaveLength(2);
    } finally {
      release();
    }
  });

  test(`${continuous ? 'continuous' : 'bounded'} typed links can prevent default and native input remains synchronous`, async () => {
    const { reader, release } = await interactionReader(continuous);
    let input = '';
    let linked = 0;
    const stop = (link: { preventDefault: () => void }) => {
      linked += 1;
      link.preventDefault();
    };
    reader.on('link', stop);
    reader.once('input', (event) => {
      input = event.event.type;
    });
    try {
      const document = reader.getContents();
      const realm = document?.defaultView;
      if (!document || !realm) {
        throw new Error('Missing input realm.');
      }
      document.body.dispatchEvent(new realm.KeyboardEvent('keydown', { bubbles: true, key: 'A' }));
      expect(input).toBe('keydown');
      expect(await reader.interactions.activate('../s2.xhtml#start-2')).toBeNull();
      expect(reader.currentSection?.index).toBe(0);
      expect(linked).toBe(1);
      reader.off('link', stop);
      await reader.interactions.activate('../s2.xhtml#start-2');
      expect(reader.currentSection?.index).toBe(2);
      expect(linked).toBe(1);
    } finally {
      release();
    }
  });
}
