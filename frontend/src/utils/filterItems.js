import { isBlank } from './isBlank';

// Ranges compare raw numbers and ignore currency (known limitation, spec §12).
export const PRICE_RANGES = [
  { value: '', label: 'Any price', matches: () => true },
  { value: 'under-15', label: 'Under 15', matches: (price) => price < 15 },
  { value: '15-50', label: '15–50', matches: (price) => price >= 15 && price <= 50 },
  { value: 'over-50', label: 'Over 50', matches: (price) => price > 50 },
];

// "Birthday " and "birthday" are the same occasion.
export const occasionKey = (occasion) =>
  isBlank(occasion) ? '' : occasion.trim().toLowerCase();

// Distinct occasions across items, first spelling wins, sorted A–Z.
export function occasionOptions(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = occasionKey(item.occasion);
    if (key && !byKey.has(key)) byKey.set(key, item.occasion.trim());
  }
  return [...byKey]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Filters combine with AND. Empty string = filter off.
export function filterItems(items, { person, occasion, price }) {
  const range = PRICE_RANGES.find((r) => r.value === price) ?? PRICE_RANGES[0];
  return items.filter(
    (item) =>
      (!person || item.person === person) &&
      (!occasion || occasionKey(item.occasion) === occasion) &&
      (!price || (item.price != null && range.matches(item.price))),
  );
}
