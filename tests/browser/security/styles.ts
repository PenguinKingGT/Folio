/** XML serialization must preserve author CSS semantics without introducing HTML end-tag injection. */
import type { Book } from '../../../src/index';

/** Assert native CSS evaluation and passive frame isolation using an original local chapter. */
export async function styleScenario(book: Book): Promise<{
  color: string;
  content: string;
  literal: string;
  scripts: number;
  compromised: boolean;
}> {
  const host = document.createElement('div');
  host.style.cssText = 'width:320px;height:240px';
  document.body.appendChild(host);
  try {
    const reader = book.renderTo(host);
    await reader.display();
    const doc = reader.getContents();
    const em = doc?.querySelector('em');
    if (doc === null || em === null || em === undefined || doc.defaultView === null) {
      throw new Error('Expected a native styled chapter.');
    }
    return {
      color: doc.defaultView.getComputedStyle(em).color,
      content: doc.defaultView.getComputedStyle(em, '::before').content,
      literal: doc.querySelector('style')?.textContent ?? '',
      scripts: doc.querySelectorAll('script').length,
      compromised: document.body.hasAttribute('data-style-escape'),
    };
  } finally {
    book.destroy();
    host.remove();
  }
}

/** CSS strings intentionally contain entity spellings and HTML end tags, expressed as valid XHTML. */
export const styledChapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><style><![CDATA[
p > em { color: rgb(1, 2, 3); }
em::before { content: "< & > &gt; </style><script>parent.document.body.setAttribute('data-style-escape','yes')</script>"; }
]]></style></head><body><p>Original <em>text</em></p></body></html>`;
