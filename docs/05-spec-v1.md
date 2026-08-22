# Gift Logger — Spec v1 (agreed)

> This is the authoritative document. Where earlier docs disagree with this one, this one wins.
> It formalises Haitham's own ingestion model, which turned out to be simpler and better than the
> design in `01-architecture.md`.
>
> Docs 00–04 are kept as the reasoning trail — the wrong turns are the educational part.
>
> **Amended** by [`06-llm-contract.md`](06-llm-contract.md), which adds the fourth item kind,
> the human/LLM division of labour, recipient inference, accuracy measurement, and the ranking model.

---

## 1. The flow, end to end

```
  Scrolling reels → see a custom bag shop
        │
        │  Share sheet → Telegram bot
        ▼
  [link]                                    ← message 1
  "Gf (Hala) - Anniversary - 20 JOD"        ← message 2, sent as a REPLY to message 1
        │
        ▼
  Bot saves the link instantly (needs_triage), acks in <1s
        │
        ▼
  Worker: correlate → parse the line → fetch Open Graph → classify kind
          → LLM enrich → embed → mark ready
        │
        ▼
  Bot replies: "Saved ✓ Store · Gf (Hala) · Anniversary · ~20 JOD — reply to fix"
        │
        ⋮  weeks later
        ▼
  "Show me inspos for gifts to my GF for our anniversary"
        │
        ▼
  LLM → filters {recipient: Gf, occasion: Anniversary}  (no semantic search needed)
        │
        ▼
  Bot: top 4 as cards + "12 more →" deep link to a filterable web table
```

**Design rule that governs everything above:** the item is written to the database the *moment* it
arrives, before any parsing, correlation, or enrichment. Everything else is an enhancement applied
later. Nulls are acceptable; lost items are not.

---

## 2. Four kinds of saved thing

The single most important discovery in this conversation. "A store that sells good looking custom
bags" is not a product — which is exactly why a price *range* was needed.

| `kind` | What it is | Recipient | Price | Buyable? | How you find it again |
|---|---|---|---|---|---|
| `product` | One specific item | required | single value | **yes, once** | filters |
| `store` | A shop/account you'll return to | usually set | a range | **no** — permanent | filters |
| `idea` | A thought you typed. No link | required | optional | yes | filters |
| `inspo` | A room, desk, outfit, lighting | **null** | usually null | no | labels + semantic |

> `idea` was added after the homework in `00-system-design-primer.md §8`. Note that `idea` and
> photo-sourced `inspo` both have **no URL**, which breaks the `url_canonical` idempotency key —
> see [`06-llm-contract.md §4`](06-llm-contract.md) for the content-hash fix.

**Why `store` must be its own kind, not a product with a fuzzy price:** a store is never used up.
You buy from it repeatedly, forever. If buying marked it done, your Gf list would silently fill with
shops you already used and you'd stop trusting the tool. This is the same "reuse" logic as archetype
recipients, applied to the item side.

**Why `inspo` has no recipient:** confirmed — it's saved for its own sake. Which has a sharp
architectural consequence, see §6.

---

## 3. Capture channels — decision

**Telegram bot is primary. Web form is the desktop fallback. The Instagram API is rejected.**

The reasoning, worth putting in the README verbatim:

> From a reel, tap Share → Telegram → bot. The phone's native **share sheet** hands the bot the same
> URL that Meta's webhook would have delivered. The Instagram Messaging API adds nothing — it still
> delivers only a URL, no caption, no thumbnail — while costing a Business account, a Meta app,
> `instagram_business_manage_messages` permission, App Review, a 24-hour messaging window, and
> ongoing exposure to unilateral API changes. Telegram costs five minutes with BotFather, and gives
> back proper reply-to and inline keyboards, which Instagram cannot.

**Rejecting the flashier integration for a well-argued reason is a stronger portfolio signal than
building it.** Document the evaluation; that's the artefact.

---

## 4. The correlation problem

A link and its annotation arrive as **two independent messages**. Correlating them — knowing which
inputs belong to the same logical event — is the hidden hard part of this flow.

**Chosen mechanism: reply-to, with a prompt fallback.**

