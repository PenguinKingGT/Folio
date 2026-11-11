/** Serialize rule/override inputs through strict CSS parsing instead of concatenating unvalidated fragments. */
import parse from 'css-tree/parser';
import generate from 'css-tree/generator';
import type { ThemeRules, OverrideOptions } from './types';

/** Parse fragments strictly so values cannot escape into another declaration or selector. */
function fragment(value: string, context: 'selectorList' | 'value'): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError('Theme selectors and values must be non-empty strings.');
  }
  return generate(parse(value, { context }));
}

/** Validate property spelling while allowing custom properties. */
export function declaration(property: string, value: string, important = false): string {
  if (!/^(?:--[\w-]+|[a-zA-Z][a-zA-Z-]*)$/.test(property)) {
    throw new TypeError('Invalid theme property.');
  }
  const suffix = /\s*!important\s*$/i.test(value);
  const content = suffix ? value.replace(/\s*!important\s*$/i, '') : value;
  return `${property}:${fragment(content, 'value')}${important || suffix ? '!important' : ''}`;
}

/** Preserve rule insertion order and reject empty declaration values. */
export function serializeRules(rules: ThemeRules): string {
  if (rules === null || typeof rules !== 'object' || Array.isArray(rules)) {
    throw new TypeError('Theme rules must be a selector map.');
  }
  return Object.entries(rules)
    .map(([selector, properties]) => {
      if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) {
        throw new TypeError('Theme declarations must be a property map.');
      }
      const values = Object.entries(properties).map(([property, value]) =>
        declaration(property, value),
      );
      return `${fragment(selector, 'selectorList')}{${values.join(';')}}`;
    })
    .join('');
}

/** Build one scoped override without introducing classes or wrappers into publication content. */
export function serializeOverride(
  property: string,
  value: string,
  options: OverrideOptions,
): string {
  return `${fragment(options.selector ?? 'html,body', 'selectorList')}{${declaration(property, value, options.important)}}`;
}
