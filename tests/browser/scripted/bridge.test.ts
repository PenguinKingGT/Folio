/** Exercise the actual serialized bootstrap functions against an owned native window as well as opaque integration tests. */
import { expect, test } from 'vitest';
import { IframeView } from '../../../src/index';
import { bootstrap, readingSystem } from '../../../src/scripted/bridge';
import { scriptMessage } from '../../../src/scripted/protocol';
import type { ScriptMessage } from '../../../src/scripted/protocol';
import { prepareContent } from '../../../src/render/content';
import { host } from '../render/fixture';
import { gate } from '../../unit/extensions/fixture';

/** Invoke the installed native API through its runtime capability boundary without unchecked type assertions. */
function post(scope: Window, value: unknown): void {
  const api: unknown = Reflect.get(scope, 'folio');
  if (typeof api !== 'object' || api === null) {
    throw new Error('Missing publication message API.');
  }
  const callback: unknown = Reflect.get(api, 'postMessage');
  if (typeof callback !== 'function') {
    throw new Error('Missing publication message callback.');
  }
  Reflect.apply(callback, api, [value]);
}

test('installs immutable reading-system identity and reports only supported feature versions', () => {
  const system = readingSystem(
    { token: 'original', fragment: null, name: 'Original', version: '1.0' },
    window,
  );
  expect(Object.isFrozen(system)).toBe(true);
  expect(system.hasFeature('dom-manipulation')).toBe(true);
  expect(system.hasFeature('spine-scripting', '1.0')).toBe(true);
  expect(system.hasFeature('layout-changes', '2.0')).toBe(true);
  expect(system.hasFeature('unknown')).toBeUndefined();
  expect(system.hasFeature(1)).toBeUndefined();
  expect(typeof system.hasFeature('touch-events')).toBe('boolean');
});

test('real native bootstrap posts bounded JSON, script errors, rejection errors and a fragment-ready message', async () => {
  const container = host();
  const view = new IframeView(container);
  const token = 'native-bootstrap';
  const delivered = gate();
  const received: ScriptMessage[] = [];
  const listener = (event: MessageEvent<unknown>) => {
    const message = scriptMessage(event.data, token);
    if (message !== null) {
      received.push(message);
      if (message.type === 'ready') {
        delivered.release();
      }
    }
  };
  window.addEventListener('message', listener);
  try {
    const document = await view.load(
      prepareContent(
        '<html xmlns="http://www.w3.org/1999/xhtml"><body><p id="target">Original</p></body></html>',
        'native',
      ),
      'native',
    );
    const scope = document.defaultView;
    if (!scope) {
      throw new Error('Missing bootstrap native window.');
    }
    bootstrap(
      { token, fragment: 'target', name: 'Original', version: '1.0' },
      readingSystem,
      scope,
    );
    exerciseMessages(scope);
    document.dispatchEvent(new scope.Event('DOMContentLoaded', { bubbles: true }));
    await delivered.promise;
    expect(received).toEqual([
      { type: 'message', value: { original: true } },
      { type: 'error', value: 'Original script failure' },
      { type: 'error', value: 'Unhandled publication promise rejection.' },
      { type: 'ready' },
    ]);
  } finally {
    window.removeEventListener('message', listener);
    view.destroy();
    container.remove();
  }
});

/** Native message delivery and error events exercise the installed callback API rather than replacing it. */
function exerciseMessages(scope: Window & typeof globalThis): void {
  const descriptor = Object.getOwnPropertyDescriptor(scope.navigator, 'epubReadingSystem');
  expect(descriptor?.writable).toBe(false);
  expect(descriptor?.configurable).toBe(false);

  post(scope, { original: true });
  expect(() => post(scope, undefined)).toThrow('JSON');
  expect(() => post(scope, 'x'.repeat(65_537))).toThrow('64 KiB');
  scope.dispatchEvent(new scope.ErrorEvent('error', { message: 'Original script failure' }));
  scope.dispatchEvent(new scope.Event('unhandledrejection'));
}
