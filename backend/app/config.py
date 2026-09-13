import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")
DATABASE_URL = os.environ["DATABASE_URL"]
CORS_ORIGINS = ["http://localhost:5173"]
LLM_PROVIDER = "google/gemini-3.5-flash-lite"