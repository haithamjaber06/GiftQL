#Imports
from fastapi import FastAPI, HTTPException, BackgroundTasks
import sqlite3
import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel
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
            status TEXT
        )
    """)

#Migration
with db() as conn:
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(items)")]
    if "status" not in cols:
        conn.execute("ALTER TABLE items ADD COLUMN status TEXT")
        for row in conn.execute("SELECT id FROM items").fetchall():
            conn.execute("UPDATE items SET status = ? WHERE id = ?",
                         ("Done", row["id"]))

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
def home(person: str = ""):
    with db() as conn:
        if person:
            rows = conn.execute(
                "SELECT * FROM items WHERE person = ? ORDER BY id DESC", (person,)
            ).fetchall()
        else:
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
                "INSERT INTO items (url, person, norm_url, status) VALUES(?, ?, ?, ?)",
                    (new.url, new.person, norm, "Pending")
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
        "status": "Pending"
    }
#Delete Item
@app.delete("/api/items/{item_id}")
def delete(item_id: int):
    with db() as conn:
        conn.execute("Delete from items where id= (?) ", (item_id,))
    return {
        "deleted": item_id
    }

