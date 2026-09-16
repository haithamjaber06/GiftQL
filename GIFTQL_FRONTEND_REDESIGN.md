# GiftQL — Frontend Redesign Spec

## 0. Read this first

This is a **frontend-only** redesign. You are rebuilding how items are displayed. You are not changing the backend, the database, the scraper, the enrichment pipeline, or any API route.

**Hard rules:**

1. **Do not modify any backend file.** No route handlers, no models, no migrations, no serializers, no scraping/enrichment logic.
2. **Do not add, rename, or remove any database field.** Every value on screen must come from a field that already exists in the API response documented in §2.
3. **Do not invent API endpoints.** Before writing any fetch call, read the existing frontend code and reuse the exact URLs, methods, and payload shapes it already uses. If you cannot find an existing call for something (e.g. editing an item), stop and report it rather than guessing.
4. **Do not add new dependencies** beyond `styled-components` (and its types, if the project is TypeScript) unless you stop and ask first.
5. If any instruction here conflicts with what the existing code actually does, **the existing code wins** — report the conflict instead of silently changing behavior.

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

The input bar and filter bar keep their **existing behavior and existing API calls**. Only their styling changes. The grid and the card are what genuinely change.

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
| `url` | string | `href` of the **Visit** button | Opens in a new tab |
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

### 2.2 `img_url` — three problems you must handle

**Problem 1 — protocol.** The sample `img_url` starts with `http://`, not `https://`. If the site is served over HTTPS, browsers block this as mixed content and the image silently fails to load. Before using the URL, upgrade the protocol on the client:

```js
const safeSrc = img_url ? img_url.replace(/^http:\/\//i, 'https://') : null;
```

If the host does not support HTTPS the image will still fail — that is fine, the fallback in Problem 2 covers it. **Do not** add a backend proxy to solve this; that would be a backend change.

**Problem 2 — missing or broken.** `img_url` may be null, and even when present the remote image may 404 or be blocked. Both cases must render the fallback, not a broken-image icon. Handle **both**:

```jsx
const [failed, setFailed] = useState(false);
// render fallback when: !img_url || failed
<img src={safeSrc} onError={() => setFailed(true)} alt="" />
```

**Problem 3 — format.** The sample is `.avif`. Modern browsers handle this; older ones do not. The `onError` handler above already covers it. No extra work needed.

**The fallback** is an inline SVG gift icon, centered on a `--color-surface-raised` background, filling the same 1:1 box. Do not use a third-party placeholder service. Do not use an emoji.

### 2.3 Price formatting

`price` is a **number** and `currency` is a **separate string**. Render them joined with a single space:

```js
price == null ? null : `${price} ${currency}`   // → "15 JOD"
```

Do not hardcode "JOD". Do not add a currency symbol. Do not add decimal places — `15` renders as `15 JOD`, not `15.00 JOD`. If `price` is null, omit the price element entirely rather than rendering "null" or "—".

### 2.4 Endpoints

**You must read these from the existing code — they are not documented here.** Find the current calls for:

- Fetching the item list (GET)
- Creating an item from the input bar (POST)
- Deleting an item (DELETE)
- Editing an item (PATCH or PUT)

Reuse them exactly. If the **edit** call does not exist in the current codebase, do not invent one: build the Edit UI, disable the save action, and report in your summary that the edit endpoint is missing. Everything else in this spec is achievable without it.

---

## 3. Design tokens

All tokens live in **one file**: `src/theme.js` (or `theme.ts`). Every color, font, size, and radius used anywhere in the redesign must reference this file. No hex values inline in components, no magic numbers.

Use the styled-components `ThemeProvider` and wrap the app root with it.

