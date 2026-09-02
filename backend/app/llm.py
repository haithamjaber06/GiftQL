import instructor

from app.config import LLM_PROVIDER
from app.schemas import ItemParse

_client = None
def get_client():
    global _client
    if _client is None:
        _client = instructor.from_provider(LLM_PROVIDER)
    return _client

SYSTEM = """You extract structured gift-idea data from web pages.

Rules:
- Fill a field only if the page actually supports it. If you are unsure, use null.
- Never invent or estimate a price. A price must appear on the page for this specific product.
- Titles are the product's real name, not the page's SEO headline.
- You are cataloguing gift ideas, so labels should describe the thing's character, not the website's layout.
"""

def parse_item(url, title, page_text):
    """Ask the model to describe one saved link. Returns an ItemParse, or None."""
    client = get_client()
    prompt = f"""URL: {url}
Page title: {title or "(none found)"}

Page text:
{page_text[:6000]}
"""
    
    try:
        return client.create(
            response_model=ItemParse,
            max_retries=2,
            messages=[
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": prompt},
            ],
        )
    except Exception as e:
        print("LLM parse failed: ", e)
        return None
    

