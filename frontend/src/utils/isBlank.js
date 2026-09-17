// null, undefined, and "" (or whitespace) all mean "no value".
export const isBlank = (value) =>
  value == null || (typeof value === 'string' && value.trim() === '');
