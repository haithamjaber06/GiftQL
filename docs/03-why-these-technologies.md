# Why these technologies specifically

The table in `01-architecture.md` gave one-line reasons. This is the full argument for each
choice: what the thing is, what it competes with, why it won *for this project*, and the honest
condition under which the decision would flip.

A note on method first, because it's the transferable part:

> A technology choice is only meaningful **relative to a requirement**. "Postgres is good" is not
> a reason. "Postgres because I need relational joins *and* vector search, and one system doing
> both removes a sync problem" is a reason. Every section below tries to name the requirement first.

---

## 1. Python — the language

**Why:** you already read and write it. That alone decides it. The alternatives (Go, TypeScript,
Rust) offer speed and type safety you do not need at ten items per day, and would cost you months.

**But also:** Python genuinely is the right tool here. The AI/embedding ecosystem is Python-first,
HTML parsing and HTTP clients are excellent, and web frameworks are mature. There's no compromise
being made.

**Would flip if:** you needed thousands of concurrent connections and CPU-bound processing. Not a
scenario that exists here.

---

## 2. FastAPI — the web framework

**The requirement:** accept HTTP requests, validate their contents, respond fast, and handle a
webhook that must be acknowledged within seconds.

**What it is:** a Python library that turns ordinary functions into HTTP endpoints. You write:

```python
@app.post("/add")
def add(url: str = Form(...)):
    ...
```

and it handles routing, parsing, validation, and error responses.

**Why it wins:**

1. **Async-native.** FastAPI is built on Python's `async`/`await`, so one process can hold many
   in-flight requests without a thread each. Relevant because a webhook endpoint should never be
   blocked by other slow work.
2. **Validation is free and automatic.** Type hints on your function signature become real
   validation via Pydantic. A malformed Instagram webhook payload gets rejected with a clear error
   before your code runs. In Flask you'd hand-write those checks and eventually forget one.
3. **Self-documenting.** It auto-generates interactive OpenAPI docs at `/docs`. For a portfolio
   project this is close to free credibility — a reviewer opens one URL and sees your whole API
   surface, typed.
4. **It teaches you good habits.** Declaring request and response shapes explicitly is exactly the
   "contract" thinking from the primer, enforced by the framework.

**Rejected — Flask:** simpler and very popular, but no built-in async, no validation, no generated
docs. You'd hand-roll all three, badly, and learn less about contracts in the process.

**Rejected — Django:** brings an ORM, admin panel, auth, templating, and migrations in one box. If
Gift Logger were a 40-model app with many users, Django's admin panel alone might justify it. For
eight endpoints and one user, you'd spend your time learning Django's conventions instead of
learning system design — and Django's structure would hide the architecture rather than expose it.

**Would flip if:** you wanted a ready-made admin interface for managing people/tags without
building UI. Django's admin is genuinely a strong argument. Worth revisiting at M3 if the people
management UI becomes tedious.

---

## 3. SQLite (M0) → PostgreSQL (M1+) — the database

**The requirement:** store structured items with relationships to people and tags, query them with
filters, *and* do vector similarity search — reliably, cheaply, on one small server.

### Why SQLite for M0
It's a single file. No server to install, no connection string, no Docker. `import sqlite3` is in
Python's standard library. For a weekend vertical slice whose only goal is proving the pipeline,
any setup friction is pure waste.

### Why Postgres from M1
1. **`pgvector`.** A Postgres extension that adds a genuine `vector` column type and similarity
   operators. This is the decisive factor — it lets one query do *both* "similar in meaning to this
   text" *and* "linked to Dad, under £50, not already bought." One system, one query, one
   transaction, always consistent.
2. **Concurrency.** SQLite has coarse write locking. Once an API process and a worker process both
   write, you'll hit `database is locked`. Postgres handles concurrent writers properly.
3. **`SELECT ... FOR UPDATE SKIP LOCKED`.** This is what lets a plain table act as a real job
   queue with multiple workers. It removes an entire piece of infrastructure from your system.
4. **`JSONB`.** Lets `raw_payload` hold whatever arbitrary shape Instagram sends, still queryable.
   You get schema flexibility exactly where you need it without giving up relational integrity
   everywhere else.
5. **It's the default answer, and that's a feature.** Enormous documentation, every hosting
   provider offers it managed, and every engineer reviewing your project knows it.

**Rejected — MongoDB / document databases:** your data is deeply relational (items ↔ people ↔
tags). Document stores make you hand-roll joins in application code. The flexibility they sell is
already available in Postgres via JSONB, without losing joins and constraints.

**Rejected — MySQL:** fine database, but no pgvector equivalent as mature, and weaker JSON support.
Nothing gained.

**Would flip if:** nothing realistic. Postgres is correct here at essentially any scale you'd reach.

---

## 4. pgvector, *not* Pinecone/Weaviate/Chroma — vector search

