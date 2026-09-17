import { isBlank } from './isBlank';

// 15, "JOD" → "15 JOD".  15, null → "15".  null → null.
export function formatPrice(price, currency) {
  if (price == null) return null;
  return isBlank(currency) ? `${price}` : `${price} ${currency}`;
}
