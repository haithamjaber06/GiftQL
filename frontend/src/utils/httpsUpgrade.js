import { isBlank } from './isBlank';

// http:// images are blocked as mixed content on an https page.
export const httpsUpgrade = (url) =>
  isBlank(url) ? null : url.replace(/^http:\/\//i, 'https://');
