# Gift Logger — Architecture v0

> Status: draft for review. Nothing here is final; the point is to have something concrete to argue with.

## 1. Problem statement

I see gift ideas and aesthetic inspiration constantly — Instagram reels, product links,
screenshots — and they evaporate into my camera roll and saved folder. When someone's birthday
comes around I can't find any of it.

**Gift Logger captures those moments with near-zero friction and makes them retrievable by
meaning and by person.**

## 2. Requirements

### Functional
1. A user can send an Instagram reel/post to the system and have it saved automatically.
2. A user can paste a link or upload an image via a web form.
3. The system automatically extracts a title, description, image, price (if any), and source.
4. The system automatically suggests tags and a category for each item.
5. A user can tag an item to one or more people (Mum, Sara, "coworkers").
6. A user can search in free text — `cozy minimalist desk stuff` — and get semantic matches.
7. A user can ask "gift ideas for Dad" and get items linked to Dad plus items that match his interests.
8. A user can filter by person, tag, price range, occasion, and status.
9. A user can mark an item as `idea → shortlisted → bought → gifted` so it stops resurfacing.
10. A user can browse everything in a visual grid.

### Non-functional (the numbers that drive every decision below)
| Property | Target | Consequence |
|---|---|---|
| Users | 1 (design for N, deploy for 1) | No auth complexity; `user_id` column only |
| Ingest rate | ~10 items/day, bursty | Any queue works; no throughput concerns |
| Total corpus | ~3,000 items after a year | ~18 MB of vectors → fits in RAM → **no vector DB** |
| Search latency | < 500 ms | Brute-force cosine over 3k rows is ~5 ms. Easy. |
| Ingest latency | < 60 s end-to-end, async | Webhook must ack in <5s → background worker required |
| Durability | Never lose a saved item | Persist the raw payload *before* any processing |
| Cost | < $15/month | One small VPS + managed Postgres, or a free tier |

### Explicit non-goals
Multi-user sharing, mobile app, browser extension, price-drop alerts, purchase automation.
All are plausible v2s. None are needed to prove the idea works.

## 3. The hard part

Turning `instagram.com/reel/Cx7y.../` into something searchable.

An Instagram DM webhook gives you **only the URL** of shared media — no caption, no image, no
product info. Instagram's oEmbed no longer returns useful metadata for media you don't own, and
scraping is against their ToS and breaks constantly. So for reels, the honest v0 answer is:
capture the URL and the thumbnail if obtainable, and **let a vision/LLM step plus your own
one-line note supply the meaning.** For ordinary product links (Amazon, Etsy, a shop),
Open Graph tags give you title/image/price cheaply and reliably.

This is worth naming loudly in your README. Recognizing that the hard part is *semantic
enrichment under a hostile data source*, not "building a CRUD app," is the insight that makes
this a portfolio piece.

## 4. Component diagram

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
 │ Instagram DM │   │  Web form    │   │ Image upload │      INGEST
 │  (webhook)   │   │  (paste URL) │   │              │
 └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                 ┌───────────────────┐
                 │   API  (FastAPI)  │   validate → write raw row → enqueue → 200 OK
                 └─────────┬─────────┘
                           │  job
                           ▼
                 ┌───────────────────┐
                 │   Job queue       │   (DB table v0 → Redis/RQ later)
                 └─────────┬─────────┘
                           ▼
        ┌──────────────────────────────────────┐
        │            Worker                    │        PROCESS
        │  1. resolve + normalize URL          │
        │  2. fetch Open Graph / oEmbed        │
        │  3. download + store image           │
        │  4. LLM: title, summary, tags,       │
        │     category, price, who-it-suits    │
        │  5. build embedding text → embed     │
        │  6. update row, status = ready       │
        └──────────────┬───────────────────────┘
                       ▼
      ┌─────────────────────────────────┐
      │  Postgres + pgvector            │        STORE
      │  items · people · tags ·        │
      │  item_people · item_tags        │
      │  Object storage for images      │
      └───────────────┬─────────────────┘
                      ▼
      ┌─────────────────────────────────┐
      │  Search service                 │        RETRIEVE
      │  embed(query) → cosine top-K    │
      │  + SQL filters (person, price)  │
      └───────────────┬─────────────────┘
                      ▼
      ┌─────────────────────────────────┐
      │  Web UI — grid, search, detail  │        PRESENT
      └─────────────────────────────────┘
