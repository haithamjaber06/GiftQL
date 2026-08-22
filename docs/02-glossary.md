# Glossary — every term used in this project

A living reference. Whenever a new term appears in our conversation or in the docs, it gets added
here with a plain-language definition and a Gift Logger example. Nothing is assumed.

---

## A. How systems are talked about

**Component**
Any distinct piece of a system with a job of its own: the API, the worker, the database, the UI.
"Component" is deliberately vague about *where* it runs — a component can be a Python function
today and a separate program on another computer next year.

**Contract (also: interface)**
The promise one component makes to another about what it accepts and returns, ignoring how it
works inside. `fetch_metadata(url) -> {title, description, image_url}` is a contract. As long as
that promise holds, you can rewrite the insides freely.

**Seam**
A deliberate place where you *could* cut the system apart later without a rewrite, because a
contract already sits there. Our `ingest(url, source)` function is a seam: the web form calls it
today, the Instagram webhook will call it in M4, and neither knows the other exists.

**Coupling**
How much two components depend on each other's internals. Tight coupling = changing one forces
you to change the other. Loose coupling is the goal, and contracts are how you get it.

**CRUD**
Create, Read, Update, Delete — the four basic database operations. "It's just a CRUD app" is mild
dismissal, meaning the system does nothing interesting beyond shuffling rows in and out. Gift
Logger is *not* just CRUD, because the enrichment and semantic search are real problems.

**Vertical slice**
Building one thin feature all the way through every layer (form → processing → database → screen)
instead of finishing one layer at a time. Milestone 0 is a vertical slice. Its purpose is to
expose design flaws while they're still cheap to fix.

**YAGNI** — "You Aren't Gonna Need It"
Don't build for imagined future requirements. Related but distinct from *leaving seams*: skipping
a feature is free, skipping a seam costs you a painful migration later.

**Back-of-envelope estimate**
Rough arithmetic done before designing, to find out what scale you're actually at. "3,000 items ×
1536 numbers × 4 bytes ≈ 18 MB" took ten seconds and eliminated three technologies.

**Functional vs. non-functional requirements**
Functional = what it does ("a user can search by person"). Non-functional = the qualities it must
have (speed, cost, reliability, scale). Beginners write only functional requirements; almost all
the interesting architecture decisions come from the non-functional ones.

**Latency**
How long one operation takes, measured from the caller's perspective. "Search latency < 500 ms"
means from pressing Enter to seeing results.

**Throughput**
How many operations per unit time. Gift Logger's throughput is ~10 items/day, which is why almost
no infrastructure is needed.

---

## B. Web and networking

**API** — Application Programming Interface
A defined way for one program to ask another program to do something. Our API is a program that
listens for HTTP requests like `POST /add` and responds. When I say "the API," I mean the FastAPI
program in `app.py`.

**Endpoint**
One specific address the API responds to, e.g. `POST /add` or `GET /search`. An API is a
collection of endpoints.

**HTTP request / response**
The message format the web runs on. A client sends a request (a method like GET or POST, a path,
optional data); the server sends back a response (a status code plus a body).

