# Step 11b — Show it, and let yourself fix it

**Goal:** the enrichment you built in step 11 becomes visible, and every field the model gets wrong
is one click from being right.

Same rules. You type every line. Each part ends with something on screen.

**What you asked for, in build order:**

| | |
|---|---|
| 1 | Fix the POST/GET shape conflict |
| 2 | Make `title`, `kind`, `price` correctable through the API |
| 3 | CSS for the new boxes |
| 4 | Kind box + labels, description, currency |
| 5 | `Partial` items fall back to the old layout |
| 6 | Click-to-edit |

**Not in this step:** the frontend rework (that's 13), correcting `labels` or `description`,
the corrections log.

Backend first. The frontend can't render fields the API doesn't return.

---

## 11b.1 — One shape for items

Right now `create_item` hand-types its response:

```python
    return {
        "title": None,
        "img_url": None,
        "id": item_id,
        ...
    }
```

Nine keys, typed by hand, missing `kind`, `description`, `labels`, `currency` and `raw_title`.
Meanwhile `list_items` returns every column. So the same item has **two different shapes**
depending on which endpoint you asked, and the one React inserts optimistically after a save is
the incomplete one. The moment part 4 renders `item.labels.map(...)`, saving a new item crashes
the list until you refresh.

**Fix: read the row back and pass it through the same converter.** In `routes/items.py`, replace
the whole `return {...}` block at the end of `create_item`:

```python
    back_ground.add_task(enrich, new.url, item_id)

    with db() as conn:
        row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    return row_to_item(row)
```

- You already wrote `row_to_item`. Now it's the **single place** that decides what an item looks
  like to the outside world.
- Reading the row back costs one trivial query and guarantees the response matches what's actually
  stored — including the defaults SQLite filled in.

> **The rule: one representation, one function.** The moment two places construct the same thing
> independently, they start drifting, and the bug shows up somewhere else entirely. You just felt
> that: the symptom would have appeared in React, three files away from the cause.

⚠️ Note the ordering. `add_task` **schedules** the background job; it doesn't run it. FastAPI runs
it after the response is sent. So the row you read back is still `Pending`, which is correct — that's
what the user should see until enrichment finishes and the poller picks up the change.

### ✅ Check

Save a link, then open <http://127.0.0.1:8000/docs>, run `POST /api/items` and compare its response
to `GET /api/items`. Same keys, both times.

---

## 11b.2 — Let the API accept corrections

`ItemUpdate` currently allows `price` and `occasion`. The model now fills `title` and `kind`, and
you can't touch either.

In `app/schemas.py`:

```python
class ItemUpdate(BaseModel):
    title: str | None = None
    kind: str | None = None
    price: float | None = None
    occasion: str | None = None

    @field_validator("price")
    @classmethod
    def round_price(cls, value):
        return value if value is None else round(value, 2)
```

Two things this quietly gets right:

**`exclude_unset=True` still does the work.** Your `update_item` calls
`patch.model_dump(exclude_unset=True)`, which returns *only the fields the request actually sent* —
not the ones sitting at their `None` default. So a PATCH of `{"kind": "store"}` updates `kind` and
leaves `title` alone. Without `exclude_unset`, you'd wipe three fields every time you fixed one.

**The f-string in the SQL is still safe.** `sets` is built from `fields.keys()`, and those keys can
only ever be the four names above — Pydantic rejects anything else before your code runs. The
values still go through `?`. The rule from step 2 is about **values**, and it's intact.

Now make PATCH return the whole updated item, so React can swap the row wholesale instead of
patching its own copy:

```python
    with db() as conn:
        cursor = conn.execute(f"UPDATE items SET {sets} WHERE id = ?", values)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="No Such Item")
        row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    return row_to_item(row)
```

Same principle as 11b.1 — every endpoint returns an item through `row_to_item`, or it doesn't
return an item.

### ✅ Check

In `/docs`, PATCH an item with `{"kind": "store"}`. The response should be the **full** item, with
`kind` changed and everything else intact.

---

## 11b.3 — CSS for the new pieces

All of this goes in `frontend/src/index.css`. Nothing existing is deleted.

**Widen the grid** — find `.item` and replace its two grid lines:

```css
.item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(120px, max-content) repeat(3, minmax(90px, max-content));
  grid-template-areas: "title kind person occasion price";
  gap: 8px;
  align-items: stretch;
}
```

**The rollback layout** — add straight after `.item`:

```css
.item-partial {
  grid-template-columns: minmax(0, 1fr) repeat(3, minmax(90px, max-content));
  grid-template-areas: "title person occasion price";
}
```

That's the whole trick for part 5. The old layout isn't gone — it's a class you switch back on.
Because `.item-partial` comes later in the file and has the same specificity, it wins.

**The new boxes:**

```css
.box-kind {
  grid-area: kind;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  font-size: 0.85rem;
}

.kind {
  font-weight: 500;
}

.labels {
  list-style: disc;
  margin: 0;
  padding-left: 1rem;
  color: var(--muted);
  font-size: 0.75rem;
}

.desc {
  color: var(--muted);
  font-size: 0.78rem;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

`--muted` is already in your `:root`. Reusing it rather than inventing a new grey is what keeps a
design coherent — you have a palette, use it.

**The `Partial` badge** — find `.pending, .failed` and add `.partial` to both rules:

```css
.pending,
.failed,
.partial {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  margin-top: 4px;
}

.partial {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--muted);
}
```

> I'm adding this badge on top of what you asked for, and it's the important half. Rolling back the
> layout hides the missing fields — but a `Partial` item and a `Done` item with sparse data would
> then look identical. Your contract doc's Rule 2 is that the system may be **uncertain out loud**,
> never quietly wrong. The badge is the "out loud".

**Editing affordances:**

```css
.editable {
  cursor: text;
  border-bottom: 1px dashed transparent;
}