1. Link arrives → save immediately, `process_state = 'needs_triage'`, ack.
2. You long-press and reply with `Gf (Hala) - Anniversary - 20 JOD`. Telegram includes the ID of the
   message you replied to. Correlation is **explicit and unambiguous** — no guessing.
3. If nothing arrives within ~90 seconds, the bot asks: *"Who / occasion / price?"* and treats the
   next message in that conversation as the answer.
4. If you never answer, it stays `needs_triage` and appears in a triage list on the web.

Rejected — **time-window heuristic** (attach any text within 60s): breaks exactly when you share
three reels in a row then annotate them, which is the normal scrolling pattern.

Rejected as primary — **conversational state machine** (bot holds "I am awaiting an answer" state):
robust, but requires per-conversation state. It's used only as the fallback in step 3, where the
state is short-lived and scoped to one message.

**Every inbound message is logged raw in an `inbox_messages` table** before anything else. When
correlation misbehaves — and it will — the log is what lets you see exactly what arrived and in what
order. Debuggability is a design requirement, not a nicety.

---

## 5. Parsing the annotation line

`Gf (Hala) - Anniversary - 20 JOD` → LLM with **structured output** (forced JSON matching a schema):

```json
{
  "recipient_label": "Gf",
  "recipient_name":  "Hala",
  "occasion":        "Anniversary",
  "price_min":       20.0,
  "price_max":       20.0,
  "currency":        "JOD",
  "note":            null
}
```

Rules:

- **Every field is optional.** `just cool` is a valid annotation and yields all nulls.
- **A range is expressed by min ≠ max.** `15-30 JOD` → min 15, max 30. A single price sets both.
  This is what makes `store` work without a second price model.
- **Unknown recipient labels are created, not rejected.** Typing `Cousin` for the first time creates
  the recipient with `kind` guessed by the LLM and confirmable later. Never block capture on setup.
- **Everything the LLM infers is stored with `source='llm_suggested'`,** never mixed with your
  explicit input. You can audit it, display it as a suggestion, and undo a bad prompt with one
  `DELETE`.
- **Echo the parse back.** *"Saved ✓ Store · Gf (Hala) · Anniversary · ~20 JOD"* — one glance
  confirms it, one reply fixes it. Correcting a wrong parse must be cheaper than avoiding it.

### Money: two gotchas

**Never store money in a float.** Binary floating point cannot represent 0.1 exactly; errors
accumulate silently. Use `numeric`, which is exact.

**JOD has three decimal places.** The Jordanian Dinar divides into 1000 fils, not 100. The near-
universal advice "store money as integer cents" quietly assumes two decimals and produces wrong
values for JOD, along with KWD, BHD, OMR, TND. We store `numeric(14,3)` plus an ISO-4217 currency
code, which handles JOD, USD and everything else without special cases.

**No conversion.** Store the original currency, filter within it. Converted values go stale, and
"was this cheap?" is a question about the day you saw it, not today's rate.

---

## 6. Retrieval — two modes, because there are two kinds of content

This is the correction that came out of your own example, and it matters.

### Mode A — Gifts: structured filters, no embeddings

*"Show me inspos for gifts to my GF for our anniversary"* contains **zero semantic content**.
`recipient = Gf` and `occasion = Anniversary` are exact matches. Plain SQL answers it instantly and
explainably.

The LLM's job here is **not to search** — it is to translate your sentence into filter arguments.
That's **function calling**: the model fills in the parameters of a query you defined rather than
producing an answer. Reliable, cheap, and debuggable, because you can *show* the filters it chose:

> *Reading that as: for **Gf (Hala)** · **Anniversary** · any price — [change]*

Making the machine's interpretation visible is the difference between a tool people trust and one
they stop using after the second wrong answer.

### Mode B — Inspo: labels + semantic search

Inspo has no recipient and no occasion. There is nothing to filter on. Meaning-based search is the
**only** way back in — which is now a precise, defensible justification for the embedding
infrastructure rather than a vague one.

The LLM assigns labels at ingest (`Room`, `Desk`, `Lighting`, `Wood`, `Warm`), and those plus the
description get embedded. `cozy minimalist desk stuff` then works.

### Mode C — the bridge (M3)

