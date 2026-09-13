from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.auth import require_api_key
from app.config import CORS_ORIGINS
from app.db import pool, db
from app.routes import items

@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    pool.wait()      # fail loudly at startup if the database is unreachable
    yield            # ---- app runs here ----
    pool.close()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items.router, dependencies=[Depends(require_api_key)])

@app.get("/health")
def health():
    with db() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}