/** Native opaque-frame handshakes reject stale/foreign messages and clean up timeout, cancellation and destruction. */
import { expect, test } from 'vitest';
import { ScriptedFrame } from '../../../src/scripted/frame';
import { scriptedSettings } from '../../../src/scripted/options';
import { host } from '../render/fixture';
import { gate } from '../../unit/extensions/fixture';

test('only the current opaque session completes readiness and repeated/malformed notifications stay harmless', async () => {
  const container = host();
  const done = gate();
  const seen: unknown[] = [];
  const options = { scripts: true, popups: true, width: 300, height: 200 } satisfies Parameters<
    typeof scriptedSettings
  >[0];
  const view = new ScriptedFrame(container, options, scriptedSettings(options), (message) => {
    seen.push(message);
    if (message.type === 'message') {
      done.release();
    }
  });
  const token = 'opaque-frame-session';
  try {
    const source = `<script>
      parent.postMessage({folio:'stale',type:'ready'},'*');
      parent.postMessage({folio:'${token}',type:'unknown'},'*');
      parent.postMessage({folio:'${token}',type:'error',value:'Original error'},'*');
      parent.postMessage({folio:'${token}',type:'ready'},'*');
      parent.postMessage({folio:'${token}',type:'ready'},'*');
      parent.postMessage({folio:'${token}',type:'message',value:'"done"'},'*');
    </script>`;
    const loading = view.load(source, token, new AbortController().signal);
    window.postMessage({ folio: token, type: 'ready' }, '*');
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: location.origin,
        source: view.frame.contentWindow,
        data: { folio: token, type: 'ready' },
      }),
    );
    await loading;
    await done.promise;
    expect(seen).toEqual([
      { type: 'error', value: 'Original error' },
      { type: 'message', value: 'done' },
    ]);
    expect(view.frame.getAttribute('sandbox')).toBe('allow-scripts allow-popups');
    expect(view.frame.contentDocument).toBeNull();
    expect(view.frame.style.width).toBe('300px');
    expect(view.frame.style.height).toBe('200px');
  } finally {
    view.destroy();
    container.remove();
  }
});

test('readiness timeout, caller abort and terminal frame cleanup settle every pending wait', async () => {
  const container = host();
  const options = { scripts: true, loadTimeoutMs: 25 } satisfies Parameters<
    typeof scriptedSettings
  >[0];
  const view = new ScriptedFrame(container, options, scriptedSettings(options), () => {});
  try {
    await expect(
      view.load('<title>No handshake</title>', 'timeout', new AbortController().signal),
    ).rejects.toThrow('timed out');
    const controller = new AbortController();
    const rejected = expect(
      view.load('<title>Held handshake</title>', 'abort', controller.signal),
    ).rejects.toThrow();
    controller.abort();
    await rejected;
    const destroyed = expect(
      view.load('<title>Destroyed handshake</title>', 'destroy', new AbortController().signal),
    ).rejects.toThrow();
    view.destroy();
    await destroyed;
    await expect(view.load('', 'closed', new AbortController().signal)).rejects.toThrow(
      'destroyed',
    );
    expect(container.querySelector('iframe')).toBeNull();
  } finally {
    view.destroy();
    container.remove();
  }
});

test('invalid/inert containers reject before native event subscriptions or executable frame allocation', () => {
  const options = { scripts: true } satisfies Parameters<typeof scriptedSettings>[0];
  const inert = document.implementation.createHTMLDocument('Inert').body;
  const detached = document.createElement('div');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
  try {
    for (const container of [inert, detached, svg]) {
      expect(() => {
        Reflect.construct(ScriptedFrame, [container, options, scriptedSettings(options), () => {}]);
      }).toThrow('attached browser');
      expect(container.querySelector('iframe')).toBeNull();
    }
  } finally {
    svg.remove();
  }
});
