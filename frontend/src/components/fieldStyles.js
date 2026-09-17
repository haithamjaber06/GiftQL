// Shared look for every control on the light page background.
export const fieldStyles = `
  min-width: 0;
  padding: var(--space-field-padding-y) var(--space-field-padding-x);
  border: var(--border-hairline) solid var(--color-input-border);
  border-radius: var(--radius-input);
  background: var(--color-input-bg);
  color: var(--color-input-text);
  font-family: var(--font-body);
  font-size: var(--size-input);
  line-height: var(--line-height-base);
  box-shadow: 0 0 0 var(--space-halo) var(--color-page-bg);

  &::placeholder {
    color: var(--color-input-placeholder);
  }
`;
