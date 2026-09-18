# Gift Logger — project description

## The problem

I see gift ideas everywhere — reels, shops, screenshots — and they vanish into a camera roll I
never open. By the time someone's birthday comes around, none of it is findable.

Gift Logger captures a gift idea in one paste and makes it retrievable later by **who it's for**,
**what the occasion is**, and **what it costs**.

**Live at <https://giftql-ob91.onrender.com/>** (hosted on Render).

## What it does today

Paste a URL, pick a person, optionally an occasion and a price. The item appears immediately as a
card marked `Pending`. In the background the server fetches the page, strips it to text, and asks
an LLM to turn it into structured data — real product name, one-line description, kind, price,
currency, vibe labels. The card fills itself in. You can edit any field on the card; every edit is
recorded so the model's mistakes are measurable. Filter the grid by person, occasion, or price.

## Why it's built this way

It is a **learning project**. The goal is understanding how a system is put together, not shipping
fast. Every piece was added only after the problem it solves was felt firsthand — duplicates were
fixed after saving the same link twice, the background worker after the 2-second save pause got
annoying. `BUILD.md` is that road, step by step; `docs/` holds the design decisions made along the
way, meant to be read *after* hitting the problem they describe.

Designed for N users, deployed for one. ~10 items a day, a few thousand over a year — small enough
that no queue, no vector database, and no caching layer are justified yet.

## The shape of the system

```
paste ──> POST /api/items ──> row saved as Pending ──> response (instant)
                                    │
                                    └─ background: fetch_meta() ─> parse_item() ─> UPDATE row
                                         scrape OG tags + text      LLM, JSON-enforced
```

Five boxes, same as any system: **ingest** (the form), **process** (scrape + LLM), **store**
(Postgres), **retrieve** (filtered `SELECT`), **present** (the card grid).

The genuinely hard part isn't CRUD — it's *semantic enrichment from a hostile data source*. Product
pages give up Open Graph tags cheaply; Instagram gives you a URL and nothing else.

## Stack

| Layer | Choice | Why |
|---|---|---|
| API | FastAPI | Python, async, types, free API docs at `/docs` |
| Database | Postgres via `psycopg` + connection pool | Started as SQLite; moved when real data mattered |
| Scraping | `httpx` + BeautifulSoup | Open Graph tags are published on purpose — legitimate to read |
| LLM | Gemini Flash-Lite via `instructor` | Free tier; `instructor` + Pydantic forces valid JSON back |
| Frontend | React + Vite + styled-components | One page, no router, no state library |
| Auth | Single shared API key header | One user. Real auth would be complexity with no payoff |

## Layout

```
backend/app/
  main.py      app setup, CORS, lifespan (opens the pool, fails loudly if the DB is down)
  config.py    env vars, one line to swap LLM provider
  auth.py      X-API-Key check
  db.py        pooled connection, commit/rollback context manager
  scraper.py   normalize() strips tracking junk; fetch_meta() returns title, image, text
  llm.py       parse_item() — the prompt and the model call
  schemas.py   Pydantic models; ItemParse doubles as the LLM's output contract
  routes/items.py   list / create / patch / delete, plus enrich() background task
frontend/src/
  App.jsx      state, fetching, polling while anything is Pending
  components/  InputBar, FilterBar, Grid, Card
  constants/   people, occasions, kinds, status — mirrored from the backend
```

## Notable design decisions

- **Duplicates.** URLs are normalized (tracking params stripped, `www.` dropped, trailing slash
  removed) and unique per person — the same link can be saved for Mom and for Dad.
- **Never lose the link.** If scraping or the LLM fails, the row is still saved, marked `Partial`
  or `Failed`, and stays editable by hand.
- **Corrections table.** Every manual edit stores the old LLM value next to the new one. Free
  training data, and an honest measure of where the prompt is weak.
- **Parameterised SQL everywhere.** No f-strings in queries — the one rule with no exceptions.
- **Status drives the UI.** `Pending / Done / Partial / Failed` is one string the frontend renders
  four ways; polling stops after two minutes.

## Known gaps

- Enrichment runs in FastAPI `BackgroundTasks`. Restart the server mid-enrich and the item is stuck
  on `Pending` forever — needs a retry-on-startup pass.
- No migrations wired up (`alembic` is installed but unused); schema changes are still manual.

## What's next

**Step 12 — Telegram bot.** A long-polling script that takes a link sent from the phone and POSTs
it to the existing `/api/items`. No new routes, no new tables — a second ingest mouth on the same
pipeline.

Further out, from the original spec: semantic search ("cozy minimalist desk stuff"), image ingest,
and a `idea → shortlisted → bought → gifted` lifecycle so bought things stop resurfacing.
