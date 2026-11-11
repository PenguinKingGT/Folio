/** Reject incomplete or excessively nested directories using original malformed fixtures. */
import { expect, test } from 'vitest';
import { parseNavigation } from '../../../src/index';
import { nav, ncx, point } from './fixture';

test.each([
  '<root/>',
  '<html xmlns="other"/>',
  nav('<li><a>Missing href</a></li>'),
  nav('<li><a href="">Empty href</a></li>'),
  nav('<li><span/></li>'),
  nav('<li/>'),
  nav('<li id="same"><a href="a">A</a></li><li id="same"><a href="b">B</a></li>'),
  nav('').replace('<ol></ol>', ''),
  nav('').replace('epub:type="toc"', 'epub:type="other"'),
  nav('', '<nav epub:type="toc"><ol/></nav>'),
  nav('', '<nav epub:type="landmarks"><a>Broken</a></nav>'),
  '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"/>',
  ncx('<navPoint/>'),
  ncx('<navPoint><navLabel/></navPoint>'),
  ncx('<navPoint><navLabel><text>Label</text></navLabel><content/></navPoint>'),
  ncx('<navPoint><navLabel><text>Label</text></navLabel><content src=""/></navPoint>'),
  ncx('').replace('</navMap>', '</navMap><navMap/>'),
])('rejects invalid navigation %#', (xml) => {
  expect(() => parseNavigation(xml)).toThrow();
});

test('bounds recursive XHTML and NCX nesting', () => {
  let toc = '<li><a href="end.xhtml">End</a></li>';
  let points = point('last', 'last.xhtml');
  for (let index = 0; index < 66; index += 1) {
    toc = `<li><span>Group</span><ol>${toc}</ol></li>`;
    points = point(`p${index}`, `${index}.xhtml`, points);
  }
  expect(() => parseNavigation(nav(toc))).toThrow(RangeError);
  expect(() => parseNavigation(ncx(points))).toThrow(RangeError);
});
