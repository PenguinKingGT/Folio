/** Original search corpus covers more than five inline nodes, preserved whitespace, passive content, and Unicode. */
import { Book } from '../../../src/index';
import { bookFiles, bookZip } from '../book/fixture';

/** Retain native text-slot boundaries while keeping expected phrases easy to inspect. */
export const searchChapter = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Head secret</title></head><body id="reading-body">
  <style>p{color:red}/* style secret */</style><script>script secret</script>
  <p id="phrase">Alpha <em>or</em><span>i</span><b>g</b><i>i</i><u>n</u><small>a</small><strong>l</strong> <span>text</span> tail.</p>
  <p id="repeated">banana banana</p>
  <p id="special">Regex .* [a] (x)? $^ + | \\ end.</p>
  <p id="unicode">😀 A Σ σ ς K k 𐐀𐐨 İ i Straße ẞ</p>
  <p id="spaced">One<span> \n\t </span><em>two</em>&nbsp;<b>three</b></p>
  <p id="adjacent">ab<!-- comment --><![CDATA[cd]]><script>ignored secret</script>ef</p>
  <dl><dt>BlockFirst</dt><dd>BlockSecond</dd></dl>
</body></html>`;

/** Optionally insert another OPF element so search must honor an actual spine step of /8. */
export function searchFiles(extraPackageElement = false): Map<string, string> {
  const files = bookFiles();
  files.set('OPS/text/chapter one.xhtml', searchChapter);
  if (extraPackageElement) {
    files.set(
      'OPS/package.opf',
      (files.get('OPS/package.opf') ?? '').replace('<spine', '<bindings/><spine'),
    );
  }
  return files;
}

/** Open the fixture without creating any browser view or loading its chapter body. */
export function searchBook(extraPackageElement = false): Promise<Book> {
  return Book.open(bookZip(searchFiles(extraPackageElement)));
}
