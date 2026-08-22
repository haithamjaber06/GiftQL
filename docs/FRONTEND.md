# Give it a face — React, step by step

This replaces step 7 of `BUILD.md`. Same rules as before:

- You type every line. Don't copy-paste.
- Every step ends with **something you can see working.** If you can't see it, stop and tell me.
- One step per sitting. Step 3 is the hard one — give it its own evening.

**Before you start**, skim <https://react.dev/learn> up to "Rendering Lists" (~20 min). You don't
need to understand it. You need to have seen the shapes once.

**What you're building toward:** two programs running at the same time. Python on port 8000 handing
out data, React on port 5173 drawing the page. They talk over HTTP, the same way your browser talks
to any website.

---

## Step 0 — Take the face off

**Goal:** `app.py` stops returning HTML and starts returning data.

This step feels like going backwards. By the end your app has no visible page at all. That's
correct. You're pulling the two halves apart so React can own one of them.

### 0.1 Why the HTML has to go

Right now `home()` builds a finished page as a string. React doesn't want a finished page — it
builds the page itself, in the browser. It wants this instead:

```json
[{"id": 3, "url": "https://...", "title": "Walnut Board", "person": "Mom"}]
```

So every route becomes a data route.

### 0.2 The naming convention

You're also renaming things. **REST** is the convention where the URL names a *thing* and the HTTP
method names the *verb*:

| Method | URL | Means |
|---|---|---|
| `GET` | `/api/items` | give me all of them |
| `POST` | `/api/items` | here's a new one |
| `DELETE` | `/api/items/3` | remove number 3 |

Compare `POST /delete/3` — the verb is in the URL and the method is wrong. Yours works, but every
backend you touch after this one uses the table above.

The `/api/` prefix marks "this is for programs, not people." You'll thank yourself later when you
want a real page at `/`.

### 0.3 Rewrite the routes

Replace your three routes with these. Delete the `links` variable at the top too — that was HTML.

```python
@app.get("/api/items")
def list_items(person: str = ""):
    with db() as conn:
        if person:
            rows = conn.execute(
                "SELECT * FROM items WHERE person = ? ORDER BY id DESC", (person,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM items ORDER BY id DESC").fetchall()
    return [dict(row) for row in rows]
```

**Why `dict(row)`.** `sqlite3.Row` behaves like a dictionary but it isn't one, and FastAPI doesn't
know how to turn it into JSON. `dict(row)` makes a real dictionary. The
`[... for row in rows]` part is a **list comprehension** — a loop that builds a list in one line.

```python
@app.post("/api/items")
def create_item(new: NewItem):
    title = fetch_title(new.url)
    with db() as conn:
        cursor = conn.execute(
            "INSERT INTO items (url, title, person) VALUES (?, ?, ?)",
            (new.url, title, new.person),
        )
        item_id = cursor.lastrowid
    return {"id": item_id, "url": new.url, "title": title, "person": new.person}
```

Two changes worth noticing:

- **`cursor.lastrowid`** — the id SQLite just assigned. You need it, because React has to know the
  id of the row it just created (to delete it later) without re-fetching the whole list.
- **It returns the created item**, not a redirect. Redirects are for browsers. A program that just
  sent you data expects to get the finished version back.

```python
@app.delete("/api/items/{item_id}")
def delete_item(item_id: int):
    with db() as conn:
        conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    return {"deleted": item_id}
```

### 0.4 Describe the incoming data

Your old form used `url: str = Form(...)`. React won't send a form — it'll send JSON. FastAPI needs
to know what shape to expect, so you declare it as a class:

```python
from pydantic import BaseModel

class NewItem(BaseModel):
    url: str
    person: str = ""
```

Put this above your routes. **Pydantic** is the library FastAPI uses to check incoming data. This
class says: "a new item must have a `url` that's text, and may have a `person`, defaulting to
empty." If React sends garbage, FastAPI rejects it with a clear error before your function ever
runs. You got validation for four lines.

You can now delete the `Form` and `HTMLResponse` and `RedirectResponse` imports. Nothing uses them.

### 0.5 Let the browser through

Add this straight after `app = FastAPI()`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**What this is for.** Browsers enforce a rule called the **same-origin policy**: a page loaded from
one origin can't call a different origin. An **origin** is scheme + host + port —
`http://localhost:5173` and `http://127.0.0.1:8000` are different origins because the ports differ.

The rule exists so a malicious page can't quietly call your bank's API using your logged-in
session. **CORS** (Cross-Origin Resource Sharing) is the server's way of saying "that origin is
fine, let it through." Your Python is the one granting permission, not the browser.

`allow_origins` is a list on purpose — you're naming exactly who's allowed. You'll see
`allow_origins=["*"]` in tutorials. Don't. It means "anyone, from anywhere," which is fine on your
laptop and a hole in production.

