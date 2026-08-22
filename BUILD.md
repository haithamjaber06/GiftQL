# Build it yourself — step by step

You write every line. I explain what and why, you type it, you check it works.
Don't copy-paste — typing it is most of the learning.

**Rules for this guide:**

- One file: `app.py`. That's the whole project for now.
- One database: `gifts.db`, a single file SQLite creates for you. No Docker. No Postgres.
- Every step ends with **something you can see working.** If you can't see it, stop and tell me.
- If a step takes more than 20 minutes, it's my fault for making it too big. Say so.

Do one step per sitting. There is no prize for going fast.

---

## Step 0 — Get Python running

**Goal:** prove your machine can run a web app at all.

### 0.1 Check Python

Open PowerShell, type:

```powershell
python --version
```

If you see `Python 3.11` or higher, good. If it says it's not recognised, install it from
<https://www.python.org/downloads/> and **tick "Add Python to PATH"** during setup.

### 0.2 Install the two libraries you need

```powershell
cd "H:\University\Random Projects\Gift Logger"
pip install fastapi uvicorn
```

- **FastAPI** — lets you write Python functions that respond to web addresses.
- **uvicorn** — the program that actually runs your app and listens for browsers.

### 0.3 Make it say hello

Create a new file called `app.py` in the project folder and type this:

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"hello": "world"}
```

Three things happening:

- `app = FastAPI()` creates your application.
- `@app.get("/")` is a **decorator** — it attaches the function below it to a web address.
  `"/"` means the homepage.
- The function returns a dictionary; FastAPI turns it into JSON automatically.

### 0.4 Run it

```powershell
uvicorn app:app --reload
```

`app:app` means "in the file `app.py`, use the variable called `app`". `--reload` restarts it
automatically whenever you save the file.

Open <http://127.0.0.1:8000>.

**✅ You should see:** `{"hello":"world"}`

Leave this running in its own terminal window for the rest of the guide. Open a second terminal if
you need to type other commands.

---

## Step 1 — A form you can type into

**Goal:** a box on a page, and proof the server received what you typed.

### 1.1 Return HTML instead of JSON

Change your file to this:

```python
from fastapi import FastAPI, Form
from fastapi.responses import HTMLResponse

app = FastAPI()

@app.get("/", response_class=HTMLResponse)
def home():
    return """
    <h1>Gift Logger</h1>
    <form method="post" action="/add">
      <input name="url" placeholder="Paste a link">
      <button>Save</button>
    </form>
    """

@app.post("/add")
def add(url: str = Form(...)):
    return {"you sent": url}
```

What's new:

- `response_class=HTMLResponse` tells FastAPI "this is a web page, not data."
- The form's `action="/add"` and `method="post"` mean: when you press Save, send the contents to
  the `/add` address.
- `@app.post("/add")` catches it. **GET** is for reading a page, **POST** is for sending something.
- `url: str = Form(...)` means "pull the field named `url` out of the form." The `...` means it's
  required.

### 1.2 Install the form library

Forms need one extra package:

```powershell
pip install python-multipart
```

Restart uvicorn if it complains.

**✅ You should see:** a page with a box. Type anything, press Save, and the next page shows
`{"you sent":"whatever you typed"}`.

That's the entire request cycle: browser → your function → response. Everything else is detail.

---

## Step 2 — Remember it

**Goal:** what you type survives a restart.

Right now the URL vanishes the moment the function returns. Let's store it.

### 2.1 Add the database

Put this near the top, under your imports:

```python
import sqlite3

def db():
    conn = sqlite3.connect("gifts.db")
    conn.row_factory = sqlite3.Row      # rows behave like dictionaries, not tuples
    return conn