```

**The one contract that matters:** the API's only job is *accept and acknowledge*. It never
scrapes, never calls an LLM. Everything slow and failure-prone lives behind the queue. If you
internalize one architectural idea from this project, make it that boundary.

## 5. Data model

```sql
-- An item is anything you saved. Nullable everywhere the enrichment might fail.
items (
  id            uuid primary key,
  user_id       uuid not null,             -- seam for future multi-user
  source_type   text not null,             -- 'instagram' | 'link' | 'image' | 'note'
  source_url    text,
  url_canonical text,                      -- normalized; UNIQUE(user_id, url_canonical)
  raw_payload   jsonb not null,            -- exactly what arrived. never mutate.
  title         text,
  description   text,
  image_path    text,
  price_cents   integer,
  currency      text,
  category      text,
  note          text,                      -- my own words. highest-signal field.
  status        text default 'idea',       -- idea|shortlisted|bought|gifted|discarded
  process_state text default 'pending',    -- pending|processing|ready|failed
  error         text,
  embedding     vector(1536),
  created_at    timestamptz default now(),
  updated_at    timestamptz
)

tags (id, user_id, name)                            -- UNIQUE(user_id, name)
item_tags (item_id, tag_id, primary key (item_id, tag_id))

jobs (id, item_id, type, state, attempts, run_after, last_error, created_at)
```

> **⚠ Superseded:** the original `people` / `item_people` design has been replaced. Haitham thinks
> in *roles* (Mom, Big Sis, Friend, Teacher), not names, and roles split into singular people and
> reusable archetypes with different "used up" semantics. See
> [`04-recipient-model.md`](04-recipient-model.md) for `recipients`, `item_recipients`,
> `gift_events` and `occasions`. Note also that `items.status` moved off the item — status is a
> property of the *item–recipient pair*, not the item.

Design notes worth defending in your README:

- **`raw_payload` is immutable.** Enrichment is derived data and can always be recomputed.
  Storing the raw input first means a bug in your LLM prompt costs you a re-run, not your data.
- **`process_state` separate from `status`.** One is about the machine, one is about you.
  Conflating them is a classic beginner bug.
- **`UNIQUE(user_id, url_canonical)`** is what makes ingestion idempotent. Upsert, don't insert.
- **Join tables, not array columns,** for people and tags — so "everything for Mum" is an index
  scan, and renaming a person doesn't require rewriting every row.
- **`note` is the highest-signal field.** Your own two words ("for dad, woodworking") beat any
  scrape. Design the UI to make adding a note trivially easy.

### What gets embedded
Concatenate, then embed:
`title · description · category · tags · my note · people it's linked to`
Store the exact string you embedded in a column. When you change the recipe you'll want to know
which rows used which version — add an `embedding_version` integer.

## 6. "Gift ideas for Dad" — how it actually works

> **⚠ Superseded** by the four-signal ranking in [`04-recipient-model.md §5`](04-recipient-model.md).
> The version below is kept because the reasoning is still the right shape — it just gained a
> profile-similarity term and an archetype-fallback term. Original text follows.

This is the flagship query, so design it deliberately. It's a **hybrid** of three signals:

1. **Explicit link** — items in `item_people` for Dad. Highest weight.
2. **Semantic match** — embed Dad's `interests` + `notes` from the `people` table, cosine
   against all items. Catches things you never explicitly tagged.
3. **Filters** — exclude `status in ('bought','gifted','discarded')`, apply budget.

Then blend: `score = 1.0 * explicit + 0.6 * similarity`, sort, return top 20.
The weights are made up. Say so, and tune them once you have real data — that honesty is a
feature in a portfolio write-up.

## 7. Technology choices, and what was rejected

| Need | Choice | Why | Rejected |
|---|---|---|---|
| Language | Python 3.12 | You know it | — |
| API | FastAPI | Async, auto OpenAPI docs, minimal boilerplate | Flask (no async, no free docs); Django (too much machinery for 8 endpoints) |
| DB | Postgres + `pgvector` | One system for relational data *and* vectors | Pinecone/Weaviate — 3k vectors is 18 MB; a dedicated vector DB adds a vendor, a network hop, and a sync problem to solve a problem you don't have |
| Queue | DB table (v0) → Redis + RQ (v1) | You already have Postgres; `SELECT ... FOR UPDATE SKIP LOCKED` is a real queue. Add Redis when it hurts | Celery — heavyweight; Kafka — comically oversized |
| Images | Local disk (v0) → S3/R2 (v1) | Don't put blobs in Postgres | — |
| Embeddings | OpenAI `text-embedding-3-small` | ~$0.00002/item. Free tier of effort | Self-hosted sentence-transformers — viable and free, but you'd own a model server |
| Enrichment | Claude/GPT with vision, structured JSON out | Handles messy inputs + images in one call | Hand-rolled scrapers per site — brittle, endless |
| Frontend | HTMX + Jinja (v0) → React (if needed) | Ships in a day; keeps you in Python | React SPA — a separate build, state layer, and API contract for a UI that is a grid and a search box |
| Deploy | Docker Compose on Fly.io / Railway | One command; free-to-cheap tier | k8s — no |

