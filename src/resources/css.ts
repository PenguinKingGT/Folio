/** Rewrite CSS references through an AST so escaped strings and comments remain valid. */
import parse from 'css-tree/parser';
import generate from 'css-tree/generator';
import walk from 'css-tree/walker';

/** Replace url() references and string-form imports in a stylesheet or style attribute. */
export async function rewriteCss(
  source: string,
  rewrite: (href: string) => Promise<string>,
  context: 'stylesheet' | 'declarationList' = 'stylesheet',
): Promise<string> {
  const ast = parse(source, {
    context,
    onParseError: (error) => {
      throw error;
    },
  });
  const references: { value: string }[] = [];
  walk(ast, (node) => {
    if (node.type === 'Url') {
      references.push(node);
    }
    if (
      node.type === 'Atrule' &&
      node.name.toLowerCase() === 'import' &&
      node.prelude?.type === 'AtrulePrelude'
    ) {
      const first = node.prelude.children.first;
      if (first?.type === 'String') {
        references.push(first);
      }
    }
  });
  for (const reference of references) {
    reference.value = await rewrite(reference.value);
  }
  return generate(ast);
}
