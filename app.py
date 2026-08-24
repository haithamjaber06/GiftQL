#Imports
from fastapi import FastAPI, HTTPException, BackgroundTasks
import sqlite3
import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, field_validator
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

#The database initializing
def db():
    conn = sqlite3.connect("giftlogger.db")
    conn.row_factory = sqlite3.Row
    return conn

JUNK = {"utm_source", "utm_medium", "utm_campaign", "utm_term",
        "utm_content", "fbclid", "gclid", "igshid", "ref", "ref_src"}
#Normalize URLs
def normalize(url):
    parts = urlsplit(url.strip())
    scheme = "https"
    host = parts.netloc.lower().removeprefix("www.")
    path = parts.path.rstrip("/")
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if k not in JUNK])
    return urlunsplit((scheme, host, path, query, ""))

#DB connection establishment
with db() as conn:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id    INTEGER PRIMARY KEY,
            url   TEXT,
            title TEXT,
            person TEXT,
            img_url TEXT,
            norm_url TEXT,
            status TEXT,
            price DECIMAL,
            occasion TEXT
        )
    """)

#Migrations
#Adding "status"
with db() as conn:
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(items)")]
    if "status" not in cols:
        conn.execute("ALTER TABLE items ADD COLUMN status TEXT")
        for row in conn.execute("SELECT id FROM items").fetchall():
            conn.execute("UPDATE items SET status = ? WHERE id = ?",
                         ("Done", row["id"]))
#Adding "price and occasion"
#price is NULL for past values
with db() as conn:
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(items)")]
    if "price" not in cols:
        conn.execute("ALTER TABLE items ADD COLUMN price DECIMAL")
with db() as conn:
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(items)")]
    if "occasion" not in cols:
        conn.execute("ALTER TABLE items ADD COLUMN occasion TEXT")
    
#Unique Index
with db() as conn:
    conn.execute("""CREATE UNIQUE INDEX IF NOT EXISTS uniq_item
                    ON items (norm_url, person)""")

#Title scrapper from webs
def fetch_meta(url):
    try:
        response = httpx.get(url, timeout = 10, follow_redirects=True)
        soup = BeautifulSoup(response.text, "html.parser")

        title, img = None, None

        title_tag = soup.find("meta", property="og:title")
        if title_tag:
            title = title_tag.get("content")
        elif soup.title:
            title = soup.title.string
        
        image_tag = soup.find("meta", property="og:image")
        if image_tag:
            img = image_tag.get("content")
        return title, img
    
    except Exception as e:
        print("Couldn't Fetch: ", e)
        return None, None

#Checks Incoming Data
class NewItem(BaseModel):
    url: str
    person: str = ""
    occasion: str=""
    price: float | None = None
    
    @field_validator("price")
    @classmethod
    def round_price(cls, value):
        return value if value is None else round(value, 2)
class ItemUpdate(BaseModel):
    price: float | None = None
    occasion: str | None = None

    @field_validator("price")
    @classmethod
    def round_price(cls, value):
        return value if value is None else round(value, 2)
#Page Routing
app = FastAPI()
#CORS
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
#Get Items
@app.get("/api/items")
def home():
    with db() as conn:
        rows = conn.execute("SELECT * FROM items ORDER BY id DESC").fetchall()
        return [dict(row) for row in rows]
#Post New Item
def enrich(url, item_id):
    title, img_url = fetch_meta(url)
    status = "Failed" if img_url is None and title is None else "Done"
    with db() as conn:
        conn.execute(
            "UPDATE items SET title = ?, img_url = ?, status = ? WHERE id = ?", 
                    (title, img_url, status, item_id)
        )
@app.post("/api/items")
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
@app.patch("/api/items/{item_id}")
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
@app.delete("/api/items/{item_id}")
def delete(item_id: int):
    with db() as conn:
        cursor = conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="No Such Item")
    return {
        "deleted": item_id
    }

