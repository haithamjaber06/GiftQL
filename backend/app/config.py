from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "giftlogger.db"
CORS_ORIGINS = ["http://localhost:5173"]