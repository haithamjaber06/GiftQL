# The recipient model

> This document exists because one sentence from Haitham changed the design:
> *"I'm thinking of a specific person, but it's more like: Friend, Big Sis, Gf, Mom, Dad, Teacher."*
>
> That's not a minor clarification. It reshaped the data model, the capture UX, and the milestone
> order. Worth reading as a case study in why you interrogate requirements before writing schema.

---

## 1. What that sentence actually revealed

My original model had a `people` table: named individuals with birthdays and interests. That was
wrong, or at least premature. You don't think in *names*, you think in **roles**.

And roles come in two genuinely different flavours:

| | **Singular role** | **Generic role (archetype)** |
|---|---|---|
| Examples | Mom, Dad, Big Sis, Gf | Friend, Teacher, Coworker |
| How many people? | Exactly one | Many, interchangeable |
| Can you build a profile? | Yes — interests, sizes, hints | No, they're different humans |
| Does gifting use up the idea? | **Yes** — Mom already has it | **No** — next teacher, same candle |
| What you're storing | Ideas for *this person* | A reusable **stash of safe defaults** |

That last row is the important one. When you tag something "Teacher," you are not recording a gift
for a specific human. You're building a **reusable pool of good-enough-for-this-archetype ideas** —
a thing you draw from repeatedly, forever. That's a different product behaviour from "ideas for Mom,"
and the schema has to express the difference or the feature will feel wrong in a way you can't
articulate.

**Term: archetype** — a role filled by many interchangeable people. **Cardinality** — the technical
word for "how many of a thing." Singular roles have cardinality one; archetypes have cardinality many.

---

## 2. The mistake I nearly made, and the principle that avoids it

The obvious way to handle "does gifting use it up?" is a `status` column on the item, plus an
`is_generic` flag, plus branching logic: *if generic, don't mark gifted.*

That's **baking policy into schema**, and it's a trap. Consider what breaks:

- You give the same candle to two different teachers. One `status` column can't hold both events.
- You change your mind — "actually I don't want to repeat a gift within the same year." The rule
  changed, but you never recorded the *dates*, so you can't apply it retroactively.
- You want to know "what did I actually give people last year?" That history was overwritten.

The principle that fixes all three:

> **Rule: store facts, apply policy at read time.**
> Facts are permanent and objective ("I gave item 47 to Ms. Haddad on 2026-06-12 for £22").
> Policy is your changeable opinion ("don't show me things I've already given"). If you bake policy
> into the schema, changing your mind means a migration and lost data. If you log facts and filter
> at query time, changing your mind means editing one `WHERE` clause.

This is one of the highest-leverage ideas in data modelling and it shows up everywhere. Your future
self will thank you roughly weekly.

**Term: append-only log** — a table you only ever insert into, never update or delete. Facts don't
change; they accumulate. `gift_events` below is append-only.

---

## 3. The schema

Three concepts, deliberately separated:

- **`recipients`** — *who* (roles and people, unified)
- **`item_recipients`** — *candidacy*: "this item is a contender for this recipient" (mutable opinion)
- **`gift_events`** — *history*: "this was actually given" (immutable fact)

