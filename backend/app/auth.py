import hmac

from fastapi import Header, HTTPException

from app.config import API_KEY

def require_api_key(x_api_key: str = Header(default="")):
    if not hmac.compare_digest(x_api_key, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")