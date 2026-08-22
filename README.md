# Gift Logger

I see gift ideas everywhere — reels, shops, screenshots — and they vanish into a camera roll I
never open. This saves them, and lets me find them again when someone's birthday comes around.

**A learning project.** The point is to understand how a system is built, not to finish fast.

---

## 👉 Start here: [`BUILD.md`](BUILD.md)

Six small steps. You write every line. Each step ends with something working on screen.

You need Python and a text editor. Nothing else.

---

## What's in this folder

| | |
|---|---|
| **[`BUILD.md`](BUILD.md)** | **The only file you need right now.** Step-by-step build guide |
| `app.py` | Your app. Doesn't exist yet — you create it in Step 0 |
| `gifts.db` | Your data. SQLite makes this for you in Step 2 |
| `docs/` | Design notes. **Reference material, not homework** — see below |

## About the `docs/` folder

Those are decisions we already made together, written down so you don't have to re-decide them
later. **You do not need to read them to build this.**

Use them like a dictionary, not a textbook:

- Stuck on a word? → [`docs/02-glossary.md`](docs/02-glossary.md)
- "Why did we choose X?" → [`docs/03-why-these-technologies.md`](docs/03-why-these-technologies.md)
- "What was the plan again?" → [`docs/05-spec-v1.md`](docs/05-spec-v1.md)

They'll make far more sense *after* you've hit the problems they describe. That's the intended
order — build first, read when you get stuck.

---

## What the finished thing does

Send a link, a photo, or a typed thought to a bot. It works out what the thing is, what it costs,
and roughly what it's about. You say who it's for. Later you ask *"gift ideas for my Gf for our
anniversary"* and get a filtered list back.

That's the destination. `BUILD.md` is the road.

## Where it's going after the basics

Rough order, one at a time, each its own sitting:

7. Make it look decent
8. Stop it saving duplicates
9. Move the slow web-fetching into the background
10. Add price and occasion
11. Let an LLM fill in the fields automatically
12. A Telegram bot so you can send links from your phone