**The requirement:** semantic search over ~3,000 items with sub-500ms latency, combined with SQL
filters.

**The competing options:** dedicated vector databases — separate systems purpose-built to store
and search embeddings at massive scale.

**Why pgvector wins, in order of importance:**

1. **The scale argument.** 3,000 items × 1536 dimensions × 4 bytes ≈ **18 MB**. That fits in RAM
   with room to spare. Brute-force cosine similarity across it takes single-digit milliseconds.
   The entire product a vector database sells you — clever approximate indexing to search billions
   of vectors — is solving a problem you will not have.
2. **The consistency argument, which matters more.** With a separate vector DB, every item exists
   in two systems. Now you own a **synchronization problem**: what happens when the Postgres write
   succeeds and the Pinecone write fails? Your search index silently disagrees with your database,
   and you need reconciliation jobs to detect and repair drift. With pgvector, the row and its
   vector are written in **one transaction**. They cannot diverge. This is an entire class of bug
   that simply does not exist.
3. **The hybrid query argument.** "Semantically similar AND tagged to Dad AND under £50 AND not
   already bought" is one SQL statement with pgvector. With a separate vector store it's: query
   vectors, get IDs back over the network, query Postgres with those IDs, filter, discover you
   have too few results, go back and ask for more. You've hand-written a query planner.
4. **Operational cost.** One fewer service, one fewer vendor, one fewer set of credentials, one
   fewer thing to be down at 2am.

**Would flip if:** you passed roughly a million vectors, or needed sub-50ms search under heavy
concurrent load. Note pgvector also supports HNSW approximate indexes, so the real flip point is
much further out than people assume.

**Portfolio note:** this is your single best "design decisions" entry. Explicitly rejecting the
fashionable tool with an arithmetic argument and a consistency argument demonstrates more
engineering judgement than adopting it would.

---

## 5. A jobs table (M1) → Redis + RQ (later, maybe) — the queue

**The requirement:** move slow, failure-prone work off the request path, with durability and retries.

**Why a database table first:**

You already have Postgres. A `jobs` table plus `SELECT ... FOR UPDATE SKIP LOCKED` gives you
everything a queue actually needs at this scale:

- **Durability** — jobs survive restarts because they're rows on disk.
- **Multiple workers safely** — `SKIP LOCKED` guarantees no two workers grab the same job.
- **Retries and backoff** — an `attempts` counter and a `run_after` timestamp. Ten lines of logic.
- **Dead-lettering** — a `state` column set to `'dead'`. It's just a query away from being visible.
- **Transactional enqueue** — this one is subtle and valuable: you can insert the item row *and*
  its job in the same transaction. Either both happen or neither does. With an external queue you
  can commit the item and then fail to enqueue, orphaning it forever.
- **Debuggable** — inspecting the queue is `SELECT * FROM jobs`. With Redis you need separate
  tooling to see what's stuck.

**Rejected for now — Redis + RQ:** RQ is a genuinely nice, small library. But Redis is another
service to run, another thing in Docker Compose, another failure mode, and by default it's
in-memory (so misconfigured, it can lose jobs). It buys you speed you don't need — Redis matters
at thousands of jobs/second; you have ten a day.

**Rejected — Celery:** see the glossary section on it. Powerful, but a broker plus a result backend
plus its own conceptual model plus notoriously murky failure modes. Enormous surface area for a
system doing ten jobs a day.

**Rejected — Kafka:** it's an event *streaming* platform for continuous high-volume streams with
multiple independent consumers replaying history. Not a job queue, despite frequent misuse as one.
Brokers, partitions, consumer groups, offsets. Ten events a day.

**Would flip if:** you exceeded a few hundred jobs per second, or your polling loop's constant
`SELECT` queries showed up meaningfully in database load. Both are far away.

---

## 6. OpenAI `text-embedding-3-small` — embeddings

**The requirement:** convert item text into vectors that capture meaning, cheaply, without
operating a model server.

**Why:**
- **Cost is a rounding error.** ~$0.02 per million tokens. Your entire 3,000-item corpus costs
  cents to embed, and re-embedding after a recipe change is similarly trivial. Cost genuinely does
  not enter the decision.
- **1536 dimensions** — a good quality/size tradeoff, and it supports dimension reduction if you
  ever want smaller vectors.
- **Zero operational burden.** One HTTP call. No GPU, no model weights, no serving infrastructure.
- **Quality is strong** on exactly the short descriptive text you'll be embedding.

**Rejected — self-hosted `sentence-transformers`:** free per-call and fully private, and a
perfectly reasonable choice. But you'd own a model server: dependencies, memory footprint (a
model in RAM on a small VPS is real), cold starts, and version management. That's an innovation
token spent on infrastructure rather than on your actual hard problem. Worth revisiting if you
want the project to run fully offline — that would be a legitimate, defensible reason.