```js
export const theme = {
  color: {
    // Page
    pageBg:        '#F2F1FF',   // owner changes this often — keep it first and named clearly

    // Brand blue ramp — derived from the card color, do not substitute other blues
    cardBg:        '#021F93',   // card surface
    surfaceRaised: '#1A3AB8',   // image fallback background, label chips
    border:        '#3D5AC9',   // hairline borders inside the card
    textMuted:     '#93A7EE',   // field labels, price on front, secondary icons
    textBody:      '#B9C6F4',   // description text on the back
    textStrong:    '#FFFFFF',   // titles, primary button label, field values

    // Tag on the card front (light pill on dark card)
    tagBg:         '#EDF0FD',
    tagText:       '#021F93',

    // Controls on the light page background
    inputBg:       '#FFFFFF',
    inputBorder:   '#D9D7F5',
    inputText:     '#1A1A2E',
    inputPlaceholder: '#8A88B8',

    // Destructive
    danger:        '#E5484D',
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
    input:       '14px',
  },

  weight: {
    regular: 400,
    medium:  500,
  },

  radius: {
    card:   '12px',
    image:  '8px',
    pill:   '999px',
    button: '8px',
    input:  '8px',
  },

  space: {
    cardPadding:  '14px',
    gridGap:      '16px',
    pageGutter:   '24px',
  },

  shadow: {
    card: '0 1px 3px rgba(2,31,147,0.08), 0 4px 12px rgba(2,31,147,0.06)',
  },

  grid: {
    minCardWidth: '240px',
    maxPageWidth: '1200px',
  },
};
```

