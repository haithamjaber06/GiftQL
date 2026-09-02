# Step 11 — Let an LLM fill in the fields

**Goal:** paste a link, and the app works out *what it is*, *what it's about*, *what it costs*, and
*what it's like* — instead of just its title.

Same rules as `BUILD.md`. You type every line. Each part ends with something you can see.

**Decisions already made for this step:**

| | |
|---|---|
| Model | **Gemini 2.5 Flash-Lite** — free tier, no card needed |
| Enforcing JSON | `instructor` + Pydantic |
| Written to swap | One config line moves you to Claude Haiku later. See 11.10 |
| Scope | URLs only. No screenshots, no free text, no chat |
| Style | Same as `BUILD.md` — type it, run it, see it |

**Deliberately not in this step:** images, typed ideas, `content_hash`, price *ranges*, intent
routing, conversation. Every one of those is its own sitting. Adding them here is how this stalls.

---

## What actually changes

Almost nothing structural. Look at your `enrich()` in `routes/items.py`:

```
enrich()  →  fetch_meta()  →  UPDATE items
```

becomes

```
enrich()  →  fetch_meta()  →  parse_item()  →  UPDATE items
```

One new stage in the pipeline. It's still in the background task you built in step 9, so the user
still doesn't wait for it. That's step 9 paying off — an LLM call takes 1–3 seconds and could never
have gone in the request path.

**The scraper stays.** It is not being replaced. `og:title` and `og:image` are free, instant, and
exactly right when the site provides them. The LLM handles what the scraper can't reach: what kind
of thing this is, what it's for, what it costs when the price is buried in the page text.

> **The rule this follows:** deterministic first, model second. Never pay a model to do what a
> pattern already does perfectly.

---

## 11.1 — Get a key, and don't leak it

### Get it

1. Go to <https://aistudio.google.com/apikey>, sign in with a Google account.
2. **Create API key.** Pick "create in a new project" if it asks.
3. Copy it. No card, no billing setup — the free tier is on by default.

An **API key** is a password that identifies your account to someone else's server. Every request
carries it. On a paid tier every request it carries is billed to you; on the free tier it's what
your daily quota is counted against. Either way: treat it exactly like a password.

⚠️ **Two things to know about the free tier before you build on it.** Neither is a dealbreaker,
both are worth knowing now:

- **There are daily and per-minute caps.** Hit one and you get a `429` error. Part 11.7 handles it.
- **Free-tier requests may be used to improve Google's models.** Your items include names of people
  you know. Read the terms at <https://ai.google.dev/gemini-api/terms> and decide whether you mind.
  If you do, skip to 11.10 and start on Claude instead — the guide is written so that's one line.

### Put it in `.env`

You already have an empty `.env` in your project root. Put this in it:

```
GOOGLE_API_KEY=paste-yours-here
```

A **`.env` file** is a plain list of `NAME=value` settings that live *outside* your code. The point
is that your code can be public while your secrets aren't.

### ⚠️ Check it's ignored by git

```powershell
cd "H:\University\Random Projects\Gift Logger"
git check-ignore .env
```

If it prints `.env`, you're safe. If it prints **nothing**, stop and add a line saying `.env` to
`.gitignore` before you do anything else.

A leaked key gets scraped off GitHub by bots within minutes and spent. This is not a theoretical
risk; it's a routine one.

### Load it in `config.py`

```python
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "giftlogger.db"
CORS_ORIGINS = ["http://localhost:5173"]

load_dotenv(BASE_DIR.parent / ".env")

# provider/model — the only line you change to switch provider. See 11.10.
LLM_PROVIDER = "google/gemini-2.5-flash-lite"
# LLM_PROVIDER = "anthropic/claude-haiku-4-5-20251001"
```

- `load_dotenv(...)` reads the file and pushes each line into the environment.
- `BASE_DIR.parent` walks up from `backend/` to the project root, where `.env` lives.
- You don't read the key here. `instructor` picks `GOOGLE_API_KEY` up from the environment itself —
  which is exactly why the swap in 11.10 is so cheap: different provider, different env var, **same
  code**.