**Middleware** = code that runs on every request, before and after your route function. Logging,
authentication, and CORS are all middleware.

### 0.6 Prove it works — no React needed

Restart uvicorn and open <http://127.0.0.1:8000/docs>.

FastAPI generated that page from your code. Every route, every parameter, every field of `NewItem`.
This is what the type hints buy you: `person: str = ""` isn't decoration, it's a description FastAPI
reads.

Click `GET /api/items` → "Try it out" → "Execute".

**✅ You should see:** your real gifts, as a JSON array, in the response box. Try `POST` too — fill
in a url, execute, then re-run the GET and watch it appear.

Your backend is done. Everything from here is the other half.

---

## Step 1 — A blank React app

**Goal:** a second server running next to your Python one.

### 1.1 Get Node

**Node.js** runs JavaScript outside a browser. You need it because the tools that build React apps
are themselves written in JavaScript.

```powershell
node --version
```

If that fails, install the **LTS** version from <https://nodejs.org>. LTS = Long Term Support, the
boring stable one. Take the boring one.

### 1.2 Create the project

Open a **second** PowerShell window — leave uvicorn running in the first.

```powershell
cd "H:\University\Random Projects\Gift Logger"
npm create vite@latest frontend -- --template react
```

Pick **React**, then **JavaScript** (not TypeScript — one new language at a time).

- **npm** = Node Package Manager. Same job as `pip`, for JavaScript.
- **Vite** = the tool that runs your React app while you develop and bundles it when you ship.
  Chosen because it starts instantly and needs zero configuration. The older alternative,
  Create React App, is retired.
- The bare `--` is PowerShell noise: it means "stop reading arguments for npm, pass the rest along."

```powershell
cd frontend
npm install
npm run dev
```

`npm install` reads `package.json` (the list of libraries this project needs — your
`requirements.txt`) and downloads them into `node_modules`. That folder is enormous and
regenerable. **Add `node_modules` to your `.gitignore` now**, before your first commit.

**✅ You should see:** the Vite React starter at <http://localhost:5173>, with a spinning logo and
a counter button.

### 1.3 Clear the decks

In `frontend/src/`, delete `App.css` and the `assets` folder. Then empty `App.jsx` down to:

```jsx
function App() {
  return <h1>Gift Logger</h1>
}

export default App
```

Delete the `import './App.css'` line at the top of `App.jsx` too, or it'll error.

**What a component is.** `App` is a function that returns markup. That's the whole idea — React
apps are functions that return markup, calling each other. The HTML-looking syntax is **JSX**;
Vite compiles it into real JavaScript before the browser sees it.

`export default App` makes it importable elsewhere. `main.jsx` is what imports it.

**✅ You should see:** a plain page saying "Gift Logger". Two servers running. Two terminals.

---

## Step 2 — Your colors, in one place

**Goal:** the six variables, and never a raw hex again.

Open `frontend/src/index.css`, delete everything in it, and type:

```css
:root {
  --bg:      #aea9ba;
  --surface: #f5f2f3;
  --text:    #021f94;
  --muted:   #797585;
  --accent:  #c10822;
  --border:  #8e8a9c;
}

body {
  margin: 0;
  padding: 2rem;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, sans-serif;
}

h1 {
  font-weight: 500;
  margin: 0 0 1.5rem;
}
```

- **`:root`** is the whole document. Variables declared here are visible to every rule in the file.
- **`--bg`** — the two dashes are what make it a custom property. The name is yours; CSS doesn't
  care what it means.
- **`var(--bg)`** reads it back.

**The one rule: no raw hex codes below `:root`.** If you need a color that isn't in your six, add a
seventh variable — don't paste a hex. That discipline is the entire payoff. Change `--accent` once
and every button, link, and highlight moves together.

**Why these roles.** Blue is your text because at 9:1 contrast against `#aea9ba` it's comfortable to
read for a long time. Red is your accent because it's loud — loud is perfect on a Save button and
punishing on a paragraph. A color's job matters more than the color.

**✅ You should see:** a grey-purple page, blue heading, no more default padding.

---

## Step 3 — Show the real data

**Goal:** React draws your actual gifts, fetched from Python.

This is the step. Take your time.

### 3.1 The two ideas

**State** — a value React watches. When it changes, React redraws the component. A normal variable
won't do: React wouldn't know it changed.

**Effect** — code that runs *after* React draws, for things that reach outside the component.
Fetching data is the main one.

Why they're separate: a component's job is "given data, produce markup," and it must be able to run
that instantly, repeatedly, with no side effects. Fetching is slow and touches the network — so it
happens after, and its result comes back in as state, triggering a redraw.

### 3.2 Write it