**Status code**
A three-digit number summarizing the response. `200 OK` = it worked. `303 See Other` = redirect
the browser elsewhere (we use it after saving so refreshing doesn't re-submit the form).
`404 Not Found`, `500 Internal Server Error`.

**Webhook**
A **reverse API call**. Normally *you* call someone else's server when you want something. With a
webhook, you register a public URL with them, and *they* call *you* whenever an event happens.
"Push instead of pull."

For us: we tell Meta "when someone DMs `@haitham.giftlog`, send an HTTP POST to
`https://giftlogger.fly.dev/webhooks/instagram`." Then Instagram's servers call our server the
instant a reel is shared. The alternative — polling — would mean asking "any new messages?" every
30 seconds forever, which is wasteful and slow. The catch is that a webhook requires your server
to be publicly reachable and to reply *fast*, which is exactly what forces our async design.

**Polling**
The opposite of a webhook: repeatedly asking "anything new?" on a timer. Simpler, but wasteful
and higher-latency.

**Open Graph tags**
Invisible `<meta property="og:title" ...>` lines that websites put in their HTML so that links
shared on social media show a nice preview card. They're free, structured metadata, published
voluntarily — which is why reading them is legitimate and stable, unlike scraping.

**oEmbed**
An older standard where a site offers an official endpoint that turns a URL into embeddable
metadata. Instagram's is now heavily restricted for media you don't own, which is part of why
reels are hard.

**Scraping**
Downloading a page and pulling data out of the raw HTML that the site never intended to expose.
Legally grey, technically fragile (any layout change breaks it), and against Instagram's Terms of
Service. We rely on Open Graph tags instead, and accept that Instagram gives us almost nothing.

**ToS** — Terms of Service. The rules you agree to when using a platform.

**Rate limit**
A cap on how many requests you may make in a time window. Not a concern at 10 items/day, but the
reason production systems need queues with backoff.

**User-Agent**
A header identifying what software is making a request. We set a polite one in `fetch_metadata`.

**Canonicalization / normalization (of a URL)**
Reducing different spellings of the same address to one standard form —
`https://www.shop.com/thing/?utm_source=ig` and `http://shop.com/thing` both become
`https://shop.com/thing`. Without it, the same product saved twice looks like two items and your
duplicate-prevention silently fails.

---

## C. Async, queues, and reliability

**Synchronous (sync)**
The caller waits for the work to finish before doing anything else. M0 is synchronous: submitting
the form hangs the browser for however long the metadata fetch takes.

**Asynchronous (async)**
The caller gets an immediate acknowledgment, and the real work happens later, elsewhere. Required
here because Instagram demands a fast reply but enrichment takes 30 seconds.

**Queue**
A durable to-do list sitting between two components. One side adds jobs, the other picks them up
whenever it's ready. "Durable" is the key word: the list survives crashes and restarts.

Its real value isn't speed, it's **failure isolation** — if the LLM is down, the job waits in the
queue and retries rather than vanishing.

**Job**
One unit of queued work. For us: "enrich item 47."

**Producer / Consumer**
The component that adds jobs (our API) and the component that takes them (our worker).

**Worker**
A separate long-running program whose whole life is: take a job off the queue, do it, mark it
done, repeat. It runs independently of the API. You can run five of them if one isn't enough.

**"The API accepts and acknowledges; it never enriches"**
This is the most important sentence in the architecture doc, so, unpacked:

When a request arrives, the API does only fast, safe, predictable things — check the input is
valid, write one row to the database recording that this thing arrived, add a job to the queue,
reply `200 OK`. Total time: a few milliseconds.

It does **not** download the linked page, does **not** call an LLM, does **not** generate
embeddings. Those are slow (seconds to a minute) and unreliable (the site may be down, the LLM may
be rate-limited, the page may 404). All of that lives in the worker, behind the queue.

Why this matters concretely:
- Instagram will consider the webhook failed and retry if you're slow. Fast ack prevents that.
- If enrichment happened inside the request and the LLM was down, the request would fail and
  **your saved item would be lost**. With the queue, the item is already safely stored and the
  enrichment just retries later.
- The API and the worker can then be scaled, deployed, and debugged separately.

M0 deliberately violates this rule so you can feel the pain before M1 fixes it.

**Idempotent / idempotency**
An operation you can safely run twice and get the same result as running it once. Pressing a
button twice shouldn't create two rows. Achieved here by having a unique key
(`url_canonical`) and using an upsert.

**At-least-once delivery**
The guarantee most queues and webhooks actually provide: your message will definitely arrive, but
it might arrive twice. This is why idempotency isn't optional — it's the required counterpart.

**Retry with exponential backoff**
When something fails, try again after 1 second, then 2, then 4, then 8… Backing off avoids
hammering a service that's already struggling.

**Dead-letter queue (DLQ)**
Where a job goes after it has failed its maximum number of retries. Instead of silently
disappearing or retrying forever, it lands in a visible pile you can inspect and fix.

**Lease / visibility timeout**
When a worker takes a job, it "leases" it for, say, 5 minutes. If the worker crashes and the lease
expires, another worker may claim the job. This is how crashes self-heal — and why every step must
be idempotent, since a half-finished job may be redone.

**Failure mode**
A specific way the system can break. Listing them explicitly ("what if the scrape 404s?") is one
of the clearest markers of engineering maturity, and one of the most commonly skipped steps.

---

## D. Databases

**Schema**
The structure of your data: which tables exist, what columns they have, what types those are.

**Row / record** — one entry. **Column / field** — one attribute of every entry.

**Primary key**
The column uniquely identifying a row. We use a **UUID** (Universally Unique Identifier) — a
random 128-bit value like `3f2b9a...` — rather than an auto-incrementing number, so IDs can be
generated anywhere without coordination and don't leak how many items you have.

**Foreign key**
A column pointing at another table's primary key. `item_people.person_id` points at `people.id`.
The database can then enforce that you never reference a person who doesn't exist.

**Index**
A separate lookup structure that makes searching a column fast, at the cost of extra storage and
slightly slower writes. Without one, finding a row means reading every row.

**Unique index**
An index that additionally forbids duplicates. `UNIQUE(user_id, url_canonical)` is what physically
prevents the same link being saved twice — the database enforces it, so a bug in your code can't
violate it.

**Index scan vs. full table scan**
Using the index to jump straight to matching rows, versus reading everything. The difference
between instant and slow as data grows.

**Upsert**
Insert if new, update if it already exists. One atomic operation instead of a racy
"check-then-insert." Written in SQL as `INSERT ... ON CONFLICT ... DO UPDATE`.

**Atomic**
Happens completely or not at all — no half-finished middle state visible to anyone else.

**Transaction**
A group of database operations treated as one atomic unit. Either all commit or all roll back.

**Race condition**
A bug where the outcome depends on the timing of two things happening at once. Classic example:
two requests both check "does this URL exist?", both see no, both insert, and you get a
duplicate. Upserts and unique indexes eliminate this class of bug.

**Normalization**
Storing each fact exactly once. A `people` table plus an `item_people` link table, rather than
typing your sister's name into every row — where you'd inevitably spell it three ways and be
unable to rename her.

**Denormalization**
Deliberately duplicating data to make reads faster. A valid optimization, but only *after* you've
measured that reads are actually too slow. Cost: you must now keep the copies in sync.

**Join table (junction / link table)**
A small table that exists purely to connect two others in a many-to-many relationship. One item
can suit several people; one person can have many items. `item_people(item_id, person_id)`
expresses that cleanly, and is indexable.

**Many-to-many / one-to-many**
Relationship shapes. One person → many items is one-to-many. Items ↔ tags is many-to-many and
needs a join table.

**JSONB**
A Postgres column type storing arbitrary JSON, queryable and indexable. We use it for
`raw_payload` — the exact data as it arrived, whatever shape it happened to be.

**Immutable**
Never changed after creation. `raw_payload` is immutable: enrichment writes to *other* columns.
This means a bug in your enrichment costs you a re-run, never your original data.

**Derived data**
Anything computable from something else you already stored. Titles, tags, and embeddings are all
derived from `raw_payload`. Derived data is safe to delete and regenerate — a genuinely
liberating property.

**Migration**
A versioned script that changes the schema of a database that already has data in it (adding a
column, changing a type). Needed because you can't just edit the schema and lose everything.

**Backfill**
Running a process over existing rows to populate a newly added column — e.g. re-embedding all
3,000 items after changing the embedding recipe.

**`SELECT ... FOR UPDATE SKIP LOCKED`**
A Postgres feature that turns an ordinary table into a working queue. `FOR UPDATE` locks the rows
you selected so nobody else touches them; `SKIP LOCKED` tells other workers "don't wait, just grab
the next unlocked ones." Result: many workers pull from the same table without ever handing each
other the same job. This is why you don't need Redis at your scale.

**Multi-tenant**
One deployment serving many separate users whose data must never mix. Not building it, but the
`user_id` column is the seam that would make it possible.

---

## E. AI / search

**Embedding**
A model converts a piece of text into a long list of numbers (a **vector**) positioned so that
*similar meanings land near each other*. "Cozy desk setup" and "warm walnut monitor riser" end up
close together despite sharing no words.

**Vector**
Just an array of numbers. Ours have **1536 dimensions**, meaning 1536 numbers per item. There's
nothing mystical here — the intelligence is in the model that produced the numbers, not in the
data structure.

**Cosine similarity**
The standard way to measure how close two vectors are: 1.0 = identical direction, 0 = unrelated.
Semantic search is literally: embed the query, compute cosine against every stored vector, sort,
return the top 20.

**Semantic search vs. keyword search**
Keyword search (`LIKE '%desk%'`) matches characters. Semantic search matches meaning. M0 uses
keyword search specifically so you can watch it fail on a query like "cozy minimalist desk stuff"
and understand exactly what embeddings buy you.

**Brute force (in search)**
Comparing the query against every single stored vector, no shortcuts. Sounds bad; at 3,000 items
it takes ~5 milliseconds. Approximate index structures only earn their complexity in the millions.

**ANN — Approximate Nearest Neighbour**
Clever index structures (HNSW, IVFFlat) that find *almost* the closest vectors much faster than
brute force. Necessary at millions of vectors. Not necessary for you — which is a decision worth
stating explicitly in your README.

**LLM** — Large Language Model. The class of model (Claude, GPT) that reads and writes text.

**Vision model**
An LLM that also accepts images. Needed here so a screenshot of a room can be described in words,
which can then be embedded and searched.

**Structured output**
Forcing the model to reply in a fixed JSON shape rather than prose, so your code can rely on it.
Combined with Pydantic validation, this turns "the AI said something" into "I have a typed object
or a clean error."

**Prompt**
The instructions given to the model. Yours will be a real piece of engineering: "extract title,
category, tags, estimated price, and who this might suit, as JSON matching this schema."

**Token**
The unit LLMs are billed and measured in — roughly ¾ of a word. Relevant only for cost estimates.

**CLIP**
A model that embeds images and text into the *same* vector space, so you can search photos with
words directly. Only needed if you want to search your own screenshots by their visual content
rather than by an LLM's written description of them.

**Hybrid search**
Combining several ranking signals into one score — here: explicit person links, semantic
similarity, and SQL filters. Almost all good real-world search is hybrid.

**Ranking / weights**
The formula deciding what appears first (`score = 1.0 × explicit + 0.6 × similarity`). The
numbers start as guesses and get tuned against real data. Admitting that in a portfolio README is
a strength, not a weakness.

---

## F. Deployment

**Server / VPS**
A computer that runs your code and stays on. A VPS (Virtual Private Server) is a rented slice of
one, typically $5–10/month.

**Object storage (S3, Cloudflare R2)**
A service for storing files — images, in our case — cheaply, at any size, served over HTTP.
Files don't belong in a database; databases are for structured, queryable data.

**Container / Docker**
A container packages your code together with its exact dependencies and OS libraries, so it runs
identically on your laptop and on the server. It kills "but it works on my machine."

**Docker Compose**
A single file describing several containers that run together — app, worker, database — started
with one command. For a portfolio project this is high value: a reviewer types
`docker compose up` and your whole system runs.

**Kubernetes (k8s)**
An orchestration system for running containers across many machines with automatic scaling and
healing. Genuinely excellent at large scale, and comically oversized for one user. Reaching for it
here would be a red flag, not a green one.

**PaaS (Fly.io, Railway, Render)**
"Platform as a Service" — you hand them a container or a repo and they run it, handling the
server, networking, and TLS. The right level of abstraction for this project.

**Environment variable**
A configuration value (API keys, database URLs) passed in from outside the code, so secrets never
get committed to git.

**Reverse proxy**
A server sitting in front of your app handling TLS, routing, and static files. Your PaaS provides
this; you won't configure it.

---

## G. Named technologies (what each one actually is)

Full reasoning for each choice is in `03-why-these-technologies.md`. Short identifications:

| Name | What it is |
|---|---|
| **Python** | The programming language everything here is written in |
| **FastAPI** | A Python library for building web APIs; async-native, auto-generates docs |
| **Flask** | An older, simpler Python web framework; no built-in async or validation |
| **Django** | A large "batteries-included" Python web framework with its own ORM and admin panel |
| **Uvicorn** | The program that actually runs a FastAPI app and listens on a port |
| **Pydantic** | Python library that validates data against a declared shape; built into FastAPI |
| **SQLite** | A database that is just a single file on disk. Zero setup. Used in M0 |
| **PostgreSQL ("Postgres")** | The mainstream open-source relational database. Used from M1 |
| **pgvector** | A Postgres extension adding a `vector` column type and similarity operators |
| **Pinecone / Weaviate** | Dedicated vector databases sold as a service. Rejected — see 03 |
| **Redis** | An in-memory data store, often used as a fast queue or cache |
| **RQ (Redis Queue)** | A small Python library for running background jobs on Redis |
| **Celery** | The long-standing Python distributed task queue. Powerful, heavy, lots of moving parts |
| **Kafka** | A distributed event streaming platform built for millions of events/second at large companies |
| **BeautifulSoup** | Python library for parsing HTML — how we read Open Graph tags |
| **httpx** | Modern Python HTTP client; works both sync and async |
| **Jinja** | Python templating engine — HTML files with placeholders |
| **HTMX** | A small JS library letting plain HTML do dynamic updates without writing JavaScript |
| **React** | A JavaScript library for building interactive UIs as components |
| **SPA** | "Single Page Application" — a JS app that renders everything client-side |
| **Docker / Compose** | Containers, and multi-container orchestration for one machine |
| **Fly.io / Railway** | PaaS providers that run containers for you |
| **`text-embedding-3-small`** | OpenAI's cheap, good embedding model. 1536 dimensions |
| **sentence-transformers** | Open-source library for running embedding models on your own hardware |

---

## H. The stories behind Celery and Kafka

You asked me to clear these up, because I name-dropped them as rejections without context.

**Celery** is the tool Python developers have reached for to run background jobs since ~2009. It's
capable and battle-tested. But it needs a message broker (Redis or RabbitMQ), a result backend, a
separate worker process, and its own configuration vocabulary, and its failure modes are famously
confusing — silently lost tasks, workers that appear alive but consume nothing, version mismatches
between broker and worker. That's a lot of surface area to debug for a system processing ten items
a day. It's the "obvious" choice, which is precisely why it's worth consciously rejecting.

**Kafka** comes from LinkedIn, built to move enormous continuous streams of events — think every
click, every message, every metric across a company — with multiple independent consumers replaying
the same stream. It's genuinely excellent at that. It also involves brokers, partitions, consumer
groups, offset management and, historically, ZooKeeper. It is not a job queue; people misuse it as
one. Gift Logger produces roughly ten events per day. Reaching for Kafka here isn't ambitious, it's
a signal you can't size a problem — and sizing problems correctly is the actual skill.

The general lesson: **most famous infrastructure exists to solve scale problems.** Naming the tool,
naming what it's for, and explaining why your scale doesn't need it is a stronger engineering
signal than using it.

---

## I. Data modelling (added while designing the recipient model)

**Entity**
A "thing" your system stores that has its own identity and lifecycle. Items, recipients, and gift
events are entities. Deciding what counts as an entity *is* data modelling.

**Cardinality**
How many of something there are in a relationship. "Mom" has cardinality one; "Teacher" has
cardinality many. Getting cardinality wrong is the most common source of broken schemas.

**Archetype**
Our term for a role filled by many interchangeable people — Friend, Teacher, Coworker. Contrasted
with a singular role (Mom, Gf) that maps to exactly one human.

**Enum (enumeration)**
A column restricted to a small fixed set of values, like `kind IN ('person','archetype')`. Cheap
and self-documenting when the set genuinely never grows. When it does grow, use a table instead.

**Append-only log**
A table you only insert into — never update, never delete. `gift_events` is append-only, because
"I gave this on this date" is a fact, and facts don't change. They accumulate.

**Policy vs. mechanism** *(and: "store facts, apply policy at read time")*
Mechanism = what the system records. Policy = the rules about how you use those records. Keep them
apart. If "hide gifts I already gave" is baked into your schema, changing your mind costs a
migration and lost history; if it's a `WHERE` clause over a log of facts, it costs one line.

**Soft delete**
Marking a row `archived = true` instead of deleting it. Preserves history and avoids orphaning rows
that point at it. Almost always the right choice when other tables reference the row.

**Orphaned data**
Rows pointing at something that no longer exists — a gift event whose recipient was deleted. Foreign
keys plus soft deletes prevent this.

**Cascade (`ON DELETE CASCADE`)**
Instruction that deleting a parent row automatically deletes children pointing at it. Correct for
`item_recipients` (a candidacy is meaningless without its item), wrong for `gift_events` (the
history should survive).

**Polymorphic association**
A foreign key that could point at one of several different tables. Usually a design smell — it
defeats database-level integrity checks. A single table with a `kind` column is generally cleaner,
which is why `recipients` holds both people and archetypes.

**Provenance**
Recording *where* a piece of data came from — our `source = 'manual' | 'llm_suggested'` column. The
rule with no exceptions: **never let generated data be indistinguishable from user-entered data.**
It lets you audit the model, show suggestions as suggestions, and undo a bad prompt with one DELETE.

**Backfill** *(also in section D)*
Populating a newly added column across existing rows. Note the thing you *cannot* backfill: human
judgement. You can re-run an LLM over old items; you cannot recover why you personally saved
something eight months ago. This is why capture-affecting decisions come before retrieval ones.

**Interrogate the nouns**
The habit of asking, for every noun in a requirement, whether it secretly means two things.
"People" meant roles *and* archetypes here. Half of all bad data models are one overloaded noun.

---

## J. Scheduling and UX

**Cron**
A scheduler that runs a job on a recurring time pattern, written as five fields:
`0 8 * * *` = minute 0, hour 8, every day. The standard way to say "run this daily at 8am."

**Scheduled job / batch job**
Work that runs on a timer rather than in response to a request — our nightly occasion check.
Distinct from queue jobs, which are triggered by events.

**Digest**
Batching many notifications into one periodic message instead of sending each immediately. The
difference between a useful nudge and something you mute in a week.

**Staged notifications**
Multiple nudges at decreasing lead times (21 days → 7 → 1), each with a different message and
purpose. Better than one alert, which arrives either too early to act on or too late to ship.

**Typeahead / autocomplete**
Filtering a list of options as the user types. Needed above roughly ten options; below that, plain
buttons are faster.

**Prefill / smart defaults**
Filling a field with the most likely answer so the user confirms rather than composes. The LLM
guessing the recipient turns tagging from "choose from 30" into "tap once, or don't."

**Floating date**
A date defined by a rule rather than a fixed number — "the second Sunday in May." Store the rule
and compute per year. Storing the resolved date is a classic bug that surfaces silently, twelve
months later.

**Capture friction**
How much effort it takes to get data *in*. The governing constraint on this whole project:
**retrieval quality is capped by capture quality.** Time spent removing friction at save time pays
back more than any query optimisation.

---

## K. Messaging, intent, and money (added while agreeing Spec v1)

**Correlation**
Working out which separate inputs belong to the same logical event. A shared link and the
annotation you type after it arrive as **two independent messages**; correlation is what links
them. It's the hidden hard part of the capture flow, and a genuinely classic distributed-systems
problem.

**Reply-to**
Replying to a specific earlier message so the platform tells your server which one you meant.
Explicit correlation, no guessing. Telegram supports it properly; Instagram doesn't.

**State machine**
A system that remembers "where we are" in a multi-step interaction — e.g. *"I asked who it's for,
so the next message is the answer."* Robust, but it means holding per-conversation state, which is
real (small) infrastructure. We use it only as a fallback.

**Heuristic**
A rule of thumb that's usually right but has no guarantee. "Attach any text arriving within 60
seconds to the last link" is a heuristic — and it fails on exactly the common case of sharing three
reels then annotating them.

**Share sheet**
The OS-level "Share to…" menu on your phone. The key insight of Spec v1: the share sheet already
hands a bot the same URL that Instagram's webhook would deliver — so the Meta API buys nothing.

**Intent routing / intent classification**
Deciding what an incoming message is *for* before acting on it. Four intents here: `create`,
`annotate`, `update`, `query`. When confidence is low, **ask rather than guess** — a clarifying
question always beats a wrong database write.

**Function calling / tool use**
Giving a model a set of defined functions and letting it fill in the arguments rather than write
prose. `search_items(recipient="Gf", occasion="Anniversary")`. Reliable and debuggable, because you
can display the arguments it chose and let the user correct them.

**Text-to-query**
The general pattern of translating natural language into a structured query. Function calling is
the safe version; letting a model write raw SQL against your database is the dangerous one.

**Deep link**
A URL that opens directly into a specific pre-filtered state —
`/browse?recipient=gf&occasion=anniversary`. How the bot hands a conversation off to the web UI
without rebuilding a filter interface inside chat.

**Audit log**
An append-only record of every change: who (user or LLM), what, before, after, when. Makes `undo`
possible and lets you diagnose a bad edit weeks later. Mandatory once a model can write to your data.

**Provenance** *(see also section I)*
Here specifically: `source = 'manual' | 'llm_suggested'` on every AI-inferred field.

**Triage**
A holding state for data that arrived but isn't complete — `process_state='needs_triage'`. The
principle: **save first, understand later.** Nulls are recoverable; lost items aren't.

**Echo / confirmation loop**
Replying with what the system understood — *"Saved ✓ Store · Gf (Hala) · Anniversary · ~20 JOD"* —
so a wrong parse costs one correction instead of silent bad data. Making the machine's
interpretation visible is what separates a tool people trust from one they abandon.

**ISO 4217**
The standard three-letter currency codes: `JOD`, `USD`, `EUR`. Store the code with every price.

**Minor unit**
The fractional part of a currency. Most have 2 decimal places (100 cents); **JOD has 3** — 1000
fils — as do KWD, BHD, OMR and TND. The near-universal advice "store money as integer cents"
silently assumes 2 decimals and produces wrong values for JOD.

**Never use floats for money**
Binary floating point can't represent 0.1 exactly, and the error accumulates invisibly. Use
`numeric` / `decimal`, which are exact. This is one of the few absolute rules in programming.

**DDL** — Data Definition Language: the SQL that defines structure (`CREATE TABLE`), as opposed to
the SQL that manipulates rows (`SELECT`, `INSERT`).

**CHECK constraint**
A rule the database itself enforces — `CHECK (price_min <= price_max)`. Constraints in the database
can't be bypassed by a buggy application, which is why they belong there rather than only in code.

**Partial index**
An index covering only rows matching a condition: `UNIQUE ... WHERE occasion_id IS NULL`. Needed
here because `NULL` never compares equal to anything, so a plain UNIQUE constraint containing a
nullable column silently fails to prevent duplicates. A real gotcha worth remembering.

**GIN index**
A Postgres index type for "does this contain that" queries over arrays and JSON — how
`labels @> '{Desk}'` stays fast.
