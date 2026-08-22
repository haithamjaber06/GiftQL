# System Design, From Zero — Using Gift Logger as the Example

You don't need to memorize "system design interview" trivia (sharding, CAP theorem, load balancers).
Those matter at scale. What matters *now* is the reasoning habit. This doc teaches the habit.

---

## 1. What system design actually is

Writing code answers: **"how do I make this work?"**
System design answers: **"what are the pieces, who owns what, and how do they talk?"**

A system is a set of **components** connected by **contracts**. A contract is a promise:
"give me a URL, I'll give you back a title, image, and price." The component behind that
contract can be a Python function today and a separate service on another machine in a year.
If the contract is clean, that swap costs you nothing. That's the whole game.

> **Rule 1: Design the seams, not the code.** Good architecture is mostly deciding where to
> cut, so that a future change is contained inside one piece instead of smeared across five.

---

## 2. The universal shape

Almost every system you'll ever build is this pipeline:

```
   INGEST  →  PROCESS  →  STORE  →  RETRIEVE  →  PRESENT
```

| Stage | Question it answers | In Gift Logger |
|---|---|---|
| **Ingest** | How does data get in? | Instagram DM webhook, web form paste, image upload |
| **Process** | What do we do to make it useful? | Scrape metadata, download image, LLM tagging, embed |
| **Store** | Where does it live and in what shape? | Postgres tables + object storage for images |
| **Retrieve** | How do we find it again? | Vector search + SQL filters |
| **Present** | How does a human see it? | Web UI |

When you feel lost on any project, ask which of the five stages you're in. It re-orients you fast.

> **Rule 2: Draw the pipeline before you write a line of code.** If you can't draw it, you
> don't understand it yet.

---

## 3. The three questions that drive every design decision

Before choosing anything — database, framework, hosting — answer these.

### Q1: What are the functional requirements?
Concrete sentences of the form *"a user can ___"*. Not "it should be good at search" but
"a user can type `cozy minimalist desk stuff` and get back items they saved months ago that
match in meaning, not just keyword."

### Q2: What are the non-functional requirements?
The qualities, not the features. Scale, latency, cost, availability, consistency.
**This is where beginners skip and where all the interesting decisions actually live.**

For Gift Logger: ~1 user, maybe 10 saves/day, 3k items after a year, search must feel instant
(<500ms), it's fine if an item takes 30 seconds to finish processing after you send it.
Those numbers are *tiny*, and that fact should aggressively simplify every other choice.

### Q3: What's the hardest part?
Every system has one component that's genuinely hard and several that are boilerplate.
Find it early — it constrains everything else.

Here the hard part is **enrichment**: turning `instagram.com/reel/Cx7y.../` into
structured, searchable meaning. Everything else (a form, a table, a list view) is a solved problem.

> **Rule 3: Estimate before you architect.** Run the numbers. 3,000 items with 1536-dim
> embeddings is ~18 MB of vectors. That fits in RAM on a $5 server. So: no vector database,
> no Pinecone, no sharding. The estimate *killed three components* before they were born.

---

## 4. Concepts you'll actually use on this project

Learn these five now; skip the rest until you need them.

**Sync vs. async.**
Synchronous = caller waits for the answer. Asynchronous = caller gets an acknowledgment
immediately and the real work happens later. Instagram's webhook demands a `200 OK` fast,
and scraping + LLM calls take 20+ seconds. So ingestion *must* be async: accept, save a stub,
return, process in the background. This single constraint shapes the whole ingestion design.

**Queues.**
The mechanism that makes async possible. A queue is a durable to-do list between components.
The producer writes "process item 47" and moves on; a worker picks it up whenever. Its real
superpower isn't speed — it's **failure isolation**. If the LLM API is down, the job stays in
the queue and retries. Without a queue, your data is silently lost.

**Idempotency.**
Doing something twice has the same effect as doing it once. Queues retry, users double-click,
webhooks fire duplicates. If "save this item" isn't idempotent, you get duplicate rows.
Fix: a natural unique key (the normalized source URL) and an upsert instead of an insert.

**Normalization vs. denormalization.**
Store each fact once (normalized) so updates can't leave contradictions — e.g. a `people`
table plus an `item_people` join table, rather than a `for_person` text column where you'd
spell your sister's name three different ways. Denormalize (duplicate data) only later, when a
read is measurably too slow.

**Embeddings.**
A model converts text into a list of ~1500 numbers where *distance means dissimilarity in meaning*.
Embed your search query, compare against every stored item's vector, return the closest.
That's semantic search. It is genuinely just an array and a distance function — the magic is
in the model, not the architecture.

---

## 5. The design process, as a checklist

1. **Write the user stories.** Plain sentences. "A user can ___."
2. **Estimate the numbers.** Items/day, total rows, bytes, reads/sec. Back-of-envelope is fine.
3. **Draw the boxes and arrows.** Every arrow is a contract; label what flows across it.
4. **Design the data model.** Tables, columns, keys, relationships. Do this *before* code —
   schema mistakes are the most expensive kind to fix.
5. **Pick the boring technology.** For each box, choose the most boring thing that meets the
   requirement from step 2.
6. **Find the failure modes.** For each arrow ask: what if this is slow? down? returns garbage?
   sends the same thing twice?
7. **Write down what you chose *not* to do, and why.** This is the single most valuable
   artifact for a portfolio project, and the one nobody produces.

---

## 6. Three principles worth internalizing

**Boring technology wins.**
Postgres, a single server, a background worker. You get one or two "innovation tokens" per
project — spend them on the hard part (enrichment), not on infrastructure you could have
rented for $7/month.

**Build the vertical slice first.**
Not "finish the database, then the backend, then the UI." Instead: make *one* item flow all
the way from paste-a-link to see-it-in-a-list, however crappily. That single thread through
all five stages is where you discover the design flaws — while they're still cheap.

**YAGNI, but leave seams.**
Don't build multi-user auth for a system with one user. But *do* put a `user_id` column on your
tables. Skipping the feature is free; skipping the seam costs a migration later.

---

## 7. What separates a portfolio project from a toy

You said this is a portfolio piece. Reviewers are not impressed by feature count. They look for:

- **A README that states the problem and the constraints** before any code.
- **A "Design Decisions" section with rejected alternatives.** "I chose pgvector over Pinecone
  because at 3k items the index fits in RAM and it removes a network hop and a vendor" tells a
  reviewer more about you than 5,000 lines of code do.
- **Explicit failure handling.** Retries, dead-letter queue, what happens when a scrape 404s.
  Most portfolio projects assume the happy path and it's immediately obvious.
- **Something that actually runs.** Deployed, with a link, or a one-command `docker compose up`.
- **Honest scope.** "Single user by design; here's what I'd change for multi-tenant" beats a
  half-finished attempt at scale.

Write these *as you go*, not at the end. Your `docs/` folder is part of the deliverable.

---

## 8. Your homework before we build

Answer these in writing — they're the inputs to the architecture:

1. Write 6–10 user stories in "a user can ___" form.
2. What fields do you want on an item? (Guess. We'll refine.)
3. When you search "gift for Dad," what should rank first, and why?
4. What's the *one* thing that, if it didn't work, would make this project pointless to you?

Question 4 is the important one. That's your hard part, and it deserves your innovation token.

---

**Next:** `01-architecture.md` applies all of this to Gift Logger specifically.