- The provider string is a **setting**, not something buried in your logic. That one decision is
  what makes 11.10 a config edit instead of a rewrite.

⚠️ **Model names go stale.** If you get a `404 model not found`, check the current name at
<https://ai.google.dev/gemini-api/docs/models> — it's a naming problem wearing a scary error.

### ✅ Prove it loaded

```powershell
cd backend
..\.venv\Scripts\activate
python -c "import os; from app.config import LLM_PROVIDER; print(LLM_PROVIDER, os.getenv('GOOGLE_API_KEY')[:8])"
```

**You should see:** the provider string and the first few characters of your key. If you see
`TypeError: NoneType`, the `.env` isn't being found — check the path and the spelling.

---

## 11.2 — Install the library

```powershell
pip install "instructor[google-genai]"
pip freeze > requirements.txt
```

- **instructor** — hands the model a Pydantic class and gets that class back, validated, instead of
  a blob of text you'd have to clean up and pray over.
- The `[google-genai]` part in brackets is an **extra**: it tells pip "also install what instructor
  needs to talk to Google." Swap providers later and you install a different extra.

Regenerating `requirements.txt` matters: it's the record of what your project needs to run. If it
drifts from reality, a fresh clone won't start.

---

## 11.3 — Describe the shape you want

This is the important part of the whole step. You are not asking the model for a description of the
page — you are demanding a **specific structure**, and refusing anything else.

Add to `app/schemas.py`:

```python
from pydantic import BaseModel, Field

class ItemParse(BaseModel):
    """What the LLM is allowed to tell us about a saved link."""

    kind: str = Field(
        description="One of: product, store, idea, inspo. A single buyable thing is 'product'. "
                    "A shop you'd return to is 'store'."
    )
    title: str = Field(
        description="The product's real name, as a person would say it out loud. "
                    "Strip marketing keywords, feature lists, bracketed warranty or "
                    "version notes, and the seller's SEO padding. Keep a distinguishing "
                    "variant (colour, size, model) only if it changes what the gift is. "
                    "Aim for under 60 characters. "
                    "Example: 'SAMSUNG Galaxy Buds 2 Pro True Wireless Bluetooth Earbuds, "
                    "Noise Cancelling, Hi-Fi Sound, Graphite [US Version, 1Yr Warranty]' "
                    "-> 'Galaxy Buds 2 Pro, Graphite'"
    )
    description: str | None = Field(
        default=None,
        description="One sentence on what it is and who'd like it."
    )
    price: float | None = Field(
        default=None,
        description="The numeric price if one is clearly stated on the page. "
                    "Null if you are not certain. Never estimate."
    )
    currency: str | None = Field(
        default=None,
        description="Three-letter code, e.g. JOD, USD. Null if no price."
    )
    labels: list[str] = Field(
        default_factory=list,
        description="2-5 short lowercase tags describing the vibe or category. "
                    "e.g. ['woodworking', 'handmade', 'desk']"
    )
```

Four things to notice:

**The `description=` texts are not comments.** `instructor` sends them to the model as part of the
instructions. This is the clearest lesson of the step: **your schema is part of your prompt.** A
vague field description produces a vague field.

**`| None` is a promise, not laziness.** It's your contract doc's Rule 2 written in code — *wrong
and visible is survivable, wrong and invisible is fatal.* A null price means "I couldn't tell,"
which you can see and fix. A guessed price looks identical to a real one and quietly poisons every
budget question you ever ask later.

⚠️ **Watch this field especially on Flash-Lite.** Cheaper models lean toward filling every box
rather than admitting they don't know. "Never estimate" is in there for exactly that reason, and
`price` is the first thing you should check when you start testing.

**`default_factory=list`** — you can't write `default=[]` in Pydantic, because every item would
share the same list object. This is a general Python trap, not a Pydantic quirk.

