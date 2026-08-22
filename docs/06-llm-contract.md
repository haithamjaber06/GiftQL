# The LLM contract

> Haitham's answer to "what's the one thing that would make this pointless if it didn't work":
>
> *"The simplicity intended by the LLM… the user should only send the idea with a name and an
> occasion. If everything becomes reliant on the user the whole project becomes useless."*
>
> That's the innovation token. This document is what spending it responsibly looks like.

---

## 1. The dividing line

The cleanest statement of the product:

> **The human supplies only what the human alone knows. The LLM derives everything else.**

| Only the human knows | The LLM can derive |
|---|---|
| Who it's for | Type (idea / product / store / inspo) |
| What occasion | Title |
| Why they saved it (the note) | Description |
| Whether they bought it | Price / price range, currency |
| | Store or reference |
| | Labels (for inspo) |
| | Image |

The annotation line therefore reduces to its floor: **`Dad - Birthday`**. Two words. And with
recipient inference (§5), often nothing at all.

Everything below follows from taking that line seriously.

---

## 2. Consequences of betting the product on a model

If the LLM *is* the product, then its accuracy *is* the reliability of the product. Three rules
follow, and none of them are optional.

### Rule 1 — Measure it, from the first save

You cannot improve, or honestly describe, something you don't measure. Every parse is logged;
every correction you make becomes a labelled test case for free. See §6.

### Rule 2 — Wrong-and-visible is survivable. Wrong-and-invisible is fatal.

When the model can't determine a field it must **leave it null and say so**, never quietly guess.
One confidently wrong price that you don't notice costs more faith than ten honest nulls. Design
target: the system is allowed to be uncertain out loud, never certain and wrong in silence.

### Rule 3 — Correction must be cheaper than prevention

If fixing a bad parse takes more than one tap, you'll start pre-empting it by typing full
captions — and you're back to the thing you said makes the project useless. **Every echo message
must be one reply away from being corrected.**

```
Saved ✓  Product · "Custom leather tote"
         Dad · Birthday · 18–25 JOD
         reply:  1 wrong person   2 wrong occasion   3 wrong price   4 all wrong
```

---

## 3. The complete field spec

Every field, and who is responsible for it.

| Field | Filled by | Nullable | Notes |
|---|---|---|---|
| `kind` | LLM | no | `idea` · `product` · `store` · `inspo`. Defaults to `product` |
| `title` | LLM | no | Product name · store name · a vibe title for a room · the idea itself |
| `description` | LLM | yes | |
| `source_url` | system | **yes** | Null for plain-text ideas and for photos |
| `content_hash` | system | yes | Idempotency key when there's no URL — see §4 |
| `image_path` | system / LLM | yes | For photos, the image *is* the source |
| `labels` | LLM | yes | `{Room, Desk, Lighting, Warm}` — the only route back to `inspo` |
| `price_min` / `price_max` | LLM | yes | `numeric(14,3)`. Equal values = a single price |
| `currency` | LLM | no | Defaults `JOD`. Kept because "occasionally others" |
| `recipient` | **human**, LLM may suggest | yes | Via `item_recipients` |
| `occasion` | **human**, LLM may suggest | yes | |
| `note` | human **or** LLM if asked | yes | Provenance recorded either way |
| `state` (bought) | **human** | no | On the item–recipient pair, not the item |
| `process_state` | system | no | `needs_triage` on arrival |

### Type definitions

| `kind` | What it is | Reference | Price | Recipient | "Bought" applies? |
|---|---|---|---|---|---|
| `product` | one specific thing | a link | single value | yes | **yes, once** |
| `store` | a shop you'll return to | a link or a name | **a range** | usually | **no** — never used up |
| `idea` | a thought with no link | none | optional | yes | yes |
| `inspo` | a room, desk, outfit | image or link | usually null | **null** | no |

`store` is back as its own type — confirmed. Ticking "bought" on a shop you'll use ten more times
is a category error, and the only clean way to prevent it is at the type level.

### Two corrections to the homework's field list

**Labels were missing.** Story six says the LLM "adds labels describing it," but the field list had
nowhere to put them. Inspo has no recipient and no occasion, so labels plus embeddings are the
*only* way to find it again. Without the column, that story has no output.

**"Bought: checkbox" is a UI control, not a schema decision.** The screen shows a checkbox; the
storage is `item_recipients.state`, because the same candle can be bought for one teacher and still
open for the next.

> **Rule: UI representation ≠ storage representation.** Letting a widget dictate your schema is how
> you end up unable to express something you later need. Model the domain; render it however you like.

---

## 4. Items without URLs

Two of the homework stories — *send a photo*, *send plain text* — produce items with **no URL**.
Our idempotency key was `url_canonical`, so those items have no duplicate protection at all: send
the same photo twice, get two rows, with no error.

**Fix: content hashing.** Run the image bytes (or the normalised text) through SHA-256 and use the
result as the key. Identical input, identical hash, upsert instead of duplicate.

```
key = url_canonical  if a URL exists
      sha256(bytes)  otherwise
```

**Known limit, worth stating honestly:** a byte hash only catches *identical* files. Re-screenshot
the same room and you get a different hash. Catching visually-similar duplicates needs a
**perceptual hash** (a fingerprint robust to resizing and recompression) — a fine M5 addition, and
not worth building before you've felt the problem.

