# GiftQL — Frontend Redesign Spec

## 0. Read this first

This is a **frontend-only** redesign. You are rebuilding how items are displayed. You are not changing the backend, the database, the scraper, the enrichment pipeline, or any API route.

**Hard rules:**

1. **Do not modify any backend file.** No route handlers, no models, no migrations, no serializers, no scraping/enrichment logic.
2. **Do not add, rename, or remove any database field.** Every value on screen must come from a field that already exists in the API response documented in §2.
3. **Do not invent API endpoints.** Before writing any fetch call, read the existing frontend code and reuse the exact URLs, methods, and payload shapes it already uses. If you cannot find an existing call for something (e.g. editing an item), stop and report it rather than guessing.
4. **Do not add new dependencies** beyond `styled-components` (and its types, if the project is TypeScript) unless you stop and ask first.
5. If any instruction here conflicts with what the existing code actually does, **the existing code wins** — report the conflict instead of silently changing behavior.
6. **Work in the phases defined in §11 and stop after each one.** Do not start the next phase until I reply "continue".
7. **Never write test data to the API or database.** Edge cases are tested with the local fixtures file described in §6.0.
8. **Do not run git commands** (commit, branch, merge, reset, stash). I review and commit each phase myself.

---

## 1. What is being built

A single page with three regions, top to bottom:

```
┌──────────────────────────────────────────────────────────────┐
│  INPUT BAR    [ Paste a link ][Person ▾][Occasion][Price][Save]│
├──────────────────────────────────────────────────────────────┤
│  FILTER BAR   ( All )( Mom )( Dad )( Gf )( Big Sis ) …        │
│               [Occasion ▾]  [Price ▾]                         │
├──────────────────────────────────────────────────────────────┤
│  GRID                                                         │
│   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐             │
│   │ card   │  │ card   │  │ card   │  │ card   │             │
│   └────────┘  └────────┘  └────────┘  └────────┘             │
│   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐             │
│   │ card   │  │ card   │  │ card   │  │ card   │             │
│   └────────┘  └────────┘  └────────┘  └────────┘             │
└──────────────────────────────────────────────────────────────┘
```

The input bar and filter bar keep their **existing behavior and existing API calls**. Only their styling changes (plus the new occasion and price filters in §7.3, which are frontend-only). The grid and the card are what genuinely change.

---

## 2. Data contract — the exact API shape

This is one real item from the items endpoint. These are the **only** fields you may read.

```json
{
  "id": 3,
  "url": "https://hadiyyeh.com/products/coconuts-eternal-oud-intimate-splash?pr_prod_strat=jac&...",
  "norm_url": "https://hadiyyeh.com/products/coconuts-eternal-oud-intimate-splash?pr_prod_strat=jac&...",
  "person": "Dad",
  "title": "Coconuts Eternal Oud Intimate Splash, 150ml",
  "raw_title": "COCONUTS ETERNAL OUD INTIMATE SPLASH",
  "description": "A luxurious body mist infused with a long-lasting oud scent for daily freshness.",
  "img_url": "http://hadiyyeh.com/cdn/shop/files/COCONUTS-ETERNAL-OUD-INTIMATE-SPLASH.avif?v=1787074207",
  "status": "Done",
  "kind": "Product",
  "price": 15,
  "currency": "JOD",
  "occasion": "Just Because",
  "labels": ["fragrance", "body mist", "oud", "beauty"],
  "created_at": "2026-09-14T15:01:05.938045+00:00"
}
```

### 2.1 Field-by-field mapping

| Field | Type | Where it appears | Notes |
|---|---|---|---|
| `id` | number | React `key`, and the identifier in edit/delete calls | Never rendered as text |
| `url` | string | `href` of the **Visit** button; hostname shown on pending/failed cards | Opens in a new tab |
| `norm_url` | string | **Not rendered.** Ignore it. | |
| `person` | string | Card **back**, row labelled "For" | Read-only. No edit control. |
| `title` | string | Card front title, card back title | May be long — see §6.3 |
| `raw_title` | string | **Not rendered.** Ignore it. | |
| `description` | string \| null | Card **back**, clamped to 3 lines | May be null — see §6.2 |
| `img_url` | string \| null | Card front image | **See §2.2 — this needs handling** |
| `status` | string | Controls which card variant renders | See §5 |
| `kind` | string | Small tag on card **front** | e.g. "Product", "Post" |
| `price` | number \| null | Card front and back | Rendered with `currency` — see §2.3 |
| `currency` | string | Rendered next to `price` | Never rendered alone |
| `occasion` | string \| null | Tag on card front, and row on back | Editable — see §4.4 |
| `labels` | string[] | Chips on card **back** | May be empty — see §6.4 |
| `created_at` | ISO string | **Not rendered.** Ignore it. | |

### 2.2 `img_url` — problems you must handle

**Problem 1 — protocol.** The sample `img_url` starts with `http://`, not `https://`. If the site is served over HTTPS, browsers block this as mixed content and the image silently fails to load. Before using the URL, upgrade the protocol on the client:

```js
const safeSrc = img_url ? img_url.replace(/^http:\/\//i, 'https://') : null;
```

If the host does not support HTTPS the image will still fail — that is fine, the fallback in Problem 2 covers it. **Do not** add a backend proxy to solve this; that would be a backend change.

**Problem 2 — missing or broken.** `img_url` may be null, and even when present the remote image may 404, be blocked, or have expired. Both cases must render the fallback, not a broken-image icon. Handle **both**, and **reset the failed state whenever `img_url` changes** so a card whose image URL is updated gets a fresh attempt:

```jsx
const [failed, setFailed] = useState(false);
useEffect(() => { setFailed(false); }, [safeSrc]);
// render fallback when: !safeSrc || failed
<img
  src={safeSrc}
  onError={() => setFailed(true)}
  alt=""
  loading="lazy"
  decoding="async"
/>
```