with db() as conn:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id    INTEGER PRIMARY KEY,
            url   TEXT,
            title TEXT
        )
    """)
```

- **SQLite** is a database that's just a file on disk. Nothing to install, nothing to run.
- `CREATE TABLE IF NOT EXISTS` is safe to run every startup — it does nothing if the table's
  already there.
- `PRIMARY KEY` means "this column uniquely identifies a row." SQLite fills it in for you.

### 2.2 Save into it

```python
@app.post("/add")
def add(url: str = Form(...)):
    with db() as conn:
        conn.execute("INSERT INTO items (url) VALUES (?)", (url,))
    return {"saved": url}
```

**The `?` matters.** You might be tempted to write
`f"INSERT INTO items (url) VALUES ('{url}')"`. Never do that. With `?`, the database receives the
query and the value separately, so a value can never be mistaken for a command. That's how you
avoid **SQL injection** — someone typing `'); DROP TABLE items; --` into your box.

This is the one security rule with no exceptions. Get in the habit now.

**✅ Check it worked:** stop uvicorn, look in your project folder. There's a new file called
`gifts.db`. Your data is in there.

---

## Step 3 — See what you saved

**Goal:** the homepage lists everything.

```python
@app.get("/", response_class=HTMLResponse)
def home():
    with db() as conn:
        rows = conn.execute("SELECT * FROM items ORDER BY id DESC").fetchall()

    items = ""
    for row in rows:
        items += f"<li>{row['url']}</li>"

    return f"""
    <h1>Gift Logger</h1>
    <form method="post" action="/add">
      <input name="url" placeholder="Paste a link">
      <button>Save</button>
    </form>
    <ul>{items}</ul>
    """
```

- `SELECT *` means "all columns". `ORDER BY id DESC` puts newest first.
- `.fetchall()` gets every matching row as a list.
- The loop builds up HTML list items, one per row.

One improvement worth making now — after saving, send the browser back to the homepage instead of
showing JSON:

```python
from fastapi.responses import HTMLResponse, RedirectResponse

@app.post("/add")
def add(url: str = Form(...)):
    with db() as conn:
        conn.execute("INSERT INTO items (url) VALUES (?)", (url,))
    return RedirectResponse("/", status_code=303)
```

`303` tells the browser "go look at this other page." Without it, refreshing after a save would
submit the form again and create a duplicate.

**✅ You should see:** save three links, they all appear in a list. Restart uvicorn — they're
still there.

**You now have a working application.** Data goes in, data persists, data comes back out. Everything
after this is making it *nice*.

---

## Step 4 — Make it fetch the title

**Goal:** paste a link, get its real name automatically. This is the first bit that feels like magic.

### 4.1 Install two more libraries

```powershell
pip install httpx beautifulsoup4
```

- **httpx** downloads web pages.
- **BeautifulSoup** reads the HTML and lets you pick pieces out of it.

### 4.2 Write the fetcher

Add this function anywhere above your routes:

```python
import httpx
from bs4 import BeautifulSoup

def fetch_title(url):
    try:
        response = httpx.get(url, timeout=10, follow_redirects=True)
        soup = BeautifulSoup(response.text, "html.parser")

        tag = soup.find("meta", property="og:title")
        if tag:
            return tag["content"]
        if soup.title:
            return soup.title.string

        return None
    except Exception as e:
        print("couldn't fetch:", e)
        return None
```

**What `og:title` is.** Websites put invisible tags in their HTML so links look good when shared —
`<meta property="og:title" content="Walnut Serving Board">`. That's **Open Graph**. It's free,
structured information the site publishes on purpose, so reading it is both easy and legitimate.

**Why the `try/except`.** The site might be down, slow, or nonsense. If that crashes your app, you
lose the item. Instead we catch the error, print it, return `None`, and **save the item anyway with
no title.** A row with a missing title is fixable. A lost link isn't.

### 4.3 Use it

```python
@app.post("/add")
def add(url: str = Form(...)):
    title = fetch_title(url)
    with db() as conn:
        conn.execute("INSERT INTO items (url, title) VALUES (?, ?)", (url, title))
    return RedirectResponse("/", status_code=303)
```

And show it in the list:

```python
items += f"<li><a href='{row['url']}'>{row['title'] or row['url']}</a></li>"
```

`row['title'] or row['url']` means "use the title, but fall back to the URL if it's empty."

**✅ You should see:** paste a product link, and the list shows its actual name as a clickable link.

**Notice something.** Saving now takes a second or two, because your app is waiting for someone
else's website before it answers. That pause is real, and it's a problem worth remembering —
but not worth fixing yet.

---

## Step 5 — Who is it for?

**Goal:** the thing that makes this a gift logger and not a bookmark list.

### 5.1 Add the column

Change your `CREATE TABLE` to include it:

```python
CREATE TABLE IF NOT EXISTS items (
    id     INTEGER PRIMARY KEY,
    url    TEXT,
    title  TEXT,
    person TEXT
)
```

⚠️ **`CREATE TABLE IF NOT EXISTS` won't change a table that already exists.** Easiest fix right
now: close uvicorn, delete `gifts.db`, start again. You lose your test data, which is fine.

Remember this annoyance. It's the reason **migrations** exist, and we'll deal with it properly when
your data actually matters.

### 5.2 Add it to the form

```html
<select name="person">
  <option value="">— who? —</option>
  <option>Mom</option>
  <option>Dad</option>
  <option>Gf</option>
  <option>Big Sis</option>
  <option>Friend</option>
  <option>Teacher</option>
</select>
```

### 5.3 Save it

```python
@app.post("/add")
def add(url: str = Form(...), person: str = Form("")):
    title = fetch_title(url)
    with db() as conn:
        conn.execute(
            "INSERT INTO items (url, title, person) VALUES (?, ?, ?)",
            (url, title, person)
        )
    return RedirectResponse("/", status_code=303)
```

`person: str = Form("")` — the `""` is a default, so leaving it blank doesn't error.

### 5.4 Show it

```python
items += f"<li><a href='{row['url']}'>{row['title'] or row['url']}</a> — {row['person'] or 'nobody yet'}</li>"
```

**✅ You should see:** save a link for Mom, save one for Dad, both show who they're for.

---

## Step 6 — Filter by person

**Goal:** "show me everything for Dad."

```python
@app.get("/", response_class=HTMLResponse)
def home(person: str = ""):
    with db() as conn:
        if person:
            rows = conn.execute(
                "SELECT * FROM items WHERE person = ? ORDER BY id DESC",
                (person,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM items ORDER BY id DESC").fetchall()
    ...
```

`person: str = ""` in a **GET** route reads from the web address, not a form — so
`http://127.0.0.1:8000/?person=Dad` filters the list.

Add links above your list to try it:

```python
links = "<a href='/'>All</a> "
for name in ["Mom", "Dad", "Gf", "Big Sis", "Friend", "Teacher"]:
    links += f"<a href='/?person={name}'>{name}</a> "
```

**✅ You should see:** clicking "Dad" shows only Dad's items.

---

## You're done with the basics

Stop here. Use it for a week. Save real things.

What you have is small, but it is genuinely the whole shape of the system:

| | |
|---|---|
| **Ingest** | the form |
| **Process** | `fetch_title()` |
| **Store** | SQLite |
| **Retrieve** | the `SELECT` with a `WHERE` |
| **Present** | the HTML list |

Everything we ever discussed — the worker, Postgres, the Telegram bot, the LLM — is just a better
version of one of those five boxes. Not a new thing to learn from scratch.

---

## When you're ready, in this order

Each of these should be its own session. Ask me for one at a time.

**7. Make it look decent.** Some CSS, images from the page, a card grid.
**8. Stop it duplicating.** Save the same link twice, notice you get two rows, fix it.
**9. Fix the pause.** That 2-second wait in Step 4 — move the fetching into a background job.
**10. Add price and occasion.** More fields, and hit the migration problem properly.
**11. Bring in the LLM.** Fill in the fields automatically instead of by hand.
**12. Telegram bot.** Send links from your phone instead of typing them.

**Steps 8 and 9 are where the design docs start paying off.** You'll hit a real problem, and the
answer will already be written down, with the reasoning. That's what they're for — not to be read
up front.

---

## If you get stuck

Tell me:

1. Which step.
2. What you expected to see.
3. What you saw instead (paste the error).

That's it. Don't apologise for being stuck — being stuck is the job.