```sql
-- ---------------------------------------------------------------- WHO ----
CREATE TABLE recipients (
    id            uuid PRIMARY KEY,
    user_id       uuid NOT NULL,
    label         text NOT NULL,          -- 'Mom', 'Big Sis', 'Teacher'
    kind          text NOT NULL,          -- 'person' | 'archetype'
    relationship  text,                   -- free text: 'mother', 'girlfriend'

    -- Profile: only meaningful for kind='person'. Powers implicit matching.
    profile_notes text,                   -- "loves woodworking, hates clutter,
                                          --  mentioned wanting a good chef's knife"
    interests     text[],
    sizes         jsonb,                  -- {"shirt":"M","shoe":"43","ring":"7"}
    profile_embedding vector(1536),       -- embed(label + notes + interests)
    profile_embedding_version int,

    -- Budget expectations differ enormously by role. Teacher ≠ Gf.
    budget_min_cents int,
    budget_max_cents int,

    sort_order    int DEFAULT 0,          -- pin frequent ones to the top of the picker
    archived      bool DEFAULT false,     -- soft delete; never lose gift history
    created_at    timestamptz DEFAULT now(),
    UNIQUE (user_id, label)
);

-- ------------------------------------------------------- CANDIDACY -------
-- "I think this item might suit this recipient." An opinion. Mutable.
CREATE TABLE item_recipients (
    item_id      uuid REFERENCES items(id) ON DELETE CASCADE,
    recipient_id uuid REFERENCES recipients(id) ON DELETE CASCADE,
    state        text NOT NULL DEFAULT 'candidate',
                 -- candidate | shortlisted | rejected
    source       text NOT NULL DEFAULT 'manual',
                 -- manual | llm_suggested   <-- keeps AI guesses honest & auditable
    confidence   real,                    -- only set when source='llm_suggested'
    note         text,
    created_at   timestamptz DEFAULT now(),
    PRIMARY KEY (item_id, recipient_id)
);
CREATE INDEX ON item_recipients (recipient_id, state);

-- --------------------------------------------------------- HISTORY -------
-- "I actually gave this." A fact. Append-only. Never updated.
CREATE TABLE gift_events (
    id             uuid PRIMARY KEY,
    user_id        uuid NOT NULL,
    item_id        uuid REFERENCES items(id),
    recipient_id   uuid REFERENCES recipients(id),
    given_to_name  text,          -- for archetypes: 'Ms. Haddad'. NULL for singular roles.
    occasion_id    uuid REFERENCES occasions(id),
    given_on       date NOT NULL,
    price_paid_cents int,
    reaction       text,          -- 'loved it' / 'polite smile' — future-you will want this
    created_at     timestamptz DEFAULT now()
);
CREATE INDEX ON gift_events (recipient_id, given_on DESC);

-- -------------------------------------------------------- OCCASIONS ------
CREATE TABLE occasions (
    id             uuid PRIMARY KEY,
    user_id        uuid NOT NULL,
    recipient_id   uuid REFERENCES recipients(id),  -- NULL = applies to everyone
    name           text NOT NULL,        -- 'Birthday', "Mother's Day", 'Anniversary'
    date_kind      text NOT NULL,        -- 'fixed_annual' | 'floating_annual' | 'one_off'
    month          int, day int,         -- fixed_annual: Nov 3
    rule           text,                 -- floating_annual: 'second sunday of may'
    on_date        date,                 -- one_off
    lead_time_days int DEFAULT 21,       -- start nudging this far ahead
    active         bool DEFAULT true
);
```

### Design notes worth defending

**`recipients` is one table, not two.** Roles and people share every field that matters; `kind`
carries the difference. Two tables would mean every query is a `UNION` and every foreign key has to
choose a side. **Term: polymorphic association** — a foreign key that could point at one of several
tables. It's usually a smell; a single table with a `kind` column is almost always cleaner.

**`source` on `item_recipients`.** When the LLM guesses "this suits Dad," that guess is stored
*separately in kind* from your explicit choice, and it's labelled. This means the UI can show AI
suggestions as suggestions, you can measure how often it's right, and a bad prompt can be undone
with one `DELETE WHERE source='llm_suggested'`. Never let generated data be indistinguishable from
user-entered data — this is a rule with no exceptions.

**`archived`, not `DELETE`.** **Soft delete** — mark it hidden instead of removing it. If your
girlfriend changes, you archive that recipient; the gift history stays intact and doesn't leave
dangling references. Deleting rows that other rows point at is how you get orphaned data.

**`reaction` on gift_events.** Costs one column, and in three years it's the most interesting data
in your database. Cheap fields that capture outcomes are almost always worth adding.

**Floating dates are a real problem.** Mother's Day is "the second Sunday in May" — not a fixed
date. Store the *rule*, compute the date per year. Storing `2026-05-10` means it's silently wrong
in 2027. This is a classic beginner bug; date handling punishes assumptions harder than almost
anything else in programming.

---

## 4. Policy, expressed as queries

With facts logged, all the behaviour you asked for becomes read-time logic.

**"Used up" rule — depends on recipient type, exactly as you specified:**

```sql
-- Exclude an item only if it was given to THIS specific person.
-- Archetypes never exclude; you just see a badge.
AND NOT EXISTS (
    SELECT 1 FROM gift_events g
    JOIN recipients r ON r.id = g.recipient_id
    WHERE g.item_id = i.id
      AND g.recipient_id = :recipient_id
      AND r.kind = 'person'
)
```

For archetypes, run the same lookup but *display* rather than filter:
`"⚠ you gave this to Ms. Haddad, June 2026"`. You keep the reuse *and* avoid the embarrassment.
That's a better product than either extreme, and it costs one join.

**Should the policy change later** — "don't repeat within 12 months, even for archetypes" — it's
one extra `AND g.given_on > now() - interval '12 months'`. No migration. That's the payoff.

---

## 5. Retrieval: "gift ideas for Mom"

Now a blend of four signals. Notice each one is a different *kind* of knowledge:

```
score =  1.0 × explicit      -- I tagged this to Mom            (my past judgement)
       + 0.7 × profile_sim   -- matches Mom's interests/notes   (inferred, never tagged)
       + 0.5 × query_sim     -- matches what I just typed       (current intent)
       + 0.2 × archetype_fit -- generic ideas for her role type (fallback pool)
       - penalties           -- outside budget, wrong occasion
filtered by the "used up" rule above
```

Signal 2 is the one that makes this feel like magic rather than a spreadsheet. You saved a walnut
serving board eight months ago thinking "nice." Mom's profile says *"loves hosting, into natural
materials."* You never tagged them to each other — the embedding comparison finds it anyway. **That
is the entire justification for the embedding infrastructure**, and it only works because you agreed
to store profiles.

