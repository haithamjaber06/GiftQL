// Fake items for testing layout edge cases. Loaded only in dev with ?fixtures=1.
// Every item uses only the fields the API returns. Section numbers refer to
// docs/GIFTQL_FRONTEND_REDESIGN.md §6.

const img = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

const base = {
  norm_url: '',
  raw_title: '',
  description: 'A thoughtful little thing that fits the vibe perfectly.',
  status: 'Done',
  kind: 'Product',
  currency: 'JOD',
  labels: ['cozy', 'handmade'],
  created_at: '2026-09-14T15:01:05.938045+00:00',
};

let nextId = 1;
const item = (fields) => ({ ...base, id: nextId++, ...fields });

export const fixtures = [
  // ---- Normal, well-formed ----
  item({
    url: 'https://hadiyyeh.com/products/coconuts-eternal-oud-intimate-splash',
    person: 'Dad',
    title: 'Coconuts Eternal Oud Intimate Splash, 150ml',
    raw_title: 'COCONUTS ETERNAL OUD INTIMATE SPLASH',
    description: 'A luxurious body mist infused with a long-lasting oud scent for daily freshness.',
    img_url: img('oud'),
    price: 15,                                    // §6.10 boundary: exactly 15
    occasion: 'Just Because',
    labels: ['fragrance', 'body mist', 'oud', 'beauty'],
  }),
  item({
    url: 'https://www.amazon.sa/dp/B0EXAMPLE',
    person: 'Mom',
    title: 'Ceramic Pour-Over Coffee Set',
    img_url: img('coffee'),
    price: 50,                                    // §6.10 boundary: exactly 50
    currency: 'SAR',
    occasion: "Mother's Day",
    labels: ['coffee', 'kitchen', 'ceramic'],
  }),
  item({
    url: 'https://www.etsy.com/listing/123/walnut-desk-organizer',
    person: 'Big Sis',
    title: 'Walnut Desk Organizer',
    img_url: img('walnut'),
    price: 120.5,
    currency: 'USD',
    occasion: 'Birthday',
    kind: 'Idea',
  }),
  item({
    url: 'https://www.instagram.com/p/EXAMPLE/',
    person: 'Gf',
    title: 'Pressed Flower Frame',
    img_url: img('flowers'),
    price: 9.99,                                  // under 15
    occasion: 'Anniversary',
    kind: 'Inspo',
  }),
  item({
    url: 'https://bookshop.example/stores/amman',
    person: 'Friend',
    title: 'Little Bookshop, Jabal Amman',
    img_url: img('books'),
    price: 30,
    occasion: 'Graduation',
    kind: 'Store',
  }),

  // ---- §6.1 Missing image ----
  item({
    url: 'https://example.com/null-image',
    person: 'Mom',
    title: 'Null image URL',
    img_url: null,
    price: 22,
    occasion: 'Eid',
  }),
  item({
    url: 'https://example.com/broken-image',
    person: 'Dad',
    title: 'Image URL that 404s',
    img_url: 'https://picsum.photos/this-path-does-not-exist.jpg',
    price: 18,
    occasion: 'Birthday',
  }),
  item({
    url: 'https://hadiyyeh.com/products/http-image',
    person: 'Dad',
    title: 'Image URL with http:// (upgraded to https)',
    img_url: 'http://hadiyyeh.com/cdn/shop/files/COCONUTS-ETERNAL-OUD-INTIMATE-SPLASH.avif?v=1787074207',
    price: 15,
    occasion: 'Just Because',
  }),

  // ---- §6.2 Missing description ----
  item({
    url: 'https://example.com/null-description',
    person: 'Gf',
    title: 'Null description',
    description: null,
    img_url: img('nodesc1'),
    price: 40,
    occasion: 'Birthday',
  }),
  item({
    url: 'https://example.com/empty-description',
    person: 'Friend',
    title: 'Empty-string description',
    description: '',
    img_url: img('nodesc2'),
    price: 12,
    occasion: 'Just Because',
  }),

  // ---- §6.3 Very long title (90 chars) ----
  item({
    url: 'https://example.com/long-title',
    person: 'Big Sis',
    title: 'Handwoven Merino Wool Throw Blanket with Tassels, Oversized, Soft Neutral Oatmeal Colorway',
    img_url: img('blanket'),
    price: 75,
    occasion: 'Birthday',
  }),

  // ---- §6.4 Too many labels (9) ----
  item({
    url: 'https://example.com/many-labels',
    person: 'Mom',
    title: 'Nine labels',
    img_url: img('labels'),
    price: 35,
    occasion: 'Eid',
    labels: ['home', 'decor', 'candle', 'vanilla', 'cozy', 'winter', 'gift set', 'handmade', 'local'],
  }),

  // ---- §6.5 No labels ----
  item({
    url: 'https://example.com/no-labels',
    person: 'Dad',
    title: 'Empty labels array',
    img_url: img('nolabels'),
    price: 60,
    occasion: "Father's Day",
    labels: [],
  }),

  // ---- §6.6 Null / empty price and occasion ----
  item({
    url: 'https://example.com/null-price',
    person: 'Gf',
    title: 'Null price',
    img_url: img('noprice'),
    price: null,                                  // §6.10: only in "Any price"
    occasion: "Valentine's",
  }),
  item({
    url: 'https://example.com/null-occasion',
    person: 'Friend',
    title: 'Null occasion',
    img_url: img('noocc1'),
    price: 14,
    occasion: null,
  }),
  item({
    url: 'https://example.com/empty-occasion',
    title: 'Empty-string occasion and person',
    img_url: img('noocc2'),
    price: 16,
    occasion: '',
    person: '',
  }),
  item({
    url: 'https://example.com/null-currency',
    person: 'Dad',
    title: 'Price typed by user, currency null',
    img_url: img('nocurrency'),
    price: 25,
    currency: null,
    occasion: 'Birthday',
  }),

  // ---- §6.8 Long occasion ----
  item({
    url: 'https://example.com/long-occasion',
    person: 'Big Sis',
    title: 'Long occasion tag',
    img_url: img('longocc'),
    price: 45,
    occasion: 'Graduation Ceremony',
  }),

  // ---- §6.9 Pending / Partial / Failed ----
  item({
    url: 'https://www.noon.com/some-product/p/',
    person: 'Mom',
    title: null,
    description: null,
    img_url: null,
    status: 'Pending',
    kind: null,
    price: null,
    currency: null,
    occasion: 'Birthday',
    labels: null,
  }),
  item({
    url: 'https://shop.example.com/partial-item',
    person: 'Gf',
    title: 'Partial: scraped title, no AI details',
    description: null,
    img_url: img('partial'),
    status: 'Partial',
    kind: null,
    price: 20,
    currency: null,
    occasion: 'Anniversary',
    labels: [],
  }),
  item({
    url: 'not a valid url at all',
    person: 'Friend',
    title: null,
    description: null,
    img_url: null,
    status: 'Failed',
    kind: null,
    price: null,
    currency: null,
    occasion: '',
    labels: null,
  }),
];
