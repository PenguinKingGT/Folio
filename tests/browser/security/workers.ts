/** Explicit script permission never authorizes background workers inside the opaque publication. */
import type { Book } from '../../../src/index';

/** Wait for the worker's real error/message outcome instead of timing assumptions about CSP enforcement. */
export async function workerScenario(book: Book): Promise<unknown> {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(host);
  const reader = book.renderScriptedTo(host, { scripts: true, inject: [workerProbe] });
  const outcome = new Promise<unknown>((resolve) => {
    reader.on('message', resolve);
  });
  try {
    await reader.display();
    return await outcome;
  } finally {
    book.destroy();
    host.remove();
  }
}

const workerProbe = `
try {
  var worker = new Worker('data:text/javascript,postMessage("executed")');
  worker.onmessage = function () { worker.terminate(); window.folio.postMessage({worker:'executed'}); };
  worker.onerror = function (event) { event.preventDefault(); worker.terminate(); window.folio.postMessage({worker:'blocked'}); };
} catch (error) { window.folio.postMessage({worker:'blocked'}); }
`;
