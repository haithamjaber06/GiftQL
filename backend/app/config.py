from pathlib import Path
from dotenv import load_dotenv

DB_PATH = Path(__file__).resolve().parent.parent / "giftlogger.db"
CORS_ORIGINS = ["http://localhost:5173"]

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

LLM_PROVIDER = "google/gemini-3.5-flash-lite"