**That `title` description is doing real work.** A shop's `og:title` is written for a search engine,
not for you. Amazon will hand you 180 characters of keyword dump; in your card grid that wraps to
four lines and shoves everything else off screen. Cleaning it up is a job nothing but a model can
do — you cannot write a pattern for "which part of this is the actual product name." The worked
example at the end matters more than the instruction above it: showing one transformation is
**few-shot prompting**, and it beats describing the same rule in more adjectives.

⚠️ Watch it over-trim. *"Walnut Serving Board, 18-inch"* shortened to *"Walnut Serving Board"* looks
tidier and is worse — for a gift, the size **is** the thing.

---

## 11.4 — The call

New file: `app/llm.py`

```python
import instructor

from app.config import LLM_PROVIDER
from app.schemas import ItemParse

client = instructor.from_provider(LLM_PROVIDER)

SYSTEM = """You extract structured gift-idea data from web pages.

Rules:
- Fill a field only if the page actually supports it. If you are unsure, use null.
- Never invent or estimate a price. A price must appear on the page.
- Titles are the product's real name, not the page's SEO headline.
- You are cataloguing gift ideas, so labels should describe the thing's character,
  not the website's layout.
"""


def parse_item(url, title, page_text):
    """Ask the model to describe one saved link. Returns an ItemParse, or None."""
    prompt = f"""URL: {url}
Page title: {title or "(none found)"}

Page text:
{page_text[:6000]}
"""

    try:
        return client.create(
            response_model=ItemParse,
            max_retries=2,
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )
    except Exception as e:
        print("LLM parse failed:", e)
        return None
```

Walking through it:

- **`from_provider(LLM_PROVIDER)`** builds the right client for whichever provider your config
  names, and finds the API key in the environment on its own. This one function is the entire
  reason 11.10 is easy.
- `client` is built once at import, not per call. Opening a connection is work; doing it every time
  is waste you'll never see but always pay for.
- **The `"system"` message** is the *system prompt* — standing instructions that apply to every
  call, separate from the specific thing you're asking about. Rules go here; data goes in the user
  message. Different providers pass this differently under the hood; `instructor` normalises it.
- **`page_text[:6000]`** — a bloated page is mostly navigation and footer. Six thousand characters
  is roughly 1,500 tokens, plenty for a product page. This one line is most of your quota control.
- **`response_model=ItemParse`** is the whole reason `instructor` is here. It converts your Pydantic
  class into instructions the model must follow, then validates the reply against it.
- **`max_retries=2`** — if the reply doesn't fit the schema, `instructor` sends the validation error
  *back to the model* and asks it to fix it. That's the retry loop you'd otherwise write by hand.
- The `try/except` returns `None` rather than crashing. Same reasoning as `fetch_title` back in
  step 4: **a failed enrichment is fixable, a lost item isn't.**

> **What instructor guarantees, and what it doesn't.** It guarantees the **shape** — `parsed.price`
> will be a number or `None`, never the string `"25 JOD"`. It guarantees nothing about the
> **content**. A confidently invented price passes validation perfectly. Shape is a library problem;
> correctness is a prompt problem, and 11.9 is how you measure it.

---

## 11.5 — Give it something to read

Your scraper currently returns only title and image. The model needs the page's words.

In `app/scraper.py`, change `fetch_meta` to return three things:

```python
def fetch_meta(url):
    try:
        response = httpx.get(url, timeout=10, follow_redirects=True)
        soup = BeautifulSoup(response.text, "html.parser")

        title, img = None, None

        title_tag = soup.find("meta", property="og:title")
        if title_tag:
            title = title_tag.get("content")
        elif soup.title:
            title = soup.title.string

        image_tag = soup.find("meta", property="og:image")
        if image_tag:
            img = image_tag.get("content")

        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = " ".join(soup.get_text(" ").split())

        return title, img, text

    except Exception as e:
        print("Couldn't Fetch: ", e)
        return None, None, ""
```