`loading="lazy"` makes the browser download each image only as it scrolls near the viewport. This matters on phones with a long grid.

**Problem 3 — format.** The sample is `.avif`. Modern browsers handle this; older ones do not. The `onError` handler above already covers it. No extra work needed.

**Problem 4 — expiring URLs (expected, not a bug).** Image URLs from Instagram posts are typically signed CDN links that stop working after some days. Those cards will fall back to the gift icon over time. This is expected in this phase. Do not attempt to fix it — the real fix (storing a copy of the image at save time) is a backend change and out of scope. See §12.

**The fallback** is an inline SVG gift icon in `--color-text-muted`, centered on a `--color-surface-raised` background, filling the same 1:1 box with the same `--radius-image`. Do not use a third-party placeholder service. Do not use an emoji.

### 2.3 Price formatting

`price` is a **number** and `currency` is a **separate string**. Render them joined with a single space:

```js
price == null ? null : `${price} ${currency}`   // → "15 JOD"
```

Do not hardcode "JOD". Do not add a currency symbol. Do not add decimal places — `15` renders as `15 JOD`, not `15.00 JOD`. If `price` is null, render nothing in the price slot rather than "null" or "—" (the slot itself still reserves its height on the card front — see §4.1).

### 2.4 Endpoints

**You must read these from the existing code — they are not documented here.** Phase 0 (§11) finds the current calls for:

- Fetching the item list (GET)
- Creating an item from the input bar (POST)
- Deleting an item (DELETE)
- Editing an item (PATCH or PUT)

Reuse them exactly. If the **edit** call does not exist in the current codebase, do not invent one: build the Edit UI, disable the save action, and report that the edit endpoint is missing. Everything else in this spec is achievable without it.

---

## 3. Design tokens

### 3.0 How tokens work in this project

There is **one source of truth**: `src/theme.js` (or `theme.ts`). It is a plain JavaScript object.

`GlobalStyle` (a styled-components `createGlobalStyle`) imports that object and writes every token onto `:root` as a **CSS custom property**. Components never import `theme.js` and never use `props.theme`; they reference tokens only through `var(--...)`. A `ThemeProvider` is not needed — do not add one unless the existing code already uses it.

**Why:** responsive overrides (§3.3) are then declared once, inside a single media query in `GlobalStyle`, instead of being repeated in every component that uses a token.

**Naming rule** — every CSS variable name is derived mechanically from the object path, camelCase converted to kebab-case:

```
theme.color.surfaceRaised   →  --color-surface-raised
theme.size.cardTitle        →  --size-card-title
theme.lineHeight.body       →  --line-height-body
theme.control.touchTarget   →  --control-touch-target
```

Write a small helper (`src/utils/themeToCssVars.js`) that walks the object and produces these declarations, so a token added to `theme.js` automatically becomes available. `breakpoint` values are the one exception: CSS custom properties cannot be used inside media query conditions, so `GlobalStyle` and components import the breakpoint values from `theme.js` directly when building media queries.

**No inline hex values, no magic numbers** in components. If you need a value that has no token, add a token first.

### 3.1 The tokens

```js
export const theme = {
  color: {
    // Page — owner changes this often. Keep it first and named clearly.
    // If you change it, re-check inputBorder and focusRingOnLight against it (§8.1).
    pageBg:        '#F2F1FF',

    // Brand blue ramp — derived from the card color, do not substitute other blues
    cardBg:        '#021F93',   // card surface
    surfaceRaised: '#1A3AB8',   // image fallback background, label chips
    border:        '#3D5AC9',   // hairline dividers and outlines inside the card
    textMuted:     '#93A7EE',   // field labels, price on front, secondary icons
    textBody:      '#B9C6F4',   // description text on the back
    textStrong:    '#FFFFFF',   // titles, field values

    // Tag on the card front (light pill on dark card)
    tagBg:         '#EDF0FD',
    tagText:       '#021F93',

    // Visit button (light button on dark card)
    visitBg:       '#FFFFFF',
    visitText:     '#021F93',

    // Controls on the light page background
    inputBg:          '#FFFFFF',
    inputBorder:      '#8482B3',   // 3:1 minimum against both inputBg and pageBg
    inputText:        '#1A1A2E',
    inputPlaceholder: '#6B6996',

    // Dialog (§4.5)
    dialogBg:       '#FFFFFF',
    dialogText:     '#1A1A2E',
    dialogBackdrop: 'rgba(2, 31, 147, 0.4)',

    // Destructive — two variants, because one red cannot pass contrast on both surfaces
    dangerOnDark:  '#FF8A8A',   // Delete text and error messages on the card
    dangerOnLight: '#C4292F',   // Delete button and error messages in the dialog

    // Keyboard focus rings
    focusRingOnLight: '#021F93',   // on page, bars, dialog
    focusRingOnDark:  '#FFFFFF',   // inside cards
  },

  font: {
    display: "'Playfair Display', Georgia, 'Times New Roman', serif",
    body:    "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  size: {
    cardTitle:   '16px',
    cardPrice:   '13px',
    tag:         '11px',
    body:        '13px',
    fieldLabel:  '13px',
    chip:        '11px',
    button:      '13px',
    input:       '14px',   // overridden to 16px below the tablet breakpoint (§3.3)
    dialog:      '14px',
    emptyState:  '14px',
  },

  weight: {
    regular: 400,
    medium:  500,
  },

  lineHeight: {
    title: 1.35,
    body:  1.55,   // description
    base:  1.4,    // everything else
  },

  radius: {
    card:   '12px',
    image:  '8px',
    pill:   '999px',
    button: '8px',
    input:  '8px',
    dialog: '12px',
  },

  border: {
    hairline: '1px',   // 0.5px renders as 0px or 1px on non-retina screens; use 1px everywhere
    focusRing: '2px',
  },

  space: {
    cardPadding:  '14px',
    gridGap:      '16px',   // overridden to 12px below the phone breakpoint
    pageGutter:   '24px',   // overridden to 16px below the phone breakpoint
    focusOffset:  '2px',
  },

  control: {
    flipButton:   '32px',
    closeButton:  '26px',
    touchTarget:  '44px',
  },

  shadow: {
    card:   '0 1px 3px rgba(2,31,147,0.08), 0 4px 12px rgba(2,31,147,0.06)',
    dialog: '0 8px 32px rgba(2,31,147,0.24)',
  },

  motion: {
    flip: '0.4s',
  },

  grid: {
    minCardWidth: '240px',
    maxPageWidth: '1200px',
  },

  breakpoint: {
    phone:  '480px',   // single column, compact spacing
    tablet: '768px',   // background illustration hidden below this; touch sizing applies
  },

  zIndex: {
    background: -1,
    filterBar:  10,
    dialog:     100,
  },
};
```

