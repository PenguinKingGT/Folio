/** Raw-text CSS remains semantically identical across XHTML-to-HTML iframe serialization. */
import { expect, test } from 'vitest';
import { book } from '../render/fixture';
import { styledChapter, styleScenario } from './styles';

test('preserves child selectors, literal entities, and end-tag text without creating executable HTML', async () => {
  const result = await styleScenario(await book(styledChapter));
  expect(result.color).toBe('rgb(1, 2, 3)');
  expect(result.content).toContain('< & > &gt; </style><script>');
  expect(result.literal).toContain('p>em');
  expect(result.scripts).toBe(0);
  expect(result.compromised).toBe(false);
});

test('foreign SVG style text has already been entity-decoded by the HTML parser', async () => {
  const publication = await book(`<html xmlns="http://www.w3.org/1999/xhtml"><head/><body>
    <svg xmlns="http://www.w3.org/2000/svg"><style><![CDATA[text::before{content:"&gt;"}]]></style></svg>
    </body></html>`);
  const container = document.createElement('div');
  container.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(container);
  try {
    const reader = publication.renderTo(container);
    await reader.display();
    expect(reader.getContents()?.querySelector('svg style')?.textContent).toContain('&gt;');
  } finally {
    publication.destroy();
    container.remove();
  }
});
