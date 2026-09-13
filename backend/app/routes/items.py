import traceback

import psycopg
from psycopg.types.json import Json
from fastapi import APIRouter, HTTPException, BackgroundTasks

from app.llm import parse_item
from app.db import db
from app.schemas import NewItem, ItemUpdate
from app.scraper import normalize, fetch_meta

router = APIRouter(prefix="/api")


def row_to_item(row):
    return dict(row)


@router.get("/items")
def list_items():
    with db() as conn:
        rows = conn.execute("SELECT * FROM items ORDER BY id DESC").fetchall()
        return [row_to_item(row) for row in rows]


def enrich(url, item_id):
    try:
        title, img_url, page_text = fetch_meta(url)
        parsed = parse_item(url, title, page_text) if page_text else None

        if parsed is None:
            status = "Failed" if img_url is None and title is None else "Partial"
            with db() as conn:
                conn.execute(
                    "UPDATE items SET title = %s, raw_title = %s, img_url = %s, status = %s WHERE id = %s",
                    (title, title, img_url, status, item_id),
                )
            return

        with db() as conn:
            conn.execute(
                """UPDATE items
                   SET title = %s, raw_title = %s, img_url = %s, status = 'Done',
                       kind = %s, description = %s, labels = %s, currency = %s,
                       price = COALESCE(price, %s)
                   WHERE id = %s""",
                (parsed.title or title,
                 title,
                 img_url,
                 parsed.kind,
                 parsed.description,
                 Json(parsed.labels),
                 parsed.currency,
                 parsed.price,
                 item_id),
            )
    except Exception:
        traceback.print_exc()
        try:
            with db() as conn:
                conn.execute(
                    "UPDATE items SET status = 'Failed' WHERE id = %s", (item_id,)
                )
        except Exception:
            traceback.print_exc()


@router.post("/items")
def create_item(new: NewItem, back_ground: BackgroundTasks):
    norm = normalize(new.url)
    try:
        with db() as conn:
            row = conn.execute(
                """INSERT INTO items (url, person, norm_url, status, occasion, price)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   RETURNING *""",
                (new.url, new.person, norm, "Pending", new.occasion, new.price),
            ).fetchone()
    except psycopg.errors.UniqueViolation:
        raise HTTPException(status_code=409, detail="Already Saved For This Person")

    back_ground.add_task(enrich, new.url, row["id"])
    return row_to_item(row)


@router.patch("/items/{item_id}")
def update_item(item_id: int, patch: ItemUpdate):
    fields = patch.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    sets = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [item_id]

    with db() as conn:
        old = conn.execute("SELECT * FROM items WHERE id = %s", (item_id,)).fetchone()
        if old is None:
            raise HTTPException(status_code=404, detail="No Such Item")

        row = conn.execute(
            f"UPDATE items SET {sets} WHERE id = %s RETURNING *", values
        ).fetchone()

        for field, new_value in fields.items():
            conn.execute(
                """INSERT INTO corrections (item_id, field, llm_value, user_value)
                   VALUES (%s, %s, %s, %s)""",
                (item_id, field, str(old[field]), str(new_value)),
            )

    return row_to_item(row)


@router.delete("/items/{item_id}")
def delete(item_id: int):
    with db() as conn:
        cursor = conn.execute("DELETE FROM items WHERE id = %s", (item_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="No Such Item")
    return {"deleted": item_id}