Embed each person's profile (`Hala — into ceramics, warm neutrals, hates clutter`) and compare it
against *all* items, including ones you never tagged to her. That's how a serving board saved eight
months ago as "nice" surfaces for her birthday. It's the highest-value feature in the system and it
is strictly a later milestone — it needs profiles and a corpus before it does anything.

### The answer surface

Bot replies with the top 3–4 as image cards, plus **"12 more →"** as a **deep link** — a URL that
opens straight into a pre-filtered state, `/browse?recipient=gf&occasion=anniversary`.

Chat is good at *asking*. It is bad at filtering, sorting, and comparing twenty thumbnails. Your
step 6 said *"a table pops out and I can filter from it as I like"* — that's a web page. Use each
surface for what it's good at instead of duplicating a filter UI into chat.

---

## 7. Intent routing

One inbox, four intents. Every inbound message is classified before anything happens:

| Intent | Trigger | Action |
|---|---|---|
| `create` | a link, or a photo | new item, `needs_triage` |
| `annotate` | text replying to a saved item | parse, fill fields, create candidacy |
| `update` | *"bought the bag for Hala"* | find the item, change state |
| `query` | *"show me anniversary ideas for Hala"* | filters → results |

Classification is a cheap LLM call with a fallback: **if confidence is low, ask rather than guess.**
A one-line clarifying question is always better than a wrong database write.

### Guardrails on the `update` path

An LLM writing to your database is the single riskiest component here. "Smartly edits" is one bad
match away from "confidently updated the wrong row." Non-negotiables:

1. **Status fields only.** The update path can change `state`. It can never delete a row, overwrite
   a note, or change a price.
2. **Always echo, always reversible.** *"Marked the custom bag as bought for Hala ✓ — reply `undo`."*
3. **Ambiguity asks.** Two plausible matches → show both, let the user pick. Never coin-flip.
4. **Everything is audited.** Every mutation writes to an append-only `audit_log` with before/after
   JSON. This is what makes `undo` possible and what lets you diagnose a bad edit weeks later.

---

## 8. Status model — agreed

Two states on the **item–recipient pair**, not on the item: `still` → `bought`.

Whether "bought" hides something is **policy at read time**, not a schema rule:

```
hide if  state = 'bought'
     AND recipient.kind = 'person'      -- Mom already has it
     AND item.kind      = 'product'     -- a store is never used up
```

An archetype (`Teacher`) or a `store` therefore keeps showing after a purchase, with a badge:
*"bought before — Jun 2026"*. You keep the reuse and avoid the repeat.

**Deferred to M3:** a full `gift_events` history log (who exactly, when, how much, their reaction).
Justified only once you want "what did I give last year." The seam is left open — `state` is derived
from events the day you add them, and nothing already stored is invalidated.

---

## 9. What we deliberately are not building

- Instagram API integration — see §3
- Product extraction from store pages — you'll browse the shop yourself; scraping shops is fragile
  and usually blocked
- Currency conversion — rates go stale, and price is a fact about the day you saw it
- Multi-user anything — `user_id` columns exist as the seam, nothing more
- Item-level sizes — sizes live on the recipient's profile, where they apply to every future item
- Save-date logic — occasion dates matter, save dates don't

---

## 10. Revised roadmap

| | Milestone | Contents |
|---|---|---|
| **M0** | Vertical slice ✅ | Form → SQLite → grid |
| **M1** | Foundation | Postgres, jobs table, worker, Open Graph, recipients, three item kinds, web triage + table |
| **M2** | Bot + parsing | Telegram bot, reply-to correlation, LLM annotation parsing, intent routing, echo/confirm |
| **M3** | Retrieval | Function-calling query translation, filter UI, deep links |
| **M4** | Meaning | Embeddings, inspo semantic search, profile matching, `gift_events` |
| **M5** | Proactive | Occasions, floating dates, cron, staged nudges |
| **M6** | Portfolio | Docker Compose, deploy, README, diagrams, demo |

Note M2 moved ahead of retrieval: **capture before search.** You cannot test retrieval without a
corpus, and you cannot build a corpus without capture. Also — items saved before recipients exist
must be re-tagged by hand, and you will not remember why you saved them. Human judgement is the one
thing that cannot be backfilled.
