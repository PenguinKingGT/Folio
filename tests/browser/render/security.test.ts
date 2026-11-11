/** Browser-native passive-content checks ensure scripts and active embeddings never execute. */
import { expect, test } from 'vitest';
import { prepareContent } from '../../../src/render/content';
import { book, host } from './fixture';

test('removes active content and places a restrictive CSP before publisher content', async () => {
  const source = `<html xmlns="http://www.w3.org/1999/xhtml"><head><base href="https://example.invalid/"/>
    <meta http-equiv=" refresh " content="0;url=https://example.invalid/"/>
    <script>parent.document.body.setAttribute('data-compromised','yes')</script></head>
    <body onload="parent.document.body.setAttribute('data-compromised','yes')">
    <p>Passive content</p><iframe src="https://example.invalid/"/><object data="bad"/><embed/><form/>
    <a href="java&#10;script:alert(1)">Unsafe link</a>
    <img src="data:image/png;base64,AA==" onerror="parent.document.body.setAttribute('data-compromised','yes')"/>
    </body></html>`;
  const publication = await book(source);
  const container = host();
  try {
    const reader = publication.renderTo(container);
    await reader.display();
    const contents = reader.getContents();
    expect(contents?.querySelector('script,iframe,object,embed,form,base')).toBeNull();
    expect(contents?.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(contents?.querySelector('img')?.hasAttribute('onerror')).toBe(false);
    expect(contents?.body.hasAttribute('onload')).toBe(false);
    expect(contents?.querySelector('meta[http-equiv=" refresh "]')).toBeNull();
    expect(contents?.body.textContent).toContain('Passive content');
    expect(document.body.hasAttribute('data-compromised')).toBe(false);
    expect(reader.frame.getAttribute('sandbox')).toBe('allow-same-origin');
  } finally {
    publication.destroy();
    container.remove();
  }
});

test.each([
  '<root/>',
  '<html xmlns="other"><body/></html>',
  '<html xmlns="http://www.w3.org/1999/xhtml"><head/></html>',
])('rejects malformed reader content %s', (source) => {
  expect(() => prepareContent(source, 'original')).toThrow(TypeError);
});