.editable:hover {
  border-bottom-color: var(--border);
}

.edit {
  font: inherit;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--accent);
  border-radius: 4px;
  padding: 1px 4px;
  width: 100%;
  min-width: 60px;
  box-sizing: border-box;
}
```

The dashed underline appears only on hover — enough to say "this is clickable" without turning
every card into a form.

**Mobile** — update the media query at the bottom so `kind` gets its own row:

```css
@media (max-width: 600px) {
  .item {
    grid-template-columns: repeat(3, minmax(90px, max-content));
    grid-template-areas:
      "title  title    title"
      "kind   kind     kind"
      "person occasion price";
  }

  .item-partial {
    grid-template-areas:
      "title  title    title"
      "person occasion price";
  }
}
```

### ✅ Check

Nothing visible yet — no element uses these classes. Confirm the page still looks normal, then
move on.

---

## 11b.4 — Render the new fields

In `App.jsx`, inside the `.map`, first work out whether this item was enriched:

```jsx
        {shown.map((item) => {
          const enriched = item.status === "Done";
          return (
          <li key={item.id} className={enriched ? "item" : "item item-partial"}>
```

⚠️ You just changed the arrow function from `(item) => (` to `(item) => {`, which means it now
needs an explicit `return` — and a matching `)}` at the end of the map. Braces build a function
*body*; parentheses build a single *expression*. Miss this and you get a blank list with no error,
which is a miserable ten minutes.

**One boolean, used everywhere.** Rather than testing `item.status === "Done"` in five places,
name it once. If you later add a fourth status, one line changes.

**Description**, under the title link inside `.title-text`:

```jsx
              <div className="title-text">
                <a href={item.url} className="title">
                  {item.title || item.url}
                </a>
                {enriched && item.description && (
                  <div className="desc">{item.description}</div>
                )}
```

`enriched && item.description && (...)` — both must be true. A `Partial` item hides it, and so does
a `Done` item whose description came back null. That second guard matters: `null` is a legitimate
answer from the model, and rendering an empty pale line for it looks broken.

**The status badges** — replace the two you have:

```jsx
                {item.status === "Pending" && <div className="pending">Pending!</div>}
                {item.status === "Partial" && <div className="partial">Partial</div>}
                {item.status === "Failed" && <div className="failed">Failed</div>}
```

**The kind box**, between the title box and the person box:

```jsx
            {enriched && (
              <div className="box box-kind">
                <div className="kind">{item.kind || "?"}</div>
                {item.labels?.length > 0 && (
                  <ul className="labels">
                    {item.labels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
```

- `item.labels?.length` — the `?.` is **optional chaining**: if `labels` is undefined, the whole
  expression is `undefined` instead of throwing. Belt and braces now that 11b.1 guarantees it's
  always an array.
- `key={label}` — React needs a stable identity per list item. Labels are short and unique within
  an item, so they work as keys. (Using the array index is the common shortcut and it misbehaves
  when a list reorders.)
- I've stacked kind above the labels rather than putting them literally side by side — in a 120px
  column, side-by-side leaves no room for either. If you want them in a row, change
  `flex-direction: column` to `row` in `.box-kind` and see for yourself.

**Currency**, in the price box:

```jsx
            <div className="box box-sq box-price">
              {item.price ?? ""}
              {enriched && item.price != null && item.currency ? ` ${item.currency}` : ""}
            </div>
```

⚠️ `item.price != null` uses **loose** `!=` deliberately — it catches both `null` and `undefined`
while still letting a price of `0` through. Writing `item.price &&` would hide a genuinely free
item, because `0` is falsy in JavaScript. Rare here, but it's the exact class of bug that survives
for years.

### ✅ Check

Save a real product link. Once it flips to `Done` you should see the kind box with bullet labels,
a pale description under the title, and a currency next to the price.

Then force a `Partial`: put a nonsense model name in `config.py`, restart, save a link. That item
should show four boxes, not five, and a grey `Partial` badge. Put the model name back.

---

## 11b.5 — Click to correct

Two pieces of state at the top of `App`, next to the others:

```jsx
  const [editing, setEditing] = useState(null);   // { id, field } or null
  const [draft, setDraft] = useState("");
```

`editing` holds *which cell* is open — never more than one. `draft` is what you're typing, kept
separate from the saved value so abandoning an edit costs nothing.

Then three functions, below `removeItem`:

```jsx
  function startEdit(item, field) {
    setEditing({ id: item.id, field });
    setDraft(item[field] ?? "");
  }

  async function saveEdit() {
    if (!editing) return;
    const { id, field } = editing;
    const item = items.find((i) => i.id === id);
    setEditing(null);

    if (String(item[field] ?? "") === String(draft)) return;

    const value = field === "price" ? (draft === "" ? null : Number(draft)) : draft;
    const response = await fetch(`${API}/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!response.ok) {
      setError("Couldn't save that");
      return;
    }
    const updated = await response.json();
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }

  function editable(item, field, display) {
    const isOpen = editing && editing.id === item.id && editing.field === field;
    if (!isOpen) {
      return (
        <span className="editable" onClick={() => startEdit(item, field)}>
          {display}
        </span>
      );
    }
    return (
      <input
        className="edit"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={saveEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.target.blur();
          if (e.key === "Escape") {
            setDraft(item[field] ?? "");
            e.target.blur();
          }
        }}
      />
    );
  }
```

The four decisions in there:

**`if (String(item[field] ?? "") === String(draft)) return;`** — click a field, click away, nothing
happens. No pointless PATCH, no pointless write. It also makes Escape work with no extra
machinery: Escape resets the draft to the original, blur fires, the comparison matches, nothing is
sent. Handling cancellation by *making the save a no-op* is much simpler than racing a flag against
a blur event.

**`{ [field]: value }`** — square brackets in an object literal build the key from a variable, so
one function handles all three fields. `field` is `"price"` → `{ price: 25 }`.

**`Number(draft)`** — an `<input>` always gives you a string, even a numeric one. Pydantic would
coerce `"25"` for you, but converting at the boundary means the value in React's state is the same
type as the value in the database. Guessing which side coerced is a recurring source of confusion.

**`setItems(prev => prev.map(...))`** — replace that one item with the server's version. The server
is the authority on what got saved; don't assume your local edit matched it. That's why 11b.2 made
PATCH return the full row.

**Now wire the three fields.** Title:

```jsx
                <a href={item.url} className="title">
                  {item.title || item.url}
                </a>
```

becomes

```jsx
                <div className="title">
                  {editable(item, "title", item.title || item.url)}
                  {" "}
                  <a href={item.url} title="open link">↗</a>
                </div>
```

⚠️ The link has to move. If the title text is both a link and a click-to-edit target, clicking it
navigates away — you'd never get to edit. So the text becomes editable and the arrow becomes the
link. Any editable thing that's also clickable for another reason needs this separation.

Kind — a select, not a text box, because it's one of four values:

```jsx
                <div className="kind">
                  {editing && editing.id === item.id && editing.field === "kind" ? (
                    <select
                      className="edit"
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={saveEdit}
                    >
                      {["product", "store", "idea", "inspo"].map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="editable" onClick={() => startEdit(item, "kind")}>
                      {item.kind || "?"}
                    </span>
                  )}
                </div>
```

A free-text box would let you type `prodcut` and quietly create a fifth category. **Constrain the
input where the data is constrained** — it's the same instinct as the enum in your schema.

Price:

```jsx
            <div className="box box-sq box-price">
              {editable(item, "price", item.price ?? "—")}
              {enriched && item.price != null && item.currency ? ` ${item.currency}` : ""}
            </div>
```

The `"—"` gives you something to click when the price is null — which is exactly the case you most
need to fix.

### ✅ Check

Click a title, type, press Enter — it saves and stays changed after a refresh. Click a price,
press Escape — nothing changes and no request is sent (watch the Network tab). Click a kind, pick
`store` from the dropdown.

---

## Where you are now

Step 11's output is visible, uncertainty is labelled, and the three fields most likely to be wrong
take one click to fix. That last part is what your contract doc calls Rule 3, and it's the thing
that decides whether you're still using this in three months.

**One consequence worth noticing:** you have now built the exact surface the corrections log in
11.9 needs. Every `saveEdit` call is a labelled example — *the model said X, the human said Y*.
Ten lines in `update_item` turns your clicking into an accuracy number.

**Next:**

- **11.9 — the corrections table.** Now genuinely worth doing, because there's finally a way to
  correct things.
- **11v — screenshots and vision.** The reels path. The actual point of the project.
- **12 — free text ideas.**
- **13 — the frontend rework.**
