const SKIP = ['breakpoint', 'responsive'];

const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// { color: { pageBg: '#fff' } }  →  "--color-page-bg: #fff;"
export function themeToCssVars(tokens, prefix = '') {
  return Object.entries(tokens)
    .filter(([key]) => !(prefix === '' && SKIP.includes(key)))
    .map(([key, value]) => {
      const name = prefix ? `${prefix}-${kebab(key)}` : kebab(key);
      return typeof value === 'object'
        ? themeToCssVars(value, name)
        : `--${name}: ${value};`;
    })
    .join('\n');
}
