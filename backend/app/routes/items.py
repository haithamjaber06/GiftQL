import sqlite3
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.db import db
from app.schemas import NewItem, ItemUpdate
from app.scraper import normalize, fetch_meta

router = APIRouter(prefix="/api")


#Get Items
@router.get("/items")
def list_items():
    with db() as conn:
        rows = conn.execute("SELECT * FROM items ORDER BY id DESC").fetchall()
        return [dict(row) for row in rows]

    
def enrich(url, item_id):
    title, img_url = fetch_meta(url)
    status = "Failed" if img_url is None and title is None else "Done"
    with db() as conn:
        conn.execute(
            "UPDATE items SET title = ?, img_url = ?, status = ? WHERE id = ?", 
                    (title, img_url, status, item_id)
        )        
#Post New Item
@router.post("/items")
def create_item(new: NewItem, back_ground: BackgroundTasks):
    norm = normalize(new.url)
    try:
        with db() as conn:
            cursor = conn.execute(
                "INSERT INTO items (url, person, norm_url, status, occasion, price) VALUES(?, ?, ?, ?, ?, ?)",
                    (new.url, new.person, norm, "Pending", new.occasion, new.price)
            )
            item_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Already Saved For This Person")
    back_ground.add_task(enrich, new.url, item_id)
    return {
        "title": None,
        "img_url": None,
        "id": item_id,
        "url": new.url,
        "person": new.person,
        "norm_url": norm,
        "status": "Pending",
        "occasion": new.occasion,
        "price": new.price
    }
    
#Patch Item
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
    return {"id": item_id, **fields}

#Delete Item
@router.delete("/items/{item_id}")
def delete(item_id: int):
    with db() as conn:
        cursor = conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="No Such Item")
    return {
        "deleted": item_id
    }

