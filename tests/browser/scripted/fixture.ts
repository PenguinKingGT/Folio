/** Original classic-script publication reports opaque-origin behavior through its own bounded message API. */
import { continuousFiles } from '../continuous/fixture';

/** Include real external scripts, imported CSS, SVG data assets, and an author style containing a child combinator. */
export function scriptedFiles(): Map<string, string> {
  const files = continuousFiles(4);
  files.set(
    'OPS/text/chapter one.xhtml',
    `<html xmlns="http://www.w3.org/1999/xhtml"><head>
    <base href="https://ignored.invalid/"/><meta http-equiv="refresh" content="0;url=https://ignored.invalid/"/>
    <link rel="stylesheet" href="../assets/style.css"/><style media="screen" title="Original">p > em{font-weight:700}</style>
    </head><body><p id="scripted">Original <em>scripted</em> chapter</p>
    <button id="popup" onclick="var popup=null;try{popup=window.open('about:blank');}catch(error){popup=null;}window.folio.postMessage({kind:'popup',allowed:popup!==null});">Open local popup</button>
    <iframe src="https://blocked.invalid/"/><form action="https://blocked.invalid/"/>
    <script><![CDATA[
      window.executionOrder = window.executionOrder || [];
      window.executionOrder.push('inline');
      document.getElementById('scripted').setAttribute('data-executed','yes');
      window.parentDenied = false;
      try { parent.document.body.setAttribute('data-publisher-escape','unsafe'); }
      catch (error) { window.parentDenied = true; }
    ]]></script><script src="../assets/reader.js"/>
  </body></html>`,
  );
  files.set(
    'OPS/assets/reader.js',
    `window.executionOrder.push('external');
    var system = navigator.epubReadingSystem;
    window.folio.postMessage({kind:'executed',order:window.executionOrder,denied:window.parentDenied,
      name:system.name,version:system.version,layout:system.layoutStyle,
      dom:system.hasFeature('dom-manipulation'),spine:system.hasFeature('spine-scripting','1.0'),
      unknown:system.hasFeature('unknown')===undefined,versionless:system.hasFeature('spine-scripting','2.0'),
      touch:system.hasFeature('touch-events'),color:getComputedStyle(document.getElementById('scripted')).color,
      weight:getComputedStyle(document.querySelector('em')).fontWeight,
      opaque:location.origin==='null',frames:document.querySelectorAll('iframe,form,base').length});`,
  );
  files.set('OPS/assets/style.css', '@import "nested.css"; body > p{color:rgb(1,2,3)}');
  files.set('OPS/assets/nested.css', 'p{background-image:url(box.svg)}');
  files.set(
    'OPS/assets/box.svg',
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1"/></svg>',
  );
  return files;
}