- `.decompose()` deletes a tag and its contents from the soup. Scripts and stylesheets are pure
  noise to a language model, and you'd be spending quota on every character of them.
- `" ".join(soup.get_text(" ").split())` collapses the wall of whitespace real HTML is full of.
  `.split()` with no argument splits on any run of whitespace; joining with single spaces flattens it.

⚠️ You just changed a function's return shape, so **every caller breaks**. That's the next part —
and it's a good instinct to feel nervous about. A **stage boundary** (what one stage hands the next)
is the one thing in a pipeline you should change carefully.

---

## 11.6 — Wire it into the pipeline

In `app/routes/items.py`, add the imports:

```python
import json
from app.llm import parse_item
```

And replace `enrich`:

```python
def enrich(url, item_id):
    title, img_url, page_text = fetch_meta(url)

    parsed = parse_item(url, title, page_text) if page_text else None

    if parsed is None:
        status = "Failed" if title is None and img_url is None else "Partial"
        with db() as conn:
            conn.execute(
                "UPDATE items SET title = ?, raw_title = ?, img_url = ?, status = ? WHERE id = ?",
                (title, title, img_url, status, item_id),
            )
        return

    with db() as conn:
        conn.execute(
            """UPDATE items
               SET title = ?, raw_title = ?, img_url = ?, status = 'Done',
                   kind = ?, description = ?, labels = ?, currency = ?,
                   price = COALESCE(price, ?)
               WHERE id = ?""",
            (
                parsed.title or title,
                title,
                img_url,
                parsed.kind,
                parsed.description,
                json.dumps(parsed.labels),
                parsed.currency,
                parsed.price,
                item_id,
            ),
        )
```

Five decisions worth understanding:

**`raw_title` keeps the scraper's original.** The model's cleaned-up name goes in `title`; the
180-character Amazon original goes in `raw_title`, untouched. One extra column, and it buys two
things: you can **re-prompt every item you've already saved** when you improve the title rules next
month, and you can see at a glance what the model threw away — which is how you catch it
over-trimming.

> **The rule: never destroy the input.** Enrichment *adds* fields; it doesn't overwrite the
> evidence. Without `raw_title` the original is gone, and re-getting it means re-fetching pages that
> may not exist any more. Same instinct as the `corrections` table in 11.9.

**`"Partial"` is a new status.** The scraper worked, the model didn't. You now have three outcomes,
not two, and the card grid can show which. Honest states beat a boolean.

**`COALESCE(price, ?)`** — SQL for "keep the existing value; use this one only if it's currently
null." So a price *you* typed is never overwritten by the model's guess.

> **The rule: the human always wins.** The model fills gaps, it doesn't overrule you. Get this
> wrong once and you'll stop trusting the whole thing.

**`json.dumps(parsed.labels)`** — SQLite has no list type, so a list is stored as the text
`["woodworking", "handmade"]` and read back with `json.loads`. Fine at your scale. It does mean you
can't query *inside* labels efficiently — one of several small reasons Postgres (which has real
array and JSON types) is in your future.

**`parsed.title or title`** — the model's title, falling back to the scraper's. Same fallback
pattern as step 4.

---

## 11.7 — The migration

Those new columns don't exist yet. And as you learned in step 10, `CREATE TABLE IF NOT EXISTS`
won't add them.

This time you cannot delete the database — it has real saves in it. So: `ALTER TABLE`.

In `app/db.py`, add a helper:

```python
def add_column(conn, table, column, coltype):
    existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
    if column not in existing:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
        print(f"migrated: added {table}.{column}")
```

Then at the end of `init_db()`, inside the same `with db() as conn:` block:

```python
        add_column(conn, "items", "kind", "TEXT")
        add_column(conn, "items", "raw_title", "TEXT")
        add_column(conn, "items", "description", "TEXT")
        add_column(conn, "items", "labels", "TEXT")
        add_column(conn, "items", "currency", "TEXT")
```

