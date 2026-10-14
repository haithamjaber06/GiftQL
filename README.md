# GiftQL — project description

## The problem

I see gift ideas everywhere — reels, shops, screenshots — and they vanish into a camera roll I
never open. By the time someone's birthday comes around, none of it is findable.

GiftQL captures a gift idea in one paste and makes it retrievable later by **who it's for**,
**what the occasion is**, and **what it costs**.

**Live at <https://giftql-ob91.onrender.com/>** (hosted on Render).

## What it does today

Paste a URL, pick a person, optionally an occasion and a price. The item appears immediately as a
card marked `Pending`. In the background the server fetches the page, strips it to text, and asks
an LLM to turn it into structured data — real product name, one-line description, kind, price,
currency, vibe labels. The card fills itself in. You can edit any field on the card; edits that
disagree with the LLM are recorded so the model's mistakes are measurable. Filter the grid by person, occasion, or price.

## Why it's built this way

It is a **learning project**. The goal is understanding how a system is put together, not shipping
fast. Every piece was added only after the problem it solves was felt firsthand — duplicates were
fixed after saving the same link twice, the background worker after the 2-second save pause got
annoying. `BUILD.md` is that road, step by step; `docs/` holds the design decisions made along the
way, meant to be read *after* hitting the problem they describe.

Scoped as a single-user portfolio project. Designed for N users, deployed for one. ~10 items a day, a few thousand over a year — small enough
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
  main.py      app setup, CORS, lifespan (opens the pool, fails loudly if the DB is down,
               re-queues stuck Pending items)
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

## Schema changes

Managed with Alembic (`backend/migrations/`). Migrations are hand-written SQL — there are no
SQLAlchemy models, so no autogenerate. From `backend/`: `alembic revision -m "..."`, fill in
`upgrade()`/`downgrade()`, then `alembic upgrade head`. Render runs `alembic upgrade head` on
every start.

## Notable design decisions

- **Duplicates.** URLs are normalized (tracking params stripped, `www.` dropped, trailing slash
  removed) and unique per person — the same link can be saved for Mom and for Dad.
- **Never lose the link.** If scraping or the LLM fails, the row is still saved, marked `Partial`
  or `Failed`, and stays editable by hand.
- **Corrections table.** The LLM's answer is snapshotted once (`items.llm_output`); edits are
  compared against it, not the current value. One row per wrong field, deleted if you revert.
  Free training data, and an honest measure of where the prompt is weak.
- **Your edits win.** Editing a card while it's `Pending` survives `enrich()` finishing.
- **Parameterised SQL everywhere.** No f-strings in queries — the one rule with no exceptions.
- **Status drives the UI.** `Pending / Done / Partial / Failed` is one string the frontend renders
  four ways; polling stops after two minutes.
- **Retry on startup.** At boot, a background thread re-runs `enrich()` on items stuck on
  `Pending` for over 2 minutes. Younger ones are skipped, since another server may still own them.

## Known gaps

- An item saved under 2 minutes before a restart stays `Pending` until the next boot.
- Items saved before the corrections fix have no LLM snapshot, so their edits aren't logged.
- The API key ships in the frontend's JavaScript, so anyone can read it.
- People and occasions are hardcoded lists; person, description, and labels can't be edited.

## What's next

1. ~~**Data fixes**~~ — done: corrections table logs only real LLM corrections.
2. ~~**Retry on startup**~~ — done: stuck `Pending` items are re-queued at boot.
3. **Evals** — a fixed set of hand-labelled items; score the parser field by field so prompt
   changes are measured, not guessed.
4. **Embeddings** — add pgvector and store an embedding (a list of numbers representing the
   item's meaning) for each item at save time.
5. **Chatbot** — on the main page. Answers questions like "graduation, $50" by filtering and
   searching your items, then letting the LLM recommend only from those.
6. **Ship** — a short demo video plus the eval numbers below.

*Optional:* image ingest (screenshots instead of links).

## Results

*Eval numbers go here once step 3 is done.*

## Designed, not built

Cut to keep scope tight. Designed enough to build later:

- **Pages** — React Router: Recent, Calendar, People, Occasions, Settings.
- **Accounts** — real login through a provider, replacing the exposed API key.
- **Ownership** — `user_id` on every row, every query filtered by it.
- **People** — per-user `people` table (name, birthday) replacing the hardcoded list.
- **Occasions** — `occasions` table (Gregorian or Hijri dates) + `occasion_people` join table.
- **Calendar** — upcoming dates, "in N days", with idea counts.
- **Editable fields** — person, occasion, description, labels editable on the card.
- **Settings** — default currency, change password, delete account.
- **Reminders** — daily cron endpoint, `reminders_sent` table, email via Resend.
- **Telegram bot** — link once with a one-time code, send links from your phone.
- **Lifecycle** — `idea → shortlisted → bought → gifted`, so bought things stop resurfacing.
