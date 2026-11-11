/** Discover readable stylesheet media conditions without depending on publication scripts. */

/** Narrow browser-owned rule objects by the standardized rule type. */
function mediaRule(rule: CSSRule): rule is CSSMediaRule {
  return rule.type === 4;
}

/** Import rules link another stylesheet rather than exposing a grouping-rule list. */
function importRule(rule: CSSRule): rule is CSSImportRule {
  return rule.type === 3;
}

/** Grouping rules include nested media/supports/layer blocks. */
function groupingRule(rule: CSSRule): rule is CSSGroupingRule {
  return 'cssRules' in rule;
}

/** Return active and inactive conditions; inaccessible cross-origin stylesheets are skipped. */
export function mediaQueries(document: Document): readonly string[] {
  const queries = new Set<string>();
  /** Follow native imports, including a stylesheet's own media attribute. */
  function sheet(stylesheet: CSSStyleSheet): void {
    if (stylesheet.media.mediaText !== '') {
      queries.add(stylesheet.media.mediaText);
    }
    let list: CSSRuleList;
    try {
      // The native CSSOM getter denies rule access for cross-origin stylesheets.
      list = stylesheet.cssRules;
    } catch {
      return;
    }
    rules(list);
  }
  /** Traverse native grouping rules without assuming a particular CSS nesting style. */
  function rules(list: CSSRuleList): void {
    for (const rule of Array.from(list)) {
      if (mediaRule(rule)) {
        queries.add(rule.conditionText);
      }
      if (importRule(rule) && rule.styleSheet !== null) {
        sheet(rule.styleSheet);
      } else if (groupingRule(rule)) {
        rules(rule.cssRules);
      }
    }
  }
  for (const stylesheet of Array.from(document.styleSheets)) {
    sheet(stylesheet);
  }
  return [...queries];
}