**Load the fonts** from Google Fonts in `index.html` (or the framework's head equivalent):

- Playfair Display — weights 400, 500
- DM Sans — weights 400, 500

Include a real fallback stack, exactly as written in the tokens above. Do not load additional weights.

### 3.2 Typography rules

- **Playfair Display** is used for **card titles only** — nothing else.
- **DM Sans** is used for everything else: description, field labels, field values, chips, buttons, inputs, filter pills, dialog, empty states.
- Only two weights exist in this design: 400 and 500. Do not use 600, 700, or bold.
- Do not use all-caps anywhere. `raw_title` is uppercase in the data — this is one reason it is not rendered.
- Line heights come from `lineHeight`: `title` for card titles, `body` for the description, `base` for everything else.

### 3.3 Responsive token overrides

Declared **once**, in `GlobalStyle`, and nowhere else:

```css
@media (max-width: 768px) {   /* theme.breakpoint.tablet */
  :root { --size-input: 16px; }   /* prevents iOS Safari zooming on input focus */
}
@media (max-width: 480px) {   /* theme.breakpoint.phone */
  :root {
    --space-page-gutter: 16px;
    --space-grid-gap: 12px;
  }
}
```

Put the override values in `theme.js` too (for example a `responsive` section) so they are not magic numbers in `GlobalStyle`.

---

## 4. The card

This is the centerpiece. One component, `Card`, used for every item.

### 4.1 Flip behavior and card height

The card flips between a front and a back face.

**The flip is triggered by a dedicated button, not by clicking the card.** This is deliberate. Making the whole card clickable conflicts with the Visit link inside it and is unreliable on touch devices.

- **Front:** a chevron-down button in the bottom-right of the card body.
- **Back:** an X button in the top-right of the card body.
- Both buttons need `aria-label`s: `"Show details"` and `"Hide details"`.
- Flip state is **local to each card** (`useState` inside `Card`). Flipping one card must not affect any other.
- **Focus follows the flip.** When the card flips to the back, move focus to the close button. When it flips to the front, move focus back to the flip button. (The face being hidden becomes `inert`, so without this, keyboard focus is lost to the top of the page.)

**Card height — the front face defines it.**

The **front face stays in normal document flow** and its content determines the card's height. The **back face is absolutely positioned** over it (`inset: 0`) and scrolls internally when its content is taller. Because the image is 1:1 with the card's width, the height scales with the card automatically at every viewport width.

To keep **every card exactly the same height regardless of data**, the front face reserves space for optional content:

- The title block always has a `min-height` of exactly two lines: `calc(2 * var(--size-card-title) * var(--line-height-title))`, even for short titles.
- The price slot is always rendered with a fixed height of `calc(var(--size-card-price) * var(--line-height-base))`, and is simply empty when `price` is null.

No fixed pixel heights. No `ResizeObserver`. No JavaScript measurement.

**Implementation:**

```css
.flip-container { perspective: 1000px; touch-action: manipulation; }

.flip-inner {
  position: relative;
  transform-style: preserve-3d;
  -webkit-transform-style: preserve-3d;
  transition: transform var(--motion-flip);
}
.flip-inner.is-flipped { transform: rotateY(180deg); }

.face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  background: var(--color-card-bg);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
.face--front { position: relative; }            /* in flow: defines the height */
.face--back  {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
  overflow-y: auto;                              /* scrolls if taller than the front */
  -webkit-overflow-scrolling: touch;
}

@media (prefers-reduced-motion: reduce) {
  .flip-inner { transition: none; }
}
```

Each face carries its own background, radius, and shadow. Do not put the card background on `.flip-inner` or `.flip-container`.

**Accessibility:** add the `inert` attribute to whichever face is hidden. `backface-visibility` hides a face visually but not from the keyboard tab order or screen readers; `inert` removes it from both.

**Mobile Safari:** 3D transforms with `preserve-3d` can flicker or bleed the hidden face through on older mobile Safari. If this appears in testing, **fall back to a cross-fade below the tablet breakpoint** (opacity + `visibility` swap, no rotation) rather than shipping a broken flip. The interaction stays the same from the user's side.

### 4.2 Card front

```
┌─────────────────────────┐
│ ┌─────────────────────┐ │
│ │[Just Because] [Prod]│ │   ← occasion tag (left), kind tag (right)
│ │                     │ │
│ │      1:1 image      │ │
│ │                     │ │
│ └─────────────────────┘ │
│ Coconuts Eternal Oud    │   ← Playfair Display 16px / 500, always 2 lines tall
│ Intimate Splash, 150ml  │
│ 15 JOD                  │   ← DM Sans 13px, textMuted, fixed-height slot
│                         │
│ ┌───────────────┐  ┌──┐ │
│ │     Visit     │  │ ⌄│ │
│ └───────────────┘  └──┘ │
└─────────────────────────┘
```

| Element | Source | Styling |
|---|---|---|
| Image | `img_url` (§2.2) | `aspect-ratio: 1 / 1`, `object-fit: cover`, `--radius-image` |
| Occasion tag | `occasion` | Overlaid top-left of the image. `--color-tag-bg` / `--color-tag-text`, `--radius-pill`, `--size-tag`. **Omit entirely if `occasion` is null.** Truncates with an ellipsis (§6.8). |
| Kind tag | `kind` | Overlaid top-right of the image. Same pill styling as the occasion tag. Never shrinks; the occasion tag gives up space first. |
| Title | `title` | `--font-display`, `--size-card-title`, `--weight-medium`, `--color-text-strong`. Clamp to 2 lines; `min-height` of 2 lines (§4.1). |
| Price | `price` + `currency` | `--font-body`, `--size-card-price`, `--color-text-muted`. Fixed-height slot, empty if `price` is null (§4.1). |
| Visit | `url` | An `<a>` styled as a button. `--color-visit-bg` background, `--color-visit-text` text, `--weight-medium`, `--radius-button`. `target="_blank"` with `rel="noopener noreferrer"`. Flexes to fill available width. |
| Flip button | — | `--control-flip-button` square, transparent, `--border-hairline` solid `--color-border`, `--color-text-muted` chevron icon (inline SVG). |

The card body (everything below the image) uses `--space-card-padding` on **all four sides**, matching the image's inset.

### 4.3 Card back

```
┌─────────────────────────┐
│ Coconuts Eternal Oud  ✕ │   ← title (Playfair) + close button
│ Intimate Splash, 150ml  │
│                         │
│ A luxurious body mist   │   ← description, 3-line clamp, textBody
│ infused with a long-    │
│ lasting oud scent for…  │
│                         │
│ For              Dad    │   ← label (textMuted) / value (textStrong)
│ Occasion  Just Because  │
│ Price           15 JOD  │
│                         │
│ (fragrance)(body mist)  │   ← label chips, wrapping
│ (oud)(beauty)           │
│                         │
│ Couldn't save changes.  │   ← error line, only when an action failed
│ ─────────────────────── │   ← hairline, color.border
│ ┌────────┐ ┌────┐ ┌───┐ │
│ │ Visit  │ │Edit│ │Del│ │
│ └────────┘ └────┘ └───┘ │
└─────────────────────────┘
```

| Element | Source | Styling |
|---|---|---|
| Title | `title` | Same as front. 2-line clamp (no min-height needed on the back). |
| Close button | — | `--control-close-button` square, no border, `--color-text-muted` X icon (inline SVG), top-right. |
| Description | `description` | `--font-body`, `--size-body`, `--color-text-body`, `--line-height-body`, clamped to 3 lines via `-webkit-line-clamp`. **Omit the element entirely if null or empty.** |
| Field rows | `person`, `occasion`, `price`+`currency` | Two columns. Label left in `--color-text-muted`, value right-aligned in `--color-text-strong`. Labels are exactly `For`, `Occasion`, `Price` — sentence case, not all caps. A null value renders an empty value cell. |
| Label chips | `labels` | `--color-surface-raised` background, `--color-text-body` text, `--size-chip`, `--radius-pill`. Wrap freely. See §6.4 for the overflow rule. Omit the row if `labels` is empty. |
| Error line | — | Only rendered after a failed Edit save (§4.4). `--size-body`, `--color-danger-on-dark`. Sits directly above the divider. Cleared on the next Edit, Save, or Cancel. |
| Divider | — | `--border-hairline` solid `--color-border`, full width, above the action row. |
| Visit | `url` | Identical to the front's Visit button. **The primary action exists on both faces** — a user must never have to flip back to open a link. |
| Edit | — | Outlined: transparent background, `--border-hairline` solid `--color-border`, `--color-text-body` text. See §4.4. |
| Delete | `id` | Text only: no background, no border, `--color-danger-on-dark`. Quietest element in the row. See §4.5. |

The back face body is a flex column; the action row is pinned to the bottom with `margin-top: auto`. When the back's content is taller than the card, the whole back face scrolls (§4.1).

### 4.4 Edit

Only two fields are editable: **`occasion`** and **`price`**. Everything else is read-only.

Clicking **Edit** turns the `Occasion` and `Price` rows on the back into inputs in place. The Edit button becomes **Save**, and a **Cancel** text button appears next to it. Focus moves to the occasion input.

- **Occasion:** a text input, or a select if the existing input bar already uses a fixed occasion list — match whatever it does. Leading and trailing whitespace is trimmed before saving.
- **Price:** a number input with `inputmode="decimal"` and `min="0"`. `currency` is **not** editable; show it as static text beside the input.
- **Empty price:** Phase 0 reports whether the existing create call allows a missing price. If it does, an empty price input saves as `null`. If it does not, Save is disabled while the price input is empty.
- **Invalid price** (negative, or not a number): Save is disabled.
- **While saving:** Save is disabled and reads `Saving…` to prevent double submission.
- **On Save:** call the existing PATCH/PUT endpoint (§2.4) with the payload shape the existing code uses, update local state optimistically (show the new values immediately), and if the call fails, revert to the previous values and show the error line from §4.3: `Couldn't save changes.`
- **On Cancel:** discard changes and return to read-only.
- **Closing the card mid-edit** (the X button) counts as Cancel.

**If no edit endpoint exists in the current code**, render the Edit button disabled with `title="Editing isn't wired up yet"` and report this. Do not invent a route.

### 4.5 Delete

Delete opens a **confirmation dialog** before anything is sent. The same dialog is used from normal, pending, and failed cards.

**Content and actions:**

- Text: `Delete "<title>"?` For pending or failed cards with no title, use the URL hostname instead.
- Two actions: **Cancel** (quiet: text only, `--color-dialog-text`) and **Delete** (filled: `--color-danger-on-light` background, white text, `--radius-button`).

**Styling:** `--color-dialog-bg` surface, `--radius-dialog`, `--shadow-dialog`, `--font-body`, `--size-dialog`. Backdrop is `--color-dialog-backdrop`. Width is `min(400px, 100% - 2 * var(--space-page-gutter))`, centered. Put `400px` in `theme.js` as a token.

**Behavior — build it as a real modal:**

- Rendered in a React portal (outside the card's DOM, so the card's 3D transform and overflow don't clip it), `z-index: var(--z-index-dialog)`.
- `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at the question text.
- On open, focus moves to the **Cancel** button (the safe default).
- **Focus is trapped**: Tab and Shift+Tab cycle only between the dialog's buttons and never reach the page behind it.
- **Escape** and clicking the backdrop both cancel.
- Do **not** use `window.confirm()`.

**Request flow:**

- Only on confirming Delete does the DELETE request fire.
- While the request is in flight, Delete is disabled and reads `Deleting…`.
- **On success:** close the dialog, remove the card from local state, and move focus to the **flip button of the card that now occupies the deleted card's position** (or the previous card if the deleted one was last). If no cards remain, move focus to the grid's empty-state message (give it `tabIndex={-1}` so it can receive focus).
- **On failure:** keep the dialog open, show `Couldn't delete. Try again?` above the buttons in `--color-danger-on-light`, and re-enable Delete.
- **On cancel:** close the dialog and return focus to the Delete button that opened it.

---

## 5. Pending and failed items

`status` is not always `"Done"`. Items are enriched after they are submitted, so a freshly-saved item may have no title, no image, and no price yet.

**Check in this order:**

1. If `status` is one of the **failure** values → render the **failed card**.
2. Otherwise, if `status !== "Done"` → render the **pending card**.
3. Otherwise → render the normal `Card`.

The failure check must come first, because failure values are also `!== "Done"`. Phase 0 reports the actual status strings the backend produces; **do not guess them.** Put them in one constants file (e.g. `src/constants/status.js`).

**The pending card:**

- Uses the same outer structure as the card front — 1:1 image area, two-line title slot, price slot, action row — so it is **exactly the same height** as a normal card and the grid does not shift when an item finishes enriching. Same background, radius, and shadow.
- Shows a shimmer/skeleton block in the image area, and two skeleton bars in the title and price slots. Skeleton color is `--color-surface-raised`.
- Shows the `url` hostname as small `--color-text-muted` text. Get it with `new URL(url).hostname` inside a `try/catch`; if parsing fails, show the raw `url`, truncated with an ellipsis.
- Has **no** flip button, **no** Visit button, and **no** Edit.
- Keeps **Delete** available (text only, `--color-danger-on-dark`), so a stuck item can be removed.
- Respects `prefers-reduced-motion`: no shimmer animation, just a static block.

**The failed card:** the same shape as the pending card, but with a static `--color-surface-raised` block instead of the shimmer, the hostname, and the message `Couldn't fetch details for this link.` in `--color-text-body`. Delete stays available. Do not hide failed items.

**Polling:** if the existing code already refetches or polls, leave that logic alone. If it does not, **do not add polling** — that is a behavior change beyond this spec's scope. Report it as a suggestion instead.

---

## 6. Edge cases — test every one of these

### 6.0 Test data: the fixtures file

Real data will not contain every edge case below, and **you must never create test items through the API** (rule 7). Instead:

- Create `src/dev/fixtures.js` exporting an array of fake items. Every item uses **only** the fields and types from §2.1.
- Include at least one item for **every** case in §6.1–§6.10, plus several normal well-formed items, with a mix of persons, occasions, currencies, and prices.
- The app uses fixtures **only** when running in development mode **and** the URL contains `?fixtures=1`. Otherwise it uses the real API as normal.
- In fixtures mode, **no requests are sent**: create, edit, and delete operate on local state only. Log `[fixtures] <action> skipped` to the console instead.
- The fixtures file and the fixtures switch must not be active in a production build.

A layout that only works with three identical well-formed items is not finished. Verify every case against fixtures, then spot-check against real data.

### 6.1 Missing image
`img_url` is null, or the URL 404s, or the protocol is `http://`. → Fallback gift SVG, correct 1:1 box, no broken-image icon, no layout shift.

### 6.2 Missing description
`description` is null or `""`. → The description element is not rendered at all. The back does not leave an empty gap; the field rows move up.

### 6.3 Very long title
A 90-character title. → Clamps to 2 lines with an ellipsis on both faces. Card height does not change.

### 6.4 Too many labels
An item with 9 labels. → Show the first 4 chips, then a `+5` chip in the same style. Do not let chips push the action row out of reach; if the back is still too tall, it scrolls (§4.1).

### 6.5 No labels
`labels` is `[]`. → The chip row is not rendered. No empty gap.

### 6.6 Null price or occasion
Either is null. → On the front, the occasion tag is omitted and the price slot is empty (card height unchanged). On the back, the row's value cell is empty rather than "null", "undefined", or "N/A".

### 6.7 Empty grid
One line of plain copy in `--font-body`, `--size-empty-state`, `--color-input-text`, centered. No illustration, no apology, nothing else.

| Situation | Copy |
|---|---|
| No items loaded at all | `Paste a link above to save your first idea.` |
| Only a person filter is active and it matches nothing | `No gifts saved for <person> yet.` |
| An occasion or price filter is active and nothing matches | `No gifts match these filters.` |

### 6.8 Long person or occasion values
A 20-character occasion like "Graduation Ceremony". → The front tag truncates with an ellipsis rather than wrapping over the image or overlapping the kind tag.

### 6.9 Pending and failed items
At least one pending item and one failed item in the grid alongside normal cards. → Same height as neighbours, correct variant, Delete works.

### 6.10 Price filter boundaries
Items priced exactly `15` and exactly `50`, plus one with a null price. → They land in the ranges defined in §7.3.

---

## 7. Grid and page

### 7.1 Grid

```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(var(--grid-min-card-width), 1fr));
gap: var(--space-grid-gap);

@media (max-width: 480px) {   /* theme.breakpoint.phone */
  grid-template-columns: 1fr;   /* one full-width card */
}
```

`auto-fill` with a 240px minimum. Do not hardcode a column count. The gap shrinks automatically below the phone breakpoint via the token override in §3.3.

Constrain the page content to `--grid-max-page-width`, centered, with `--space-page-gutter` on each side.

### 7.2 Background illustration

Keep the existing gift illustration behind the grid at **3% opacity**.

- `position: fixed`, `z-index: var(--z-index-background)`, `pointer-events: none`, `aria-hidden="true"`.
- **Set `--color-page-bg` as the background of `html` only.** No other ancestor of the illustration — not `body`, not `#root`, not any app wrapper — may have a background color. A negative `z-index` paints the illustration *behind* any ancestor's background, so a background on a wrapper would make it invisible.
- At 3% it should be barely perceptible. If it is legible as a distinct shape at normal viewing distance, it is too strong.
- Hide it entirely below the tablet breakpoint — on mobile it only adds noise.

### 7.3 Input bar and filter bar

**Behavior is unchanged except where stated.** These already work. Restyle only.

**Input bar** — fields in a single row, wrapping on narrow screens: `Paste a link` (text), `Person` (select), `Occasion` (text), `Price` (number), `Save` (button).

- Inputs: `--color-input-bg` background, `--border-hairline` solid `--color-input-border`, `--radius-input`, `--size-input`, `--font-body`, `--color-input-text`.
- Placeholder text in `--color-input-placeholder`.
- Save button: `--color-card-bg` background, white text, `--weight-medium`, `--radius-button`. It is the only filled control in the bar.
- The link field is the widest; it takes remaining space via `flex: 1`.

**Filter bar** — currently person-only. **Add occasion and price filters** alongside it, using the values already present in the fetched items. This is a frontend-only grouping of data you already have; it requires no API change.

- **Person:** pill buttons, as now. Active pill = `--color-card-bg` background with white text; inactive = `--color-input-bg` background, `--border-hairline` solid `--color-input-border`, `--color-input-text` text. Active pill has `aria-pressed="true"`.
- **Occasion:** a select, populated from the distinct `occasion` values across the loaded items, plus an `All occasions` option first.
  - Trim whitespace and compare case-insensitively when de-duplicating ("Birthday" and "birthday " are one option). Display the first spelling encountered.
  - Sort options alphabetically. Null occasions do not produce an option.
  - If the selected occasion no longer exists (for example its last item was deleted), reset the select to `All occasions`.
- **Price:** a select with fixed ranges. `price` is a number; boundaries are exact:

  | Option | Matches |
  |---|---|
  | `Any price` | every item, including null prices |
  | `Under 15` | `price < 15` |
  | `15–50` | `15 <= price <= 50` |
  | `Over 50` | `price > 50` |

  Items with a null `price` are excluded from every range except `Any price`.

  **Known limitation:** ranges compare raw numbers and ignore `currency`, so `40 JOD` and `40 SAR` fall in the same range. This is accepted for now (§12). Do not attempt currency conversion.
- Filters combine with AND.
- The whole bar is `position: sticky; top: 0` with `--color-page-bg` background and `z-index: var(--z-index-filter-bar)`, so it stays reachable on a long list.

### 7.4 Mobile

Mobile is where this app is actually used — links get saved from a phone and browsed from a phone. Treat phone layout as a first-class target, not a shrink of the desktop view.

Breakpoints are defined in `theme.breakpoint` (§3.1). Token overrides are in §3.3.

#### 7.4.1 Grid at narrow widths

One column below the phone breakpoint (§7.1), with the reduced gutter and gap from §3.3.

#### 7.4.2 Card height

Handled by §4.1: the front face defines the height and scales with card width; the back scrolls internally. Verify at 320px, 375px, and 414px that the back face's action row (Visit / Edit / Delete) is **visible without scrolling** for a typical item (description, 3 field rows, 4 chips). If it is not, the description clamp drops from 3 lines to 2 below the phone breakpoint.

#### 7.4.3 Touch targets

The close button and flip button are below the 44×44px minimum for touch. Below the tablet breakpoint:

- The flip button and close button get a `--control-touch-target` hit area.
- Keep the *icon* the same visual size — expand the padding, not the glyph, so the button does not look bulky:
  ```css
  @media (max-width: 768px) {
    min-width: var(--control-touch-target);
    min-height: var(--control-touch-target);
  }
  ```
- Visit, Edit, Save, Cancel, dialog buttons, and filter pills get `min-height: var(--control-touch-target)`.
- Delete stays text-only but also gets a 44px tall hit area — it must be easy to *read* as quiet, and still easy to *hit*.
- Label chips on the back are display-only, so they are exempt.

#### 7.4.4 Flip on touch

There is no hover on touch, so the flip affordance must be visible at rest.

- The chevron button is always visible on the front — never hover-revealed.
- Do not add a hover-only hint anywhere in the card.
- `touch-action: manipulation` is on the flip container (§4.1) to remove the tap delay on older browsers.
- If flicker or bleed-through appears on mobile Safari, use the cross-fade fallback described in §4.1.

#### 7.4.5 Filter bar on mobile

The sticky bar from §7.3 would wrap to three rows on a phone — person pills, then two selects — consuming roughly a third of the viewport. Below the tablet breakpoint:

- The person pills become a **single horizontally scrolling row**:
  ```css
  display: flex;
  overflow-x: auto;
  flex-wrap: nowrap;
  scrollbar-width: none;           /* hide the bar, keep the scroll */
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  ```
  with `scroll-snap-align: start` and `flex-shrink: 0` on each pill.
- Occasion and price selects sit on **one row together**, each `flex: 1`.
- Total sticky height must stay **under 100px**. Measure it — if it exceeds that, move the two selects behind a `Filters` toggle button (with `aria-expanded`) that expands them below the pills. Put the 100px limit in `theme.js` as a token.
- The input bar is **not** sticky on mobile. It scrolls away with the page; only the filter bar sticks.

#### 7.4.6 Input bar on mobile

- All five controls stack to **full width**, one per row, below the phone breakpoint.
- The link field gets `type="url"` and `inputmode="url"`; the price field gets `type="number"` and `inputmode="decimal"`. This changes the on-screen keyboard and is the single biggest quality-of-life win for saving from a phone.
- Input font size is 16px below the tablet breakpoint via the `--size-input` override in §3.3 — iOS Safari auto-zooms the page on focus for anything smaller.
- Save is full-width on mobile, since it is the only action.

#### 7.4.7 Mobile verification

These checks need a real browser and a human looking at the screen. After Phase 7, **list them for me** with instructions for how to check each one; I will verify them in browser device mode and on a real phone.

Widths: **320px, 375px, 414px, 768px**, using `?fixtures=1` and then real data.

- [ ] One column below 480px, cards full-width with a 16px gutter.
- [ ] Back face action row visible without scrolling at 320px for a typical item.
- [ ] Flip works on tap, first time, with no flicker or bleed-through.
- [ ] All buttons have at least a 44×44px hit area (chips exempt).
- [ ] Focusing any input does not zoom the page on iOS.
- [ ] Filter bar sticks, stays under 100px tall, and the person pills scroll horizontally.
- [ ] Background illustration is hidden below 768px.
- [ ] No horizontal page scroll at any width — the page body never moves sideways.

---

## 8. Quality floor

Non-negotiable, and not worth announcing in the UI:

- **Responsive** to 320px. `auto-fill` handles the grid; check the input bar wraps cleanly and the card body does not overflow.
- **Visible keyboard focus** on every interactive element: buttons, links, inputs, selects, pills, flip and close buttons, dialog buttons. Use `:focus-visible` with an outline of `--border-focus-ring` solid, offset by `--space-focus-offset`: `--color-focus-ring-on-dark` inside cards, `--color-focus-ring-on-light` everywhere else. Do not remove outlines without replacing them.
- **Reduced motion** respected on the flip and the pending shimmer.
- **Alt text**: card images are decorative next to a visible title, so `alt=""` is correct. Icon-only buttons need `aria-label`. Decorative inline SVG icons get `aria-hidden="true"`.
- **Contrast**: see §8.1. **Verify it — do not assume it.**
- **One component per card.** Every card renders from the same `Card` component with no per-index or conditional styling. Any visual difference between two cards must come from the data, never from position in the grid.

### 8.1 Contrast (WCAG AA)

Text needs at least **4.5:1** against its background. Non-text boundaries that identify a control (input borders, focus rings) need at least **3:1**. These pairings were computed for the tokens in §3.1:

| Pairing | Ratio | Requirement |
|---|---|---|
| `textStrong` on `cardBg` (titles, values) | 12.96 | 4.5 ✓ |
| `textBody` on `cardBg` (description, failed message) | 7.68 | 4.5 ✓ |
| `textMuted` on `cardBg` (labels, price, hostname) | 5.56 | 4.5 ✓ |
| `textBody` on `surfaceRaised` (chips) | 5.32 | 4.5 ✓ |
| `tagText` on `tagBg` (front tags) | 11.41 | 4.5 ✓ |
| `visitText` on `visitBg` (Visit button) | 12.96 | 4.5 ✓ |
| `dangerOnDark` on `cardBg` (card Delete, card errors) | 5.71 | 4.5 ✓ |
| `dangerOnLight` on `dialogBg` (dialog error) | 5.67 | 4.5 ✓ |
| white on `dangerOnLight` (dialog Delete button) | 5.67 | 4.5 ✓ |
| `inputText` on `inputBg` | 17.06 | 4.5 ✓ |
| `inputPlaceholder` on `inputBg` | 5.14 | 4.5 ✓ |
| white on `cardBg` (Save, active pill) | 12.96 | 4.5 ✓ |
| `inputBorder` vs `inputBg` | 3.61 | 3.0 ✓ |
| `inputBorder` vs `pageBg` | 3.23 | 3.0 ✓ |
| `textMuted` on `surfaceRaised` (fallback gift icon) | 3.85 | 3.0 ✓ (non-text) |
| `focusRingOnLight` vs `pageBg` | 11.61 | 3.0 ✓ |
| `focusRingOnDark` vs `cardBg` | 12.96 | 3.0 ✓ |

If you add a pairing not in this table, or any token value changes (especially `pageBg`), compute the ratio and report it. Do not ship a pairing below its requirement.

---

## 9. Suggested file structure

Adapt to the project's existing conventions — if it already has a different structure, follow that instead and say so in the Phase 0 report.

```
src/
  theme.js                  — all design tokens (§3.1) — the single source of truth
  GlobalStyle.js            — writes tokens to :root as CSS variables, responsive
                              overrides (§3.3), resets, font default, html background
  constants/
    status.js               — real status values from Phase 0 (§5)
  components/
    InputBar.jsx            — restyled, behavior unchanged
    FilterBar.jsx           — restyled + occasion & price filters (§7.3)
    Grid.jsx                — auto-fill grid, empty states (§6.7)
    BackgroundIllustration.jsx — §7.2
    Card/
      index.jsx             — flip container, state, chooses variant by status (§5)
      CardFront.jsx         — §4.2
      CardBack.jsx          — §4.3, §4.4
      PendingCard.jsx       — §5 (pending and failed variants)
      ImageWithFallback.jsx — §2.2
    ConfirmDialog.jsx       — §4.5
  utils/
    themeToCssVars.js       — §3.0
    formatPrice.js          — §2.3
    httpsUpgrade.js         — §2.2
    hostname.js             — §5
    filterItems.js          — person / occasion / price filtering (§7.3)
  dev/
    fixtures.js             — §6.0, development only
```

---

## 10. Definition of done

- [ ] No backend file changed. No new API route. No new DB field. No test data sent to the API.
- [ ] Every rendered value traces to a field in §2.1.
- [ ] `norm_url`, `raw_title`, and `created_at` are not rendered anywhere.
- [ ] All colors, fonts, sizes, and spacing come from `theme.js`, referenced in components only through CSS variables. No inline hex, no magic numbers.
- [ ] `pageBg` is a single named token that can be changed in one place.
- [ ] Playfair Display appears on card titles and nowhere else.
- [ ] Every card, including pending and failed cards, is the same height regardless of data.
- [ ] Flip works via a dedicated button, on mouse, keyboard, and touch, and focus follows the flip.
- [ ] Visit is reachable from both faces without flipping.
- [ ] Delete shows a real, focus-trapped confirmation dialog, never `window.confirm`, and focus lands sensibly after success, failure, and cancel.
- [ ] Pending and failed items render correctly with Delete still available, and failure is checked before pending.
- [ ] All cases in §6 verified with `?fixtures=1`.
- [ ] Every contrast pairing in use meets §8.1.
- [ ] Works at 320px, 375px, 414px, 768px, and 1440px.
- [ ] §7.4.7 checklist handed to me for manual verification.
- [ ] Keyboard focus visible everywhere; reduced motion respected.

---

## 11. Work plan — stop after every phase

**Do not begin the next phase until I reply "continue".** At the end of every phase, report:

1. The files you created or changed.
2. What I should check in the browser, and the URL to check it at (including `?fixtures=1` where relevant).
3. Anything you could not do, and any conflict between this spec and the existing code.

Keep each phase to its listed scope. If you notice something outside the current phase that needs changing, note it in the report instead of doing it.

### Phase 0 — Recon. Change no files.

Read the existing frontend (and backend code, read-only, where needed to answer a question). Report:

- Framework and build tool (e.g. Vite + React), and JavaScript or TypeScript.
- The current styling approach (plain CSS, CSS modules, Tailwind, other) and whether `styled-components` is already installed.
- Each endpoint from §2.4: HTTP method, URL, request payload shape, response shape, and the file and line where it is called.
- Whether an edit endpoint exists, and which fields it accepts.
- Whether the create call allows a missing price (needed for §4.4).
- The actual `status` values the backend produces, including every failure value (§5).
- Whether the frontend currently polls or refetches items.
- Where the person list and occasion input options come from, and whether occasion is free text or a fixed list.
- The existing component and folder structure, compared with §9.
- Any conflict between this spec and the existing code.

### Phase 1 — Tokens and global styles

§3 in full: install `styled-components`, create `theme.js`, `themeToCssVars.js`, and `GlobalStyle.js` with the responsive overrides; load fonts; set the `html` background. The existing UI should look largely the same apart from background and fonts. Nothing else changes.

### Phase 2 — Fixtures, grid, card front, image fallback

§6.0 (fixtures and the `?fixtures=1` switch), §2.2, §2.3, §4.2, §7.1, and the empty states from §6.7. Card front only — no flip yet. Include the reserved title and price slots from §4.1.

### Phase 3 — Flip, card back, delete dialog

§4.1 (flip, focus handling, `inert`), §4.3, §4.5. Edit button renders but does nothing yet.

### Phase 4 — Edit

§4.4, using the Phase 0 findings. If no edit endpoint exists, implement the disabled state only.

### Phase 5 — Pending and failed cards

§5, using the real status values from Phase 0.

### Phase 6 — Input bar and filter bar

§7.3: restyle the input bar, restyle person pills, add occasion and price filters, sticky filter bar.

### Phase 7 — Mobile pass, background illustration, final verification

§7.2, §7.4, §8. Walk through every case in §6 with fixtures and confirm each one. Compute contrast for any pairing not in §8.1. Then produce the final summary below and hand me the §7.4.7 checklist.

**Final summary must explicitly report:**

1. The endpoints you found and reused, and any you could not find.
2. Whether the edit endpoint exists.
3. The actual `status` values the backend produces.
4. Anything in this spec you could not implement without touching the backend.
5. Any deviation from this spec, and why.

---

## 12. Known limitations and out of scope

These are acknowledged, not bugs. Do not attempt to fix them in this redesign; mention them in the final summary only if you find new information.

- **Expiring images.** Instagram image URLs are signed and expire, so those cards will show the fallback over time. Fix later: the backend stores a copy of each image at save time.
- **Mixed currencies in the price filter.** Ranges ignore `currency`. Fix later: store a normalized price, or filter within a single currency.
- **No polling.** If the existing code does not refresh items, pending cards only update on reload. Fix later: polling or a push mechanism, which is a behavior change.