---

## 5. Recipient inference — what makes "send nothing" real

Your stated floor was `Dad - Birthday`. This is how it becomes *just send the link*.

**The idea:** after enough saves, your own history predicts the recipient. Twelve woodworking
things tagged Dad means a new woodworking item is probably for Dad.

**M2 version (no embeddings).** Overlap of labels and keywords against each recipient's past items.
Crude, cheap, works surprisingly well once there are ~20 items per recipient.

**M4 version (embeddings).** Embed the new item; compare against the **centroid** — the average
vector — of each recipient's past items. Nearest centroid wins.

**Guardrails, which matter more than the method:**

1. **Cold start: don't guess.** Below ~10 items for a recipient there's nothing to learn from.
   Leave it null.
2. **Require a margin, not just a score.** If Dad scores 0.71 and Big Sis 0.69, the model has not
   identified a recipient — it has found two. **Ask instead of picking.** A near-tie is information,
   and treating it as an answer is how you get confident wrong output.
3. **Always `source='llm_suggested'`.** Never indistinguishable from your own choice.
4. **Always one tap to change.** Per Rule 3.
5. **Occasion is guessed from the calendar, not the content.** If the item is tagged Gf and your
   anniversary is in three weeks, that's a reasonable suggestion. Nothing about a leather bag
   implies "anniversary" — don't pretend otherwise.

---

## 6. Measuring accuracy

You said yes to logging corrections. This is the highest-value-per-line-of-code thing in the whole
project, so it's worth doing properly.

### The mechanism

Every time you fix a field the LLM filled, write a row:

```sql
corrections (id, item_id, field, llm_value, user_value, corrected_at, message_id)
```

That's it. Ten lines of code, and it produces three things:

**1. A real accuracy number.**
`field accuracy = 1 − (corrections on that field ÷ times the LLM filled that field)`
You'll find `title` is ~95% and `price` is ~60%, which tells you exactly where to spend effort.

**2. A regression test set, for free.** Every correction is a labelled example: *this input should
have produced that output.* Change a prompt, replay them, see whether you improved things or broke
them. Without this, prompt engineering is superstition — you change wording, it feels better, you
have no idea.

**3. The strongest single line in your README.** *"Field-level parse accuracy: 87% across 143 real
saves (title 96%, price 61%, type 92%)."* Almost no portfolio project reports a number about its own
AI. Most just assert that it works.

### The methodological caveat — state this openly

**You only correct what you notice.** So this metric measures *noticed* errors and systematically
undercounts. A quietly wrong description you never read is invisible to it.

The honest fix is a **golden set**: once you have ~100 items, hand-label 30 of them properly and
measure against that. Two hours of work, and it converts a soft number into a defensible one.

Naming a limitation in your own evaluation, then addressing it, reads as far more competent than a
confident unqualified figure. Most people never notice the problem exists.

---

## 7. Ranking — recency, but not naïvely

Your instinct was *"latest first, because they most likely suit him best as time progresses."*
Partly right, for a stronger reason than the one you gave: **link rot.** An 18-month-old shop link
is often dead, out of stock, or a deleted account. Recency correlates with *availability*.

But pure recency sorting has a failure mode worth naming:

> **The graveyard problem.** Anything below the fold is never seen again, so the system becomes a
> write-only log — you keep feeding it, it keeps showing you the last ten things. And unlike a news
> feed, **a gift idea doesn't expire.** A great idea from fourteen months ago is still great.

So recency is a **decay factor**, not a sort key:

```
final = base_score × 1 / (1 + age_months × 0.05)
```

At 12 months an item retains ~63% of its score — demoted, not buried. The `0.05` is a guess; tune
it once you have real data, and say so.

Two additions that fix the graveyard directly:

- **An "from the archive" row** on the results page: 3 high-scoring items older than 6 months.
  Deliberately robbing the graveyard.
- **A link-check job** (M5): periodically HEAD the URLs, flag dead ones. Then old items are demoted
  because they're *actually* dead, not because they're old — which is the honest version of your
  original instinct.

### Grouping — confirmed

`Dad` is the group; **occasion** is the sub-grouping inside it.

```
DAD
  ├─ Birthday        (7 items)
  ├─ Father's Day    (3)
  └─ No occasion     (12)
```

Within each group, decayed score descending.

---

## 8. The user stories that were missing

The homework listed six stories, all about ingestion. These are the ones that decide whether you're
still using this in month three:

**Correction**
- A user can fix a field the LLM got wrong in one tap.
- A user can change who an item is for after saving it.
- A user can undo the last change the LLM made.

**Management**
- A user can see everything still in triage (arrived but not understood).
- A user can mark something bought, and it stops being suggested for that person.
- A user can delete something.

**Retrieval**
- A user can ask in plain language and see the filters the system inferred.
- A user can adjust those filters directly instead of rephrasing.
- A user can browse everything for one recipient, grouped by occasion.
- A user can search inspo by meaning and by label.

> **Watch for this pattern in yourself.** Six ingestion stories and zero correction stories isn't
> carelessness — it's that ingestion is the interesting part. Almost everyone writes the stories for
> the feature they're excited about and forgets the ones that make it survivable. The boring stories
> are the ones that determine whether the tool gets abandoned.
