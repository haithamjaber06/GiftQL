# Gift Logger

I see gift ideas everywhere — reels, shops, screenshots — and they vanish into a camera roll I
never open. This saves them, and lets me find them again when someone's birthday comes around.

**A learning project.** The point is to understand how a system is built, not to finish fast.

---

## 👉 Start here: [`BUILD.md`](BUILD.md)

Steps 0–6 are the basics, 7–12 are the real system. You write every line. Each step ends with
something working on screen.

To follow it from the start you need Python and a text editor. Nothing else.

---

## What's in this folder

| | |
|---|---|
| **[`BUILD.md`](BUILD.md)** | **The only file you need right now.** Step-by-step build guide |
| `backend/` | The API — FastAPI, split into `config` / `db` / `schemas` / `scraper` / `routes` |
| `backend/giftlogger.db` | Your data. SQLite makes this for you on first run. Not in git |
| `frontend/` | The page you actually use — React + Vite |
| `docs/` | Design notes. **Reference material, not homework** — see below |

`BUILD.md` builds everything as a single `app.py`, which is the right way to learn it. The split
above came later, once one file stopped being comfortable to read.

## Running it

Two terminals. Backend first:

```powershell
cd backend
..\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then the frontend:

```powershell
cd frontend
npm install
npm run dev
```

The page is at <http://localhost:5173>, the API at <http://127.0.0.1:8000>, and the auto-generated
API docs at <http://127.0.0.1:8000/docs>.

⚠️ Run uvicorn **from inside `backend/`**. The imports are absolute (`from app.config import ...`),
so they only resolve when `backend/` is the working directory.

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

- ✅ 7. Make it look decent
- ✅ 8. Stop it saving duplicates
- ✅ 9. Move the slow web-fetching into the background
- ✅ 10. Add price and occasion
- 11. Let an LLM fill in the fields automatically
- 12. A Telegram bot so you can send links from your phone
