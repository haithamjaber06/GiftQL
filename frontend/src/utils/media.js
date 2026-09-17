import { theme } from '../theme';

// Media query prefixes for styled-components. Breakpoints can't be CSS variables.
export const belowTablet = `@media (max-width: ${theme.breakpoint.tablet})`;
export const belowPhone = `@media (max-width: ${theme.breakpoint.phone})`;
