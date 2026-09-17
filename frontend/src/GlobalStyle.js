import { createGlobalStyle } from 'styled-components';
import { theme } from './theme';
import { themeToCssVars } from './utils/themeToCssVars';

const { breakpoint, responsive } = theme;

export const GlobalStyle = createGlobalStyle`
  :root {
    ${themeToCssVars(theme)}
  }

  /* Tablet first, phone second — phone wins where both apply. */
  @media (max-width: ${breakpoint.tablet}) {
    :root { ${themeToCssVars(responsive.tablet)} }
  }
  @media (max-width: ${breakpoint.phone}) {
    :root { ${themeToCssVars(responsive.phone)} }
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  /* The only element with a background — see §7.2. */
  html {
    background: var(--color-page-bg);
  }

  body {
    margin: 0;
    font-family: var(--font-body);
    font-weight: var(--weight-regular);
    line-height: var(--line-height-base);
  }

  button, input, select, textarea {
    font: inherit;
  }

  /* Default focus ring for the light page. Cards override it for dark surfaces. */
  :focus-visible {
    outline: var(--border-focus-ring) solid var(--color-focus-ring-on-light);
    outline-offset: var(--space-focus-offset);
  }
`;
