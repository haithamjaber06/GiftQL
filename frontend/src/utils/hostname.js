// "https://www.noon.com/p/123" → "www.noon.com". Unparseable → the raw string.
export function hostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url ?? '';
  }
}