```jsx
import { useState, useEffect } from "react"

const API = "http://127.0.0.1:8000"

function App() {
  const [items, setItems] = useState([])

  useEffect(() => {
    fetch(`${API}/api/items`)
      .then(response => response.json())
      .then(data => setItems(data))
  }, [])

  return (
    <div>
      <h1>Gift Logger</h1>
      <ul className="list">
        {items.map(item => (
          <li key={item.id} className="row">
            <a href={item.url} className="title">
              {item.title || item.url}
            </a>
            <span className="person">{item.person || "nobody yet"}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
```

Line by line:

- **`useState([])`** returns two things: the current value, and a function to change it. `items` is
  the list, `setItems` is how you replace it. `[]` is what it starts as — an empty list, so the
  first draw has something to loop over instead of crashing.
- **`const [items, setItems] =`** is destructuring — unpacking a two-item array into two names.
- **`useEffect(() => { ... }, [])`** runs the function after the first draw. The `[]` at the end is
  the **dependency array**: "re-run this when anything in here changes." Empty means nothing ever
  changes, so it runs **once**. Forget the `[]` and it runs after *every* draw — fetch, setState,
  redraw, fetch, forever. That's the classic React infinite loop.
- **`.then()`** — `fetch` doesn't return the response, it returns a **promise**: an object that
  says "I'll have this later." `.then()` hands it a function to run when it arrives. The first
  `.then` unpacks the JSON (also slow, also a promise), the second stores it.
- **`items.map(...)`** turns each item into a `<li>`. `map` is the JavaScript equivalent of your
  Python list comprehension.
- **`{ }` inside JSX** means "drop out of markup, evaluate this as JavaScript."
- **`key={item.id}`** — React needs a stable id per list entry so that when the list changes it can
  tell which row is which instead of redrawing all of them. Skip it and you get a console warning
  and, eventually, a genuinely confusing bug.
- **`className`**, not `class` — `class` is a reserved word in JavaScript.
- **`item.title || item.url`** — the same fallback you wrote in Python.

### 3.3 Style the list

Add to `index.css`:

```css
.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}

.title {
  color: var(--text);
  text-decoration: none;
  display: block;
}

.title:hover {
  text-decoration: underline;
}

.person {
  color: var(--muted);
  font-size: 0.85rem;
}
```

**✅ You should see:** your real gifts, from SQLite, as styled rows in your colors.

**Stop and appreciate what just happened.** Two separate programs, in two languages, on two ports,
cooperated to draw that. If it's blank, open the browser console (F12). A CORS error there means
step 0.5 didn't take.

---

## Step 4 — Add without reloading

**Goal:** paste a link, watch the row appear. No page refresh.

### 4.1 Controlled inputs

Add two more pieces of state inside `App`, above the `useEffect`:

```jsx
const [url, setUrl] = useState("")
const [person, setPerson] = useState("")
```

And the form, above the `<ul>`:

```jsx
<form onSubmit={addItem} className="form">
  <input
    className="input"
    value={url}
    onChange={e => setUrl(e.target.value)}
    placeholder="Paste a link"
  />
  <select className="input" value={person} onChange={e => setPerson(e.target.value)}>
    <option value="">Person</option>
    <option>Mom</option>
    <option>Dad</option>
    <option>Gf</option>
    <option>Big Sis</option>
    <option>Friend</option>
    <option>Teacher</option>
  </select>
  <button className="button">Save</button>
</form>
```

**This is backwards from normal HTML and it's the point.** Usually the input box holds the text and
you ask it what's inside. Here `value={url}` means the box displays whatever `url` currently is,
and `onChange` updates `url` on every keystroke. State is the truth; the box is just a view of it.

Sounds like extra work for nothing — until you want to clear the box after saving, or validate as
they type, or fill it from elsewhere. Then it's one line, because you own the value.

### 4.2 The submit handler

```jsx
async function addItem(event) {
  event.preventDefault()

  const response = await fetch(`${API}/api/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, person }),
  })
  const created = await response.json()

  setItems([created, ...items])
  setUrl("")
}
```

- **`event.preventDefault()`** — a form's default behaviour is to reload the whole page. That's what
  `BUILD.md` relied on. You don't want it any more, so you cancel it. Leave this out and the page
  blinks and your app resets.
- **`async` / `await`** — the same waiting as `.then()`, written to read top-to-bottom. `await`
  means "pause here until this promise resolves." Only usable inside an `async` function.
- **`headers`** — `Content-Type: application/json` tells FastAPI how to read the body. Without it
  the request is rejected: Pydantic is expecting JSON and gets an unlabelled blob.
- **`JSON.stringify({ url, person })`** — the body must be text. `{ url, person }` is shorthand for
  `{ url: url, person: person }`.
- **`[created, ...items]`** — a **new** array: the created item, then everything already there.
  The `...` is the spread operator.

**Why a new array and not `items.push(created)`.** React decides whether to redraw by checking
whether the value *is a different object* — not by inspecting its contents. `push` mutates the
array in place, so it's still the same object, so React sees nothing and draws nothing. Always
replace, never mutate. This trips up everyone once.

Note you're using what the server sent back, not what you typed. The server's version has the id
and the scraped title. Yours doesn't.

### 4.3 Style it

```css
.form {
  display: flex;
  gap: 8px;
  margin-bottom: 1.5rem;
}