**Note the pattern:** almost every rejection is "that solves a scale problem I explicitly do not
have." That reasoning, written down, is exactly what a system design interviewer wants to hear.

## 8. Instagram ingestion — feasibility, honestly

Confirmed as of 2026:

- Requires an Instagram **Business or Creator** account, a Meta app, and the
  `instagram_business_manage_messages` permission.
- Your app receives a webhook when someone DMs that account. **When a message contains a share,
  only the URL of the shared media is included** — no caption, no thumbnail.
- Production access requires Meta App Review. **In development mode you get up to 25 test users
  without review** — which is plenty for a personal tool. This is the loophole that makes v1 viable.
- You must respond to the webhook quickly; message-reply windows are 24 hours.

**Practical setup:** create a second Instagram account (Business), e.g. `@haitham.giftlog`.
Share reels to it from your personal account. Your webhook fires on the incoming DM.
Bonus: reply in the DM thread with "Saved ✓ — who's it for?" and parse the answer. That turns
ingestion into a two-message conversation and solves the note/person problem at capture time,
which is the *best* place to solve it.

**Sequencing:** build the web form first. It exercises the whole pipeline with zero Meta
paperwork. Instagram is then just a second adapter that calls the same `ingest(url, source)`
function. That's a seam paying for itself.

## 9. Failure modes

| Failure | Handling |
|---|---|
| Scrape returns 404 / login wall | Save item anyway with `process_state='failed'`; surface in UI with "add details manually" |
| LLM returns malformed JSON | Validate with Pydantic; retry once with the error appended; then fail the job |
| LLM/embedding API down | Job stays queued, exponential backoff, max 5 attempts → dead-letter |
| Duplicate webhook delivery | Upsert on `url_canonical`; webhooks are at-least-once by design |
| Worker crashes mid-job | `run_after` lease timeout; another worker picks it up. Requires steps to be idempotent |
| Embedding recipe changes | `embedding_version` column + a re-embed backfill script |
| Meta revokes API access | Web form still works. This is why the adapter seam exists |

## 10. Roadmap

**M0 — vertical slice (weekend). ✅** One HTML form → paste URL → row in SQLite → list page.
No queue, no LLM, no embeddings. Prove the thread end to end. *Do not skip this.*

**M1 — foundation.** Postgres, jobs table, worker process, Open Graph fetching, image storage,
**plus the `recipients` table and tagging UI**. Recipients moved up from M3: every item saved
before they exist is an item you must re-tag by hand, and you won't remember why you saved it.

**M2 — intelligence.** LLM enrichment with structured output, pgvector, semantic search endpoint.

**M3 — personalisation.** Recipient profiles + profile embeddings, `gift_events`, the four-signal
ranking, the "used up" policy.

**M4 — proactive.** `occasions`, floating-date resolution, cron scheduler, staged nudges.

**M5 — Instagram.** Business account, Meta app, webhook adapter, DM quick-reply capture flow.

**M6 — polish for portfolio.** Docker Compose, deploy, README with this document's reasoning,
architecture diagram, a short demo GIF.

## 11. Open questions for Haitham

Resolved:
- ~~Specific person or just "this is cool"?~~ → **Roles.** Drove [`04-recipient-model.md`](04-recipient-model.md).
- ~~Do gifted ideas get used up?~~ → **Depends on recipient kind.** Solved via `gift_events` + read-time policy.
- ~~Proactive nudges?~~ → **Yes, occasion-aware.** M4.
- ~~Store what you know about people?~~ → **Yes** — interests, sizes, hints. Powers implicit matching.

Still open:
1. Should saved *aesthetic* inspiration (a room, an outfit) live in the same table as concrete
   giftable products — or are those two different things wearing the same coat?
2. Are you willing to spend ~10 seconds per save adding a note? A huge amount of retrieval quality
   hinges on this. (The DM quick-reply flow is designed to make the answer "yes" almost free.)
3. Do you ever want to search your *own screenshots* by their visual content? That decides whether
   you need image embeddings (CLIP) or just text embeddings of an LLM's description.
4. What currency, and do you ever save things priced in another? Multi-currency is trivial now and
   annoying later.

---

*Sources for the Instagram constraints are listed in the README.*