**Load the fonts** from Google Fonts in `index.html` (or the framework's head equivalent):

- Playfair Display — weights 400, 500
- DM Sans — weights 400, 500

Include a real fallback stack, exactly as written in the tokens above. Do not load additional weights.

### 3.1 Typography rules

- **Playfair Display** is used for **card titles only** — nothing else.
- **DM Sans** is used for everything else: description, field labels, field values, chips, buttons, inputs, filter pills.
- Only two weights exist in this design: 400 and 500. Do not use 600, 700, or bold.
- Do not use all-caps anywhere. `raw_title` is uppercase in the data — this is one reason it is not rendered.
- Line height: 1.35 for titles, 1.55 for description, 1.4 for everything else.

---

## 4. The card

This is the centerpiece. One component, `Card`, used for every item.

### 4.1 Flip behavior

The card flips between a front and a back face.

**The flip is triggered by a dedicated button, not by clicking the card.** This is deliberate. Making the whole card clickable conflicts with the Visit link inside it and is unreliable on touch devices.

- **Front:** a chevron-down button in the bottom-right of the card body.
- **Back:** an X button in the top-right of the card body.
- Both buttons need `aria-label`s: `"Show details"` and `"Hide details"`.
- Flip state is **local to each card** (`useState` inside `Card`). Flipping one card must not affect any other.

**Implementation:**

```
.flip-container  { perspective: 1000px; }
.flip-inner      { transform-style: preserve-3d; transition: transform 0.4s; }
.flip-inner.is-flipped { transform: rotateY(180deg); }
.face            { backface-visibility: hidden; position: absolute; inset: 0; }
.face--back      { transform: rotateY(180deg); }
```

**Height:** both faces are absolutely positioned, so the container needs an explicit height. Give the flip container a **fixed height** so all cards in a row match. Compute it from the 1:1 image plus the body, and verify against real data. If the back overflows that height, the back face body scrolls internally (`overflow-y: auto`) — the card does **not** grow.

**Accessibility:**

- Wrap in `@media (prefers-reduced-motion: reduce)` and set `transition: none` so the faces swap instantly.
- The hidden face must not be keyboard-focusable. `backface-visibility` hides it visually but **not** from tab order. Add `inert` to the hidden face, or `visibility: hidden` on it (and `visibility: visible` on the shown face) as a fallback.

### 4.2 Card front

```
┌─────────────────────────┐
│ ┌─────────────────────┐ │
│ │[Just Because] [Prod]│ │   ← occasion tag (left), kind tag (right)
│ │                     │ │
│ │      1:1 image      │ │
│ │                     │ │
│ └─────────────────────┘ │
│ Coconuts Eternal Oud    │   ← Playfair Display 16px / 500
│ Intimate Splash, 150ml  │
│ 15 JOD                  │   ← DM Sans 13px, textMuted
│                         │
│ ┌───────────────┐  ┌──┐ │
│ │     Visit     │  │ ⌄│ │
│ └───────────────┘  └──┘ │
└─────────────────────────┘
```

| Element | Source | Styling |
|---|---|---|
| Image | `img_url` (§2.2) | `aspect-ratio: 1 / 1`, `object-fit: cover`, `radius.image` |
| Occasion tag | `occasion` | Overlaid top-left of the image. `tagBg` / `tagText`, `radius.pill`, `size.tag`. **Omit entirely if `occasion` is null.** |
| Kind tag | `kind` | Overlaid top-right of the image. Same pill styling as the occasion tag. |
| Title | `title` | `font.display`, `size.cardTitle`, `weight.medium`, `textStrong`. Clamp to 2 lines. |
| Price | `price` + `currency` | `font.body`, `size.cardPrice`, `textMuted`. Omit if `price` is null. |
| Visit | `url` | An `<a>` styled as a button. White background, `cardBg` text, `weight.medium`. `target="_blank"` with `rel="noopener noreferrer"`. Flexes to fill available width. |
| Flip button | — | 32×32, transparent, 0.5px `border`, `textMuted` chevron icon. |

The card body (everything below the image) uses `space.cardPadding` on **all four sides**, matching the image's inset.

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
│ ─────────────────────── │   ← hairline, color.border
│ ┌────────┐ ┌────┐ ┌───┐ │
│ │ Visit  │ │Edit│ │Del│ │
│ └────────┘ └────┘ └───┘ │
└─────────────────────────┘
```

| Element | Source | Styling |
|---|---|---|
| Title | `title` | Same as front. 2-line clamp. |
| Close button | — | 26×26, no border, `textMuted` X icon, top-right. |
| Description | `description` | `font.body`, `size.body`, `textBody`, `line-height: 1.55`, clamped to 3 lines via `-webkit-line-clamp`. Omit the element entirely if null or empty. |
| Field rows | `person`, `occasion`, `price`+`currency` | Two columns. Label left in `textMuted`, value right-aligned in `textStrong`. Labels are exactly `For`, `Occasion`, `Price` — sentence case, not all caps. |
| Label chips | `labels` | `surfaceRaised` background, `textBody` text, `size.chip`, `radius.pill`. Wrap freely. See §6.4 for the overflow rule. |
| Divider | — | 0.5px solid `color.border`, full width, above the action row. |
| Visit | `url` | Identical to the front's Visit button. **The primary action exists on both faces** — a user must never have to flip back to open a link. |
| Edit | — | Outlined: transparent background, 0.5px `border`, `textBody` text. See §4.4. |
| Delete | `id` | Text only: no background, no border, `color.danger`. Quietest element in the row. See §4.5. |

The action row is pinned to the bottom (`margin-top: auto` on a flex column).

### 4.4 Edit

Only two fields are editable: **`occasion`** and **`price`**. Everything else is read-only.

Clicking **Edit** turns the `Occasion` and `Price` rows on the back into inputs in place. The Edit button becomes **Save**, and a **Cancel** text button appears next to it.

- Occasion: a text input (or a select, if the existing input bar already uses a fixed occasion list — match whatever it does).
- Price: a number input. `currency` is **not** editable; show it as static text beside the input.
- On Save: call the existing PATCH/PUT endpoint (§2.4), update local state optimistically, and revert with an error message if the call fails.
- On Cancel: discard changes and return to read-only.

**If no edit endpoint exists in the current code**, render the Edit button disabled with `title="Editing isn't wired up yet"` and report this. Do not invent a route.

### 4.5 Delete

Delete opens a **confirmation dialog** before anything is sent.

- Dialog content: the item title, and a plain question — `Delete "<title>"?`
- Two actions: **Cancel** (quiet) and **Delete** (`color.danger`).
- Only on confirming Delete does the DELETE request fire.
- Build it as a real modal: rendered in a portal, with a backdrop, `role="dialog"`, `aria-modal="true"`, focus moved into the dialog on open and returned to the Delete button on close, and Escape to cancel.
- Do **not** use `window.confirm()`.
- On success, remove the card from local state. On failure, keep the card and show the error.

---

## 5. Pending and failed items

`status` is not always `"Done"`. Items are enriched after they are submitted, so a freshly-saved item may have no title, no image, and no price yet.

**When `status !== "Done"`, render a pending card instead of the normal card.**

The pending card:

- Has the same dimensions, radius, background, and shadow as a normal card — the grid must not shift when an item finishes enriching.
- Shows a shimmer/skeleton block in the 1:1 image area, and two skeleton bars where the title and price go.
- Shows `url` (or its hostname) as small `textMuted` text, so the user can tell which item it is.
- Has **no** flip button, **no** Visit button, and **no** Edit.
- Keeps **Delete** available, so a stuck item can be removed.
- Respects `prefers-reduced-motion`: no shimmer animation, just a static muted block.

**If `status` indicates failure** (check the actual values the backend produces — read the code, do not assume the string), show the same card shape but with a short message instead of the shimmer, and keep Delete available. Do not hide failed items.

**Polling:** if the existing code already refetches or polls, leave that logic alone. If it does not, **do not add polling** — that is a behavior change beyond this spec's scope. Report it as a suggestion instead.

---

## 6. Edge cases — test every one of these

Before you consider this done, render the grid with items that hit each case. Use real data from the API, not the sample above repeated twelve times. A layout that only works with three identical well-formed items is not finished.

### 6.1 Missing image
`img_url` is null, or the URL 404s, or the protocol is `http://`. → Fallback gift SVG, correct 1:1 box, no broken-image icon, no layout shift.

### 6.2 Missing description
`description` is null or `""`. → The description element is not rendered at all. The back does not leave an empty gap; the field rows move up.

### 6.3 Very long title
A 90-character title. → Clamps to 2 lines with an ellipsis on both faces. Card height does not change.

### 6.4 Too many labels
An item with 9 labels. → Show the first 4 chips, then a `+5` chip in the same style. Do not let chips push the action row out of the card.

### 6.5 No labels
`labels` is `[]`. → The chip row is not rendered. No empty gap.

### 6.6 Null price or occasion
Either is null. → That element is omitted on the front; on the back the row shows nothing rather than "null", "undefined", or "N/A".

### 6.7 Empty grid
No items at all, or a filter matches nothing. → An empty state, not a blank page. One line of plain copy and nothing else. For no items: `Paste a link above to save your first idea.` For a filter with no matches: `No gifts saved for <person> yet.` Do not use an illustration, and do not apologize.

### 6.8 Long person or occasion values
A 20-character occasion like "Graduation Ceremony". → The front tag truncates with an ellipsis rather than wrapping over the image or overlapping the kind tag.

---

## 7. Grid and page

### 7.1 Grid

```css
display: grid;
grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
gap: 16px;
```

`auto-fill` with a 240px minimum. Do not hardcode a column count — the grid adapts to the viewport, which also handles mobile with no extra work.

Constrain the page content to `grid.maxPageWidth` (1200px), centered, with `space.pageGutter` on each side.

### 7.2 Background illustration

Keep the existing gift illustration behind the grid at **3% opacity**.

- `position: fixed` or absolute behind the content, `z-index: -1`, `pointer-events: none`, `aria-hidden="true"`.
- At 3% it should be barely perceptible. If it is legible as a distinct shape at normal viewing distance, it is too strong.
- Hide it entirely below 768px width — on mobile it only adds noise.

### 7.3 Input bar and filter bar

**Behavior is unchanged.** These already work. Restyle only.

**Input bar** — fields in a single row, wrapping on narrow screens: `Paste a link` (text), `Person` (select), `Occasion` (text), `Price` (number), `Save` (button).

- Inputs: `inputBg` background, 0.5px `inputBorder`, `radius.input`, `size.input`, `font.body`.
- Placeholder text in `inputPlaceholder`.
- Save button: `cardBg` background, white text, `weight.medium`, `radius.button`. It is the only filled control in the bar.
- The link field is the widest; it takes remaining space via `flex: 1`.

**Filter bar** — currently person-only. **Add occasion and price filters** alongside it, using the values already present in the fetched items. This is a frontend-only grouping of data you already have; it requires no API change.

- Person: pill buttons, as now. Active pill = `cardBg` background with white text; inactive = white background, `inputBorder` border, `inputText` text.
- Occasion: a select, populated from the distinct `occasion` values across the loaded items, plus an "All occasions" option.
- Price: a select with fixed ranges — `Any price`, `Under 15`, `15–50`, `Over 50`. Filter on the `price` number. Items with a null `price` are excluded from every range except `Any price`.
- Filters combine with AND.
- The whole bar is `position: sticky; top: 0` with the page background color and a `z-index` above the grid, so it stays reachable on a long list.

---

## 7.4 Mobile

Mobile is where this app is actually used — links get saved from a phone and browsed from a phone. Treat phone layout as a first-class target, not a shrink of the desktop view.

Breakpoints, added to the theme:

```js
breakpoint: {
  phone:  '480px',   // single column, compact card
  tablet: '768px',   // two columns, illustration hidden below this
}
```

### 7.4.1 Grid at narrow widths

`minmax(240px, 1fr)` leaves almost no gutter on a 320px screen. Lower the minimum below the phone breakpoint:

```css
grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
gap: 16px;

@media (max-width: 480px) {
  grid-template-columns: 1fr;   /* one full-width card */
  gap: 12px;
}
```

Also reduce `space.pageGutter` from 24px to 16px below 480px.

### 7.4.2 Card height

The fixed flip-container height from §4.1 is the most likely thing to break on a phone. A height tuned for a 240px-wide desktop card will clip the back face on a 375px screen where the 1:1 image is much taller.

**Do not use one fixed height for all viewports.** Instead:

- Define the height from the image plus a fixed body allowance, in CSS, so it scales with the card width:
  ```css
  height: calc(100% * 0 + var(--image-height) + var(--body-height));
  ```
  In practice: let the **front face** define the height naturally (it is predictable — image, 2-line title, price, button row), and give the flip container that height via a `ResizeObserver` or by measuring the front face with a ref on mount and on resize.
- The **back face** then fills that height and scrolls internally when its content is taller:
  ```css
  .face--back .body { overflow-y: auto; -webkit-overflow-scrolling: touch; }
  ```
- Verify explicitly at 320px, 375px, and 414px that the back face's action row (Visit / Edit / Delete) is visible without scrolling. If it is not, the description clamp drops from 3 lines to 2 below 480px.

### 7.4.3 Touch targets

The 26px close button and 32px flip button are below the 44×44px minimum for touch. Below the tablet breakpoint:

- Flip button, close button, and the heart-sized icon buttons all get a **44×44px hit area**.
- Keep the *icon* the same visual size — expand the padding, not the glyph. Use a transparent padded wrapper so the button does not look bulky:
  ```css
  @media (max-width: 768px) {
    min-width: 44px;
    min-height: 44px;
  }
  ```
- Visit, Edit, and Save buttons get `min-height: 44px` on mobile.
- Delete stays text-only but also gets a 44px tall hit area — it must be easy to *read* as quiet, and still easy to *hit*.
- Label chips on the back are display-only, so they are exempt.

### 7.4.4 Flip on touch

There is no hover on touch, so the flip affordance must be visible at rest.

- The chevron button is always visible on the front — never hover-revealed.
- Do not add a hover-only hint anywhere in the card.
- 3D transforms with `preserve-3d` are unreliable on older mobile Safari (flicker, z-fighting, and the hidden face bleeding through). Add:
  ```css
  .flip-inner, .face {
    -webkit-backface-visibility: hidden;
    -webkit-transform-style: preserve-3d;
  }
  ```
  If flicker still appears in testing, **fall back to a cross-fade** below the tablet breakpoint (opacity + `visibility` swap, no rotation) rather than shipping a broken flip. The interaction stays the same from the user's side.
- `touch-action: manipulation` on the card removes the 300ms tap delay on older browsers.

### 7.4.5 Filter bar on mobile

The sticky bar from §7.3 will wrap to three rows on a phone — person pills, then two selects — consuming roughly a third of the viewport. Below 768px:

- The person pills become a **single horizontally scrolling row**:
  ```css
  display: flex;
  overflow-x: auto;
  flex-wrap: nowrap;
  scrollbar-width: none;           /* hide the bar, keep the scroll */
  -webkit-overflow-scrolling: touch;
  ```
  with `scroll-snap-type: x proximity` and `scroll-snap-align: start` on each pill.
- Occasion and price selects sit on **one row together**, each `flex: 1`.
- Total sticky height must stay **under 100px**. Measure it — if it exceeds that, move the two selects behind a "Filters" toggle that expands below the pills.
- The input bar is **not** sticky on mobile. It scrolls away with the page; only the filter bar sticks.

### 7.4.6 Input bar on mobile

- All five controls stack to **full width**, one per row, below 480px.
- The link field gets `type="url"` and `inputmode="url"`; the price field gets `type="number"` and `inputmode="decimal"`. This changes the on-screen keyboard and is the single biggest quality-of-life win for saving from a phone.
- `font-size` on inputs must be **at least 16px on mobile** — iOS Safari auto-zooms the page on focus for anything smaller, which is jarring and hard to undo. Override `size.input` to 16px below 768px.
- Save is full-width on mobile, since it is the only action.

### 7.4.7 Mobile verification

Test on a real device or a device emulator at these widths, with real data: **320px, 375px, 414px, 768px**.

Check specifically:

- [ ] One column below 480px, cards full-width with a 16px gutter.
- [ ] Back face action row visible without scrolling at 320px.
- [ ] Flip works on tap, first time, with no flicker or bleed-through.
- [ ] All buttons are at least 44×44px.
- [ ] Focusing any input does not zoom the page on iOS.
- [ ] Filter bar sticks, stays under 100px tall, and the person pills scroll horizontally.
- [ ] Background illustration is hidden below 768px.
- [ ] No horizontal page scroll at any width — the page body never moves sideways.

---

## 8. Quality floor

Non-negotiable, and not worth announcing in the UI:

- **Responsive** to 320px. `auto-fill` handles the grid; check the input bar wraps cleanly and the card body does not overflow.
- **Visible keyboard focus** on every interactive element: buttons, links, inputs, pills, chips, flip toggles. Do not remove outlines without replacing them.
- **Reduced motion** respected on the flip and the pending shimmer.
- **Alt text**: card images are decorative next to a visible title, so `alt=""` is correct. Icon-only buttons need `aria-label`.
- **Contrast**: all specified pairings meet AA. If you deviate from the tokens, re-check.
- **One component per card.** Every card renders from the same `Card` component with no per-index or conditional styling. Any visual difference between two cards must come from the data, never from position in the grid.

---

## 9. Suggested file structure

Adapt to the project's existing conventions — if it already has a different structure, follow that instead.

```
src/
  theme.js              — all design tokens (§3)
  GlobalStyle.js        — resets, font-family default, page background
  components/
    InputBar.jsx        — restyled, behavior unchanged
    FilterBar.jsx       — restyled + occasion & price filters (§7.3)
    Grid.jsx            — auto-fill grid, empty states (§6.7)
    Card/
      index.jsx         — flip container, state, chooses variant by status
      CardFront.jsx     — §4.2
      CardBack.jsx      — §4.3
      PendingCard.jsx   — §5
      ImageWithFallback.jsx  — §2.2
    ConfirmDialog.jsx   — §4.5
  utils/
    formatPrice.js      — §2.3
    httpsUpgrade.js     — §2.2
```

---

## 10. Definition of done

- [ ] No backend file changed. No new API route. No new DB field.
- [ ] Every rendered value traces to a field in §2.1.
- [ ] `norm_url`, `raw_title`, and `created_at` are not rendered anywhere.
- [ ] All colors, fonts, and sizes come from `theme.js`. No inline hex, no magic numbers.
- [ ] `pageBg` is a single named token that can be changed in one place.
- [ ] Playfair Display appears on card titles and nowhere else.
- [ ] Flip works via a dedicated button, on mouse, keyboard, and touch.
- [ ] Visit is reachable from both faces without flipping.
- [ ] Delete shows a real confirmation dialog, never `window.confirm`.
- [ ] Non-`Done` items render as pending cards with Delete still available.
- [ ] All eight edge cases in §6 verified against real data.
- [ ] Works at 320px, 375px, 414px, 768px, and 1440px.
- [ ] Every item in the §7.4.7 mobile checklist verified.
- [ ] Keyboard focus visible everywhere; reduced motion respected.

**In your final summary, explicitly report:**
1. The endpoints you found and reused, and any you could not find.
2. Whether the edit endpoint exists.
3. The actual `status` values the backend produces.
4. Anything in this spec you could not implement without touching the backend.
