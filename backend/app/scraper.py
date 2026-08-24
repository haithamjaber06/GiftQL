import httpx
from bs4 import BeautifulSoup
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

JUNK = {"utm_source", "utm_medium", "utm_campaign", "utm_term",
        "utm_content", "fbclid", "gclid", "igshid", "ref", "ref_src"}
#Normalize URLs
def normalize(url):
    if "//" not in url:
        url = "https://" + url
    parts = urlsplit(url.strip())
    scheme = "https"
    host = parts.netloc.lower().removeprefix("www.")
    path = parts.path.rstrip("/")
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if k not in JUNK])
    return urlunsplit((scheme, host, path, query, ""))

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