.input {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  color: var(--text);
  font-size: 0.9rem;
}

.input:first-child { flex: 1; }

.button {
  background: var(--accent);
  color: var(--surface);
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  font-size: 0.9rem;
  cursor: pointer;
}
```

**✅ You should see:** paste a link, hit Save, the row appears at the top with its real title. The
page never reloads.

**Notice the pause.** One to two seconds while Python scrapes the title. It was always there — in
`BUILD.md` it hid inside the page reload. Now there's nothing to look at, so it's obviously a
problem. That's step 9 of `BUILD.md`, and it's waiting for you.

---

## Step 5 — Delete

**Goal:** the X button, no refresh.

```jsx
async function removeItem(id) {
  await fetch(`${API}/api/items/${id}`, { method: "DELETE" })
  setItems(items.filter(item => item.id !== id))
}
```

In the `<li>`, after the person:

```jsx
<button className="x" onClick={() => removeItem(item.id)}>×</button>
```

**Why the arrow function.** `onClick={removeItem(item.id)}` would *call* it immediately, while
drawing — deleting everything the moment the page loads. `onClick={() => removeItem(item.id)}`
hands React a function to call *later*. This bug is a rite of passage.

`filter` builds a new array without the deleted id — again, new array, not a mutation.

```css
.row { display: flex; align-items: center; gap: 10px; }
.row > div { flex: 1; }

.x {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0 4px;
}
```

You'll need to wrap the title and person in a `<div>` for that `flex: 1` to have something to grab.

**✅ You should see:** click ×, the row vanishes instantly. Refresh — still gone.

---

## Step 6 — Filter by person

**Goal:** buttons instead of typing URLs.

```jsx
const [filter, setFilter] = useState("")

const people = ["Mom", "Dad", "Gf", "Big Sis", "Friend", "Teacher"]
const shown = filter ? items.filter(item => item.person === filter) : items
```

Above the list:

```jsx
<div className="filters">
  <button className="chip" onClick={() => setFilter("")}>All</button>
  {people.map(name => (
    <button key={name} className="chip" onClick={() => setFilter(name)}>
      {name}
    </button>
  ))}
</div>
```

Then change `items.map` to `shown.map` in your list.

```css
.filters { display: flex; gap: 6px; margin-bottom: 1rem; flex-wrap: wrap; }

.chip {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 12px;
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
}
```

**A design decision you just made without noticing.** Your `GET /api/items` still accepts
`?person=` — you could have called the server on every filter click. You didn't. You filtered the
copy already sitting in the browser.

That's the right call *here*: with fifty items, a round trip to fetch data you already have is
slower than a `filter()`, and it makes the UI feel instant.

It's the wrong call at fifty thousand. Then you can't hold them all in the browser, and filtering
has to happen where the data lives — in the `WHERE` clause, using the index.

**Where the filtering happens is a system design question, and the answer is a function of size.**
Keep the server-side `?person=` route. You'll want it back.

**✅ You should see:** click Dad, only Dad's items. Click All, everything. No network requests
(check the Network tab in F12).

---

## Done

You have a real client/server application:

| | |
|---|---|
| **Backend** | FastAPI, JSON only, REST routes, no idea a browser exists |
| **Frontend** | React, owns the page, talks to the backend over HTTP |
| **Contract** | `/api/items` — the only thing binding them |

The contract is the valuable part. Either half can now be replaced without touching the other. Swap
SQLite for Postgres — React never knows. Rewrite the frontend as a phone app — Python never knows.
That's what the split bought you.

---

## Loose ends I left deliberately

Don't fix these now. Know they're there.

1. **Your `db()` connections never close.** `with sqlite3.connect(...)` commits on exit but doesn't
   close the connection. Harmless at your scale, wrong at any other. It gets fixed properly when
   you move to Postgres and need a connection pool.
2. **`API` is hardcoded to `127.0.0.1:8000`.** Fine on your laptop, broken the moment you deploy.
   That's what environment variables are for — your empty `.env.example` is waiting.
3. **The 2-second save.** `BUILD.md` step 9.
4. **Everything lives in `App.jsx`.** When it passes ~150 lines, split it: `ItemList.jsx`,
   `AddForm.jsx`. Components are functions — splitting them is just moving functions to new files.

---

## If you get stuck

Same as before:

1. Which step.
2. What you expected.
3. What you got — and for frontend problems, **open F12 and paste what's in the Console tab.**
   Most React errors are quite clear once you actually read them.