**The `archetype_fit` term** deserves a note: it's how "Friend" ideas surface as weak candidates for
"Big Sis" when your explicit pool is thin. Low weight, but it means the system is never empty-handed.

All four weights are guesses. Tune them once you have real data, and say so in the README — stating
that a heuristic is unvalidated is a strength, not an admission.

---

## 6. Occasions and nudges

You asked for proactive surfacing. The mechanism:

```
Daily scheduled job (cron)
  → resolve each active occasion to a concrete date for this year
      (fixed: month/day · floating: evaluate the rule · one_off: as stored)
  → find occasions where 0 < days_until <= lead_time_days
  → for each, run the "gift ideas for X" query, take top 5
  → send one digest (email / Instagram DM / push)
  → record that it was sent, so it doesn't repeat daily for three weeks
```

**Term: cron** — a scheduler that runs a job on a time pattern. `0 8 * * *` = 8am daily.

Two design points that matter more than they look:

**Idempotency again.** Without a `nudges_sent` record, this job fires every single day for 21 days
and you'll mute it by week one. A `UNIQUE (occasion_id, year, stage)` row is the whole fix.
This is the same idempotency principle from ingestion, in a completely different context — which is
exactly how you know it's a real principle and not a detail.

**Staged nudges beat one alert.** Sensible default: **21 days out** ("start thinking — here are 5
ideas"), **7 days out** ("order now if shipping"), **1 day out** ("last chance"). Different lead
times suit different roles, which is why `lead_time_days` sits on the occasion, not in code.

**Prefill it.** Mother's Day, Father's Day, Valentine's, Teacher's Day, Christmas/Eid are known
dates. Seed them on setup rather than making the user enter them. The best data entry is none.

---

## 7. Capture UX — where the real win is

10–30 labels, growing. That's small enough that **tagging at save time is realistic**, and this
matters more than any query optimisation, because:

> Retrieval quality is capped by capture quality. An item saved with a recipient and a five-word
> note is worth ten items saved bare. Every second you shave off tagging compounds forever.

**In the Instagram DM flow** (M5), the reply becomes:

```
Saved ✓  "Walnut serving board — £45"
Who's it for?
  1 Mom   2 Dad   3 Big Sis   4 Gf   5 Friend   6 Teacher
  (or type a name · reply 0 to skip)
```

You tap one character. Sub-two-second capture, and it happens at the exact moment the context is
still in your head — which is the only moment you actually know why you saved it.

**Ordering matters:** show the 6 most-used labels first (`sort_order` + recent usage), with typing
as fallback. At 30 labels a raw alphabetical list is friction; a frequency-ranked shortlist is not.
**Term: typeahead / autocomplete** — filtering a list as you type. Needed above ~10 options.

**Let the LLM pre-select.** During enrichment it can guess the recipient and write it in with
`source='llm_suggested'`. Then the DM reply is *"Saved for Dad ✓ — reply to change"*: correct by
default, one tap to fix, zero taps when it's right. Because guesses are labelled in the schema, this
is safe to do.

---

## 8. What this changed about the plan

Recipients moved **from M3 to M1**. Reasoning: the table is small and cheap, it transforms capture
UX, and — critically — **every item you save before recipients exist is an item you'll have to
re-tag by hand later.** Backfilling human judgement is impossible; you won't remember. Data model
decisions that affect *capture* should always come before ones that affect *retrieval*.

Revised roadmap:

| | Milestone | Contents |
|---|---|---|
| **M0** | Vertical slice ✅ | Form → SQLite → grid |
| **M1** | Foundation | Postgres, jobs table, worker, Open Graph, **recipients + tagging UI** |
| **M2** | Intelligence | LLM enrichment, embeddings, pgvector, semantic search |
| **M3** | Personalisation | Profiles + embeddings, gift_events, the four-signal ranking |
| **M4** | Proactive | Occasions, floating-date resolution, cron, staged nudges |
| **M5** | Instagram | Business account, Meta app, webhook, DM quick-reply flow |
| **M6** | Portfolio | Docker Compose, deploy, README, diagrams, demo GIF |

---

## 9. The transferable lesson

You gave one sentence of clarification. It changed a table, split a concept in two, introduced an
append-only log, reordered the roadmap, and unlocked the best feature in the product (one-tap DM
tagging).

That's not unusual — that's what requirements gathering *is*. The reason system designers ask
irritatingly specific questions before writing schema is that this happens every time, and the cost
of discovering it after you've stored 400 items is brutal.

> **Rule: interrogate the nouns.** When a user says "people," find out whether they mean people,
> roles, groups, or accounts. When they say "gift," find out whether it's a plan, a purchase, or an
> event. Half of all bad data models are one noun that quietly meant two things.
