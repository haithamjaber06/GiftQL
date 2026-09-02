import sqlite3
import json
from app.llm import parse_item
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.db import db
from app.schemas import NewItem, ItemUpdate
from app.scraper import normalize, fetch_meta

router = APIRouter(prefix="/api")


# Get Items
def row_to_item(row):
    """Turn a database row into what the API promises: labels as a real list."""
    item = dict(row)
    item["labels"] = json.loads(item["labels"]) if item["labels"] else []
    return item


@router.get("/items")
def list_items():
    with db() as conn:
        rows = conn.execute("SELECT * FROM items ORDER BY id DESC").fetchall()
        return [row_to_item(row) for row in rows]


def enrich(url, item_id):
    title, img_url, page_text = fetch_meta(url)
    parsed = parse_item(url, title, page_text) if page_text else None
    if parsed is None:
        status = "Failed" if img_url is None and title is None else "Partial"
        with db() as conn:
            conn.execute(
                "UPDATE items SET title = ?, raw_title = ?, img_url = ?, status = ? WHERE id = ?",
                (title, title, img_url, status, item_id),
            )
        return
    with db() as conn:
        conn.execute(
            "UPDATE items SET title = ?, raw_title = ?, img_url = ?, status = 'Done', kind = ?, description = ?, labels = ?, currency = ?, price = COALESCE(price, ?) WHERE id = ?",
            (parsed.title or title, 
            title,
            img_url, 
            parsed.kind,
            parsed.description,
            json.dumps(parsed.labels),
            parsed.currency,
            parsed.price,
            item_id),
        )


# Post New Item
@router.post("/items")
def create_item(new: NewItem, back_ground: BackgroundTasks):
    norm = normalize(new.url)
    try:
        with db() as conn:
            cursor = conn.execute(
                "INSERT INTO items (url, person, norm_url, status, occasion, price) VALUES(?, ?, ?, ?, ?, ?)",
                (new.url, new.person, norm, "Pending", new.occasion, new.price),
            )
            item_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Already Saved For This Person")
    
    back_ground.add_task(enrich, new.url, item_id)
    
    with db() as conn:
        row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    return(row_to_item(row))


# Patch Item
@router.patch("/items/{item_id}")
def update_item(item_id: int, patch: ItemUpdate):
    fields = patch.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")

    sets = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [item_id]

    with db() as conn:
        cursor = conn.execute(f"UPDATE items SET {sets} WHERE id = ?", values)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="No Such Item")
        row = conn.execute("SELECT * FROM items WHERE id = ?", (item_id,)).fetchone()
    return row_to_item(row)


# Delete Item
@router.delete("/items/{item_id}")
def delete(item_id: int):
    with db() as conn:
        cursor = conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="No Such Item")
    return {"deleted": item_id}