- **`PRAGMA table_info(...)`** is SQLite's way of asking a table to describe itself. You're checking
  before acting, so this is safe to run on every startup — the same **idempotent** property that
  makes `CREATE TABLE IF NOT EXISTS` safe. *Idempotent* means running it twice does no more than
  running it once.
- Note the f-string here, right after Step 2 told you never to use one in SQL. The rule is precisely
  about **values**, which can come from users. Table and column *names* are constants you wrote
  yourself, and SQL doesn't allow `?` placeholders for them anyway. Know why the rule exists, not
  just the rule.

This is a hand-rolled migration, and it's the right size for now. The grown-up tool is **Alembic**,
which records each change as a numbered file you can apply and roll back. Worth adopting when you
move to Postgres, not before.

### ✅ Run it

Restart uvicorn. **You should see** the `migrated: added items.kind` lines print once, and nothing
on the second start.

---

## 11.8 — Watch it work

Save a real product link through your page.

Then look at what landed:

```powershell
python -c "import sqlite3,json; c=sqlite3.connect('giftlogger.db'); c.row_factory=sqlite3.Row; r=c.execute('SELECT * FROM items ORDER BY id DESC LIMIT 1').fetchone(); print(json.dumps(dict(r), indent=2, ensure_ascii=False))"
```

**✅ You should see:** `kind`, `description`, `labels` and often `price` filled in, and `status` as
`Done` — a few seconds after the row first appeared as `Pending`.

**Now go and break it on purpose.** This is the part most people skip, and it's where the actual
understanding lives:

| Try this | What you're learning |
|---|---|
| **A page with no price at all** | Does `price` come back **null**, or does it invent one? This is the single most important test in the step |
| An Amazon product page | Compare `title` against `raw_title`. Did it strip the keyword dump *without* losing the colour or size? |
| A blog post, not a product | Does `kind` come back as something sensible? |
| A shop's homepage | Does it say `store`, or wrongly call it a `product`? |
| An Instagram link | It'll mostly fail — Instagram serves almost nothing to a plain fetch. Notice this is a **scraper** limitation, not a model one |
| Break your key (edit `.env`, restart) | Does the item still save with `status = 'Failed'`? |

That last row is the one that matters. **The item must still be saved.** If a broken API key can
lose your data, the error handling is wrong.

### ⚠️ When you hit the free tier's ceiling

Save twenty things in quick succession and you may see a `429 RESOURCE_EXHAUSTED`. That's the
free-tier rate limit, not a bug in your code. Current limits:
<https://ai.google.dev/gemini-api/docs/rate-limits>

Right now the consequence is mild and correct: `parse_item` catches it, returns `None`, and the item
saves as `Partial`. **Nothing is lost.** That's the error handling working.

The proper fix is a **retry with backoff** — wait a second, try again; wait two, try again — plus a
job that re-runs enrichment for anything stuck on `Partial`. Both are genuinely useful and neither
belongs in this step. Note it and move on; if it starts annoying you, that's the signal to build it.

---

## What this costs

**On Gemini's free tier: nothing**, up to the daily cap.

Worth doing the arithmetic anyway, because you'll need it the moment you leave the free tier. Each
save is roughly **1,500 input tokens** (the truncated page) and **200 output tokens** (your schema).

| Provider | Input / M | Output / M | Per 1,000 saves |
|---|---|---|---|
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | $0.23 |
| Claude Haiku 4.5 | $1.00 | $5.00 | $2.50 |

Two things to internalise from that:

- **Output tokens cost 4–5x what input tokens do.** Here output is only 200 tokens and still makes
  up a third of the bill. Verbose replies are expensive replies — another argument for a tight schema.
- **Truncating at 6,000 characters is most of your cost control.** Send whole Amazon pages instead
  and you'd multiply the input side by five or more.

---

## 11.9 — Ten lines that pay for themselves

Optional, and I'd do it. Your own `docs/06-llm-contract.md` calls this the highest-value-per-line
thing in the project: **every time you correct the model, write down what it said and what it should
have said.**