**Important design note regardless of provider:** store an `embedding_version` integer on each row
and keep the exact text you embedded. Models get deprecated, and your embedding recipe *will*
change. When it does, you need to know which rows are stale, and you need a backfill script.
Planning for that now is nearly free; retrofitting it is not.

---

## 7. An LLM with vision + structured output — enrichment

**The requirement:** turn a URL or an image into title, description, category, tags, estimated
price, and "who this might suit" — from inputs that are messy, inconsistent, or nearly empty.

**Why an LLM rather than per-site scrapers:**

The alternative is writing extraction rules per source: an Amazon parser, an Etsy parser, an
Instagram parser. Each breaks whenever that site changes its markup, and you'd have an endless
maintenance tail with no end state. An LLM handles arbitrary input shapes, *and* handles images,
*and* can infer soft judgements ("this suits someone into woodworking") that no scraper ever could.

**Why structured output specifically:** you force the model to return JSON matching a declared
schema, then validate with Pydantic. This converts "the AI said some words" into either a typed
object your code can trust, or a clean validation error you can retry on. Without it you're
regex-parsing prose in production, which fails silently and unpredictably.

**Why vision matters:** a large share of your inputs will be screenshots and reel thumbnails —
images with no useful text at all. A vision model describes them in words, and those words become
embeddings, which become searchable. Without vision, screenshots are dead weight in your database.

**The honest limitation:** for Instagram reels the webhook gives you only a URL, and the content
behind it may not be legitimately fetchable. So the enrichment is partly *your own note*, captured
at save time. This is why the DM reply flow ("Saved ✓ — who's it for?") isn't a nice-to-have — it's
compensating for a genuine data gap at the only moment when the context is still in your head.

---

## 8. HTMX + Jinja (v0) → React only if needed — the frontend

**The requirement:** a grid of cards, a search box, a detail page, and a way to tag items to
people. One user, on desktop and phone.

**Why server-rendered HTML with Jinja:**
Your pages are mostly static content generated from a database query. Rendering them on the server
in Python means one language, one codebase, no build step, no API contract to maintain between
frontend and backend, and no client-side state to keep in sync with the server.

**Why HTMX for the interactive bits:**
HTMX lets you write `hx-post="/items/47/tag"` as an HTML attribute and swap in the response, giving
you dynamic updates without writing JavaScript. For "add a tag without reloading the page" — which
is roughly the extent of your interactivity — it's the whole solution in one attribute.

**Rejected — React SPA:** React is excellent for genuinely complex, stateful interfaces. Yours is a
grid and a search box. Choosing it here means: a separate build toolchain, a node_modules tree, a
client-side router, state management, a JSON API contract you must now version and keep in sync,
CORS configuration, and a second language to context-switch into. That's a large tax on a
beginner's learning budget, paid for interactivity you don't have.

**Would flip if:** you wanted drag-and-drop reordering, an infinite-scroll masonry gallery, or
optimistic UI updates. Genuinely fair reasons. If a future employer's stack is React, building the
frontend in React is *also* a legitimate portfolio reason — just be honest with yourself that the
reason is career-strategic, not architectural.

---

## 9. Docker Compose on Fly.io / Railway — deployment

**The requirement:** be publicly reachable (webhooks require it), stay running, cost under
$15/month, and be reproducible by a reviewer.

**Why Docker Compose:** your system has three parts — API, worker, database. Compose describes all
three in one file, and `docker compose up` starts them. For a portfolio project this is
disproportionately valuable: a reviewer runs one command and your entire system works, rather than
following a twelve-step README they'll abandon at step three.

**Why a PaaS rather than a raw VPS:** Fly.io and Railway handle TLS certificates, DNS, restarts on
crash, deploys from git, and managed Postgres. Configuring nginx, certbot and systemd yourself
teaches you sysadmin, not system design — a different subject, on a different day.

**Rejected — Kubernetes:** built to orchestrate containers across fleets of machines with automatic
scaling and self-healing. Genuinely excellent at that. You have one user. Using it here would
signal an inability to size a problem, which is the opposite of what you want a portfolio to show.

**Would flip if:** cost became dominant (a $5 Hetzner VPS beats PaaS pricing), or you needed
persistent GPU access for self-hosted models.

---

## The meta-lesson

Read back through the rejections. Almost every one has the same shape:

> *"That tool solves a problem at a scale I do not have, and adopting it would add a component, a
> failure mode, or a synchronization burden I would then have to manage."*

That sentence is most of what senior engineering judgement consists of. The instinct to reach for
the impressive tool is nearly universal and nearly always wrong; the discipline is in doing the
arithmetic first and letting the numbers decide.

The flip side, and it's equally important: **spend your complexity budget on the actual hard
part.** Here that's enrichment and semantic retrieval. Everywhere else, choose boring.