In `db.py`'s `init_db`:

```python
        conn.execute("""
        CREATE TABLE IF NOT EXISTS corrections (
            id           INTEGER PRIMARY KEY,
            item_id      INTEGER,
            field        TEXT,
            llm_value    TEXT,
            user_value   TEXT,
            corrected_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
```

And in `update_item`, before you run the `UPDATE`, record what's being changed:

```python
    with db() as conn:
        old = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
        for field, new_value in fields.items():
            conn.execute(
                "INSERT INTO corrections (item_id, field, llm_value, user_value) VALUES (?,?,?,?)",
                (item_id, field, str(old[field]), str(new_value)),
            )
```

You now get three things for free:

- **A real accuracy number** — `1 − (corrections on a field ÷ times it was filled)`. You'll probably
  find `title` is excellent and `price` is mediocre, which tells you exactly where to spend your
  next hour.
- **A regression test set.** Every correction is a labelled example. Change the prompt, replay them,
  find out whether you improved things or broke them. Without this, prompt tweaking is
  superstition — it feels better, and you have no idea.
- **The evidence for 11.10.** When you swap provider, this is how you find out whether the swap
  actually helped instead of just feeling like it did.

---

## 11.10 — Swapping to Claude later

The whole file was written so this is small. When you're ready:

```powershell
pip install "instructor[anthropic]"
```

In `.env`, add the other key (keep both; they don't conflict):

```
ANTHROPIC_API_KEY=sk-ant-...
```

In `config.py`, move the comment down one line:

```python
# LLM_PROVIDER = "google/gemini-2.5-flash-lite"
LLM_PROVIDER = "anthropic/claude-haiku-4-5-20251001"
```

That's the code. `llm.py`, `schemas.py`, `enrich()`, the database, the routes and the frontend are
all untouched — because the only thing that knows which provider you use is one config line, and
the only thing the rest of the app knows about `llm.py` is `parse_item(...) -> ItemParse | None`.

> **That boundary is the actual lesson of 11.10.** A well-placed seam turns a migration into a
> config edit. Badly placed — say, if you'd called the Google client directly from `enrich()` —
> and the same change touches five files.

**Two things that are not free, and are worth expecting:**

**Prompts don't port at full quality.** Your field descriptions are tuned, implicitly, against the
model you tested them on. Claude holds a null better; Flash-Lite is keener to fill every box. So
after the swap, re-read `price` and `kind` on twenty real items. Budget an hour of prompt tuning,
not a rewrite. Replay your `corrections` table to see whether it actually improved.

**Anthropic wants `max_tokens`.** If you get an error about it, add `max_tokens=1024` to the
`client.create(...)` call. Harmless on either provider.

---

## Where you are now

Your pipeline reads:

```
POST /items → save Pending → [background] → scrape → LLM → save Done
```

Every box from the end of the basics is still there. The **process** box just got much better at its
job, and everything else was left alone. That's what a good step looks like.

**Next, one at a time:**

- **11b — price ranges.** Your contract doc wants `price_min` / `price_max`, because a *store* has a
  range, not a price. Small migration, small frontend change.
- **11c — retry and re-enrich.** Backoff on `429`, and a job that rescues anything stuck on
  `Partial`. Build it when the free tier starts annoying you.
- **12 — the everything box.** Free text and screenshots, where `content_hash` and the dispatcher
  come in.
- **13 — Telegram.** A second door into the same pipeline.

## If it doesn't work

Tell me which part number, what you expected, and paste the error. The common four:

| Error | Cause |
|---|---|
| `TypeError: 'NoneType' object is not subscriptable` on the key | `.env` not found — check the path in `config.py` |
| `404 model not found` | Model name is stale — copy the current one from the docs |
| `429 RESOURCE_EXHAUSTED` | Free-tier rate limit. Not your bug. See the note in 11.8 |
| `ValidationError` after retries | Your field descriptions are too vague. Rewrite them, not the code |
