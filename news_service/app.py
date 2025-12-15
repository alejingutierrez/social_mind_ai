import logging
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse, urlunparse

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

NEWS_API_URL = os.environ.get("NEWS_API_URL", "https://newsapi.org/v2/everything")
DEFAULT_PAGE_SIZE = 10
DEFAULT_SORT = os.environ.get("NEWS_API_SORT_BY", "publishedAt")
GNEWS_API_URL = os.environ.get("GNEWS_API_URL", "https://gnews.io/api/v4/search")
GNEWS_MAX_RESULTS = int(os.environ.get("GNEWS_MAX_RESULTS", str(DEFAULT_PAGE_SIZE)))
NEWSDATA_API_URL = os.environ.get("NEWSDATA_API_URL", "https://newsdata.io/api/1/latest")
NEWSDATA_MAX_RESULTS = int(os.environ.get("NEWSDATA_MAX_RESULTS", str(DEFAULT_PAGE_SIZE)))
WORLDNEWS_API_URL = os.environ.get("WORLDNEWS_API_URL", "https://api.worldnewsapi.com/search-news")
WORLDNEWS_MAX_RESULTS = int(os.environ.get("WORLDNEWS_MAX_RESULTS", str(DEFAULT_PAGE_SIZE)))
GUARDIAN_API_URL = os.environ.get("GUARDIAN_API_URL", "https://content.guardianapis.com/search")
GUARDIAN_MAX_RESULTS = int(os.environ.get("GUARDIAN_MAX_RESULTS", str(DEFAULT_PAGE_SIZE)))
NEWS_DB_PATH = os.environ.get("NEWS_DB_PATH", "/data/news.db")
NYT_API_URL = os.environ.get("NYT_API_URL", "https://api.nytimes.com/svc/search/v2/articlesearch.json")
NYT_API_KEY = os.environ.get("NYT_API_KEY")

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="News Proxy API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Source(BaseModel):
    id: Optional[str]
    name: Optional[str]


class Article(BaseModel):
    source: Source
    author: Optional[str]
    title: Optional[str]
    description: Optional[str]
    url: Optional[str]
    urlToImage: Optional[str]
    publishedAt: Optional[str]
    content: Optional[str]
    category: Optional[str] = None


class NewsResponse(BaseModel):
    term: str
    total_results: int
    articles: List[Article]


class StoredArticle(Article):
    term: Optional[str] = None
    saved_at: str


class ArchiveResponse(BaseModel):
    total: int
    articles: List[StoredArticle]


class ArchiveFacet(BaseModel):
    value: str
    count: int


class ArchiveMeta(BaseModel):
    sources: List[ArchiveFacet]
    categories: List[ArchiveFacet]


def normalize_url(raw_url: Optional[str]) -> Optional[str]:
    if not raw_url:
        return None
    parsed = urlparse(raw_url)
    cleaned = parsed._replace(query="", fragment="")
    return urlunparse(cleaned)


def hostname_from_url(raw_url: Optional[str]) -> Optional[str]:
    if not raw_url:
        return None
    parsed = urlparse(raw_url)
    host = parsed.hostname or ""
    if host.startswith("www."):
        host = host[4:]
    return host or None


def extract_category(article: Dict[str, Any]) -> Optional[str]:
    candidates = [
        article.get("category"),
        article.get("categories"),
        article.get("sectionName"),
        article.get("section_name"),
        article.get("section"),
    ]
    for candidate in candidates:
        if isinstance(candidate, list):
            for item in candidate:
                if item:
                    return str(item)
        elif isinstance(candidate, str):
            text = candidate.strip()
            if text:
                return text
    return None


def parse_datetime_to_timestamp(raw: Optional[str]) -> float:
    if not raw:
        return 0.0
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
    except Exception:
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).timestamp()
        except Exception:
            continue
    return 0.0


def get_db_connection() -> sqlite3.Connection:
    dirpath = os.path.dirname(NEWS_DB_PATH) or "."
    os.makedirs(dirpath, exist_ok=True)
    conn = sqlite3.connect(NEWS_DB_PATH, check_same_thread=False)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS news_archive (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            normalized_url TEXT NOT NULL UNIQUE,
            url TEXT,
            source_name TEXT,
            source_id TEXT,
            author TEXT,
            title TEXT,
            description TEXT,
            url_to_image TEXT,
            published_at TEXT,
            content TEXT,
            category TEXT,
            term TEXT,
            language TEXT,
            saved_at TEXT NOT NULL
        );
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_news_archive_pub ON news_archive(published_at DESC, saved_at DESC);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_news_archive_source ON news_archive(source_name);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_news_archive_category ON news_archive(category);")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_news_archive_text ON news_archive(title, description, content);")
    conn.commit()
    return conn


db_conn = get_db_connection()


def normalize_article(article: Dict[str, Any]) -> Dict[str, Any]:
    source_raw = article.get("source") or {}
    source = source_raw if isinstance(source_raw, dict) else {"name": str(source_raw)}
    fallback_host = hostname_from_url(article.get("url"))
    source_name = source.get("name") or fallback_host
    source_id = source.get("id") or fallback_host
    category = extract_category(article)
    return {
        "source": {"id": source_id, "name": source_name},
        "author": article.get("author"),
        "title": article.get("title"),
        "description": article.get("description"),
        "url": article.get("url"),
        "urlToImage": article.get("urlToImage") or article.get("image"),
        "publishedAt": article.get("publishedAt") or article.get("published_at"),
        "content": article.get("content"),
        "category": category,
    }


def deduplicate_articles(articles: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen_urls: set[str] = set()
    deduped: List[Dict[str, Any]] = []
    for article in articles:
        normalized_url = normalize_url(article.get("url"))
        if normalized_url:
            if normalized_url in seen_urls:
                continue
            seen_urls.add(normalized_url)
        deduped.append(article)
    return deduped


def fetch_newsapi_articles(term: str, language: Optional[str]) -> List[Dict[str, Any]]:
    api_key = os.environ.get("NEWS_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="NEWS_API_KEY is not configured")

    params: Dict[str, Any] = {
        "q": term,
        "pageSize": DEFAULT_PAGE_SIZE,
        "sortBy": DEFAULT_SORT,
        "apiKey": api_key,
    }
    if language:
        params["language"] = language

    headers = {
        "X-Api-Key": api_key,
        "Authorization": api_key,
    }

    try:
        response = requests.get(NEWS_API_URL, params=params, headers=headers, timeout=30)
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach NewsAPI: {exc}") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    payload = response.json()
    if payload.get("status") != "ok":
        raise HTTPException(status_code=502, detail=payload.get("message", "NewsAPI error"))

    raw_articles: List[Dict[str, Any]] = payload.get("articles", [])
    normalized: List[Dict[str, Any]] = []
    for article in raw_articles[:DEFAULT_PAGE_SIZE]:
        normalized.append(normalize_article(article))
    return normalized


def _gnews_limit_reached(response: requests.Response) -> bool:
    if response.status_code == 429:
        return True
    try:
        payload = response.json()
    except ValueError:
        return False
    errors = payload.get("errors") or []
    message = payload.get("message") or payload.get("error")
    texts = errors if isinstance(errors, list) else [errors]
    if message:
        texts.append(message)
    return any("limit" in str(text).lower() for text in texts)


def fetch_gnews_articles(term: str, language: Optional[str]) -> List[Dict[str, Any]]:
    api_key = os.environ.get("GNEWS_API_KEY")
    if not api_key:
        logger.info("GNews API key not configured; skipping GNews fetch.")
        return []

    params: Dict[str, Any] = {
        "q": term,
        "max": GNEWS_MAX_RESULTS,
        "apikey": api_key,
    }
    if language:
        params["lang"] = language

    headers = {
        "X-Api-Key": api_key,
    }

    try:
        response = requests.get(GNEWS_API_URL, params=params, headers=headers, timeout=30)
    except requests.RequestException as exc:
        logger.warning("GNews request failed: %s", exc)
        return []

    if _gnews_limit_reached(response):
        logger.warning("GNews daily cap reached; skipping GNews results until quota resets.")
        return []

    if response.status_code != 200:
        logger.warning("GNews responded with %s: %s", response.status_code, response.text)
        return []

    try:
        payload = response.json()
    except ValueError:
        logger.warning("GNews returned a non-JSON payload; skipping results.")
        return []

    raw_articles: List[Dict[str, Any]] = payload.get("articles", []) or []
    normalized = [
        normalize_article({**article, "urlToImage": article.get("image")})
        for article in raw_articles[:GNEWS_MAX_RESULTS]
    ]
    return normalized


def _newsdata_limit_reached(response: requests.Response, payload: Dict[str, Any]) -> bool:
    if response.status_code == 429:
        return True
    status = str(payload.get("status", "")).lower()
    message = str(payload.get("message", "")).lower()
    code = str(payload.get("code", "")).lower()
    return "limit" in message or "rate" in message or status == "rate limit exceeded" or code in {"429", "rate limit exceeded"}


def fetch_newsdata_articles(term: str, language: Optional[str]) -> List[Dict[str, Any]]:
    api_key = os.environ.get("NEWSDATA_API_KEY")
    if not api_key:
        logger.info("NewsData.io API key not configured; skipping NewsData.io fetch.")
        return []

    params: Dict[str, Any] = {
        "apikey": api_key,
        "q": term,
        "size": NEWSDATA_MAX_RESULTS,
    }
    if language:
        params["language"] = language

    headers = {
        "X-ACCESS-KEY": api_key,
    }

    try:
        response = requests.get(NEWSDATA_API_URL, params=params, headers=headers, timeout=30)
    except requests.RequestException as exc:
        logger.warning("NewsData.io request failed: %s", exc)
        return []

    try:
        payload = response.json()
    except ValueError:
        logger.warning("NewsData.io returned a non-JSON payload; skipping results.")
        return []

    if response.status_code != 200 or payload.get("status") != "success":
        if _newsdata_limit_reached(response, payload):
            logger.warning("NewsData.io rate limit reached; skipping until quota resets.")
        else:
            logger.warning("NewsData.io responded with %s: %s", response.status_code, payload)
        return []

    raw_articles: List[Dict[str, Any]] = payload.get("results", []) or []
    normalized: List[Dict[str, Any]] = []
    for article in raw_articles[:NEWSDATA_MAX_RESULTS]:
        creator = article.get("creator")
        if isinstance(creator, list):
            creator = ", ".join([str(item) for item in creator if item]) or None
        normalized.append(
            normalize_article(
                {
                    "source": {"id": article.get("source_id"), "name": article.get("source_name")},
                    "author": creator,
                    "title": article.get("title"),
                    "description": article.get("description"),
                    "url": article.get("link"),
                    "urlToImage": article.get("image_url"),
                    "publishedAt": article.get("pubDate"),
                    "content": article.get("content"),
                    "category": article.get("category"),
                }
            )
        )
    return normalized


def fetch_worldnews_articles(term: str, language: Optional[str]) -> List[Dict[str, Any]]:
    api_key = os.environ.get("WORLDNEWS_API_KEY")
    if not api_key:
        logger.info("World News API key not configured; skipping World News fetch.")
        return []

    params: Dict[str, Any] = {
        "api-key": api_key,
        "text": term,
        "number": WORLDNEWS_MAX_RESULTS,
    }
    if language:
        params["language"] = language

    headers = {
        "x-api-key": api_key,
    }

    try:
        response = requests.get(WORLDNEWS_API_URL, params=params, headers=headers, timeout=30)
    except requests.RequestException as exc:
        logger.warning("World News API request failed: %s", exc)
        return []

    if response.status_code == 429:
        logger.warning("World News API rate limit reached; skipping until quota resets.")
        return []
    if response.status_code != 200:
        logger.warning("World News API responded with %s: %s", response.status_code, response.text)
        return []

    try:
        payload = response.json()
    except ValueError:
        logger.warning("World News API returned a non-JSON payload; skipping results.")
        return []

    raw_articles: List[Dict[str, Any]] = payload.get("news", []) or []
    normalized: List[Dict[str, Any]] = []
    for article in raw_articles[:WORLDNEWS_MAX_RESULTS]:
        authors = article.get("authors")
        if isinstance(authors, list):
            authors = ", ".join([str(author) for author in authors if author]) or None
        host = hostname_from_url(article.get("url"))
        source_label = host or article.get("source_country")
        normalized.append(
            normalize_article(
                {
                    "source": {"id": source_label, "name": source_label},
                    "author": authors,
                    "title": article.get("title"),
                    "description": article.get("summary"),
                    "url": article.get("url"),
                    "urlToImage": article.get("image"),
                    "publishedAt": article.get("publish_date"),
                    "content": article.get("text") or article.get("summary"),
                    "category": article.get("category"),
                }
            )
        )
    return normalized


def fetch_guardian_articles(term: str, language: Optional[str]) -> List[Dict[str, Any]]:
    api_key = os.environ.get("GUARDIAN_API_KEY")
    if not api_key:
        logger.info("Guardian API key not configured; skipping Guardian fetch.")
        return []

    params: Dict[str, Any] = {
        "api-key": api_key,
        "q": term,
        "page-size": GUARDIAN_MAX_RESULTS,
        "order-by": "newest",
        "show-fields": "trailText,thumbnail,byline",
    }
    if language:
        params["lang"] = language

    try:
        response = requests.get(GUARDIAN_API_URL, params=params, timeout=30)
    except requests.RequestException as exc:
        logger.warning("Guardian request failed: %s", exc)
        return []

    if response.status_code == 429:
        logger.warning("Guardian API rate limit reached; skipping until quota resets.")
        return []
    if response.status_code != 200:
        logger.warning("Guardian responded with %s: %s", response.status_code, response.text)
        return []

    try:
        payload = response.json()
    except ValueError:
        logger.warning("Guardian returned a non-JSON payload; skipping results.")
        return []

    response_body = payload.get("response") or {}
    if response_body.get("status") != "ok":
        logger.warning("Guardian response not ok: %s", response_body)
        return []

    raw_results: List[Dict[str, Any]] = response_body.get("results", []) or []
    normalized: List[Dict[str, Any]] = []
    for article in raw_results[:GUARDIAN_MAX_RESULTS]:
        fields = article.get("fields") or {}
        normalized.append(
            normalize_article(
                {
                    "source": {"id": article.get("sectionId"), "name": "The Guardian"},
                    "author": fields.get("byline"),
                    "title": article.get("webTitle"),
                    "description": fields.get("trailText"),
                    "url": article.get("webUrl"),
                    "urlToImage": fields.get("thumbnail"),
                    "publishedAt": article.get("webPublicationDate"),
                    "content": None,
                    "category": article.get("sectionName"),
                }
            )
        )
    return normalized


def fetch_nyt_articles(term: str, language: Optional[str]) -> List[Dict[str, Any]]:
    if not NYT_API_KEY:
        logger.info("NYT API key not configured; skipping NYT fetch.")
        return []

    params: Dict[str, Any] = {
        "q": term,
        "sort": "newest",
        "api-key": NYT_API_KEY,
        "page": 0,
    }
    if language:
        params["fq"] = f'language.code:("{language}")'

    try:
        response = requests.get(NYT_API_URL, params=params, timeout=30)
    except requests.RequestException as exc:
        logger.warning("NYT request failed: %s", exc)
        return []

    if response.status_code == 429:
        logger.warning("NYT rate limit reached; skipping until quota resets.")
        return []
    if response.status_code != 200:
        logger.warning("NYT responded with %s: %s", response.status_code, response.text)
        return []

    try:
        payload = response.json()
    except ValueError:
        logger.warning("NYT returned a non-JSON payload; skipping results.")
        return []

    response_body = payload.get("response") or {}
    docs: List[Dict[str, Any]] = response_body.get("docs", []) or []

    normalized: List[Dict[str, Any]] = []
    for doc in docs[:DEFAULT_PAGE_SIZE]:
        multimedia_raw = doc.get("multimedia") or []
        image_url = None
        if isinstance(multimedia_raw, dict):
            image_url = (multimedia_raw.get("default") or {}).get("url") or (multimedia_raw.get("thumbnail") or {}).get("url")
        elif isinstance(multimedia_raw, list):
            for media in multimedia_raw:
                if not isinstance(media, dict):
                    continue
                url_value = media.get("url") or (media.get("default") or {}).get("url") or (media.get("thumbnail") or {}).get("url")
                if not url_value:
                    continue
                image_url = url_value
                break
        if image_url:
            if not image_url.startswith("http"):
                image_url = f"https://static01.nyt.com/{image_url.lstrip('/')}"
        category = doc.get("section_name") or doc.get("type_of_material")
        normalized.append(
            normalize_article(
                {
                    "source": {"id": "nyt", "name": "The New York Times"},
                    "author": (doc.get("byline") or {}).get("original"),
                    "title": (doc.get("headline") or {}).get("main"),
                    "description": doc.get("snippet"),
                    "url": doc.get("web_url"),
                    "urlToImage": image_url,
                    "publishedAt": doc.get("pub_date"),
                    "content": doc.get("lead_paragraph") or doc.get("abstract"),
                    "category": category,
                }
            )
        )
    return normalized


def store_articles(term: str, language: Optional[str], articles: List[Dict[str, Any]]) -> None:
    if not articles:
        return
    now = datetime.utcnow().isoformat()
    rows = []
    for article in articles:
        normalized_url = normalize_url(article.get("url"))
        if not normalized_url:
            continue
        rows.append(
            (
                normalized_url,
                article.get("url"),
                article.get("source", {}).get("name"),
                article.get("source", {}).get("id"),
                article.get("author"),
                article.get("title"),
                article.get("description"),
                article.get("urlToImage") or article.get("image"),
                article.get("publishedAt"),
                article.get("content"),
                article.get("category"),
                term,
                language,
                now,
            )
        )
    if not rows:
        return
    db_conn.executemany(
        """
        INSERT OR IGNORE INTO news_archive (
            normalized_url, url, source_name, source_id, author, title, description,
            url_to_image, published_at, content, category, term, language, saved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    db_conn.commit()


def fetch_archive(
    term: Optional[str],
    source: Optional[str],
    category: Optional[str],
    order: str,
    limit: int,
    offset: int,
) -> ArchiveResponse:
    params: List[Any] = []
    where_clauses: List[str] = []
    if term:
        where_clauses.append(
            "(LOWER(COALESCE(title, '')) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ? OR LOWER(COALESCE(content, '')) LIKE ?)"
        )
        like_term = f"%{term.lower()}%"
        params.extend([like_term, like_term, like_term])
    if source:
        where_clauses.append("source_name = ?")
        params.append(source)
    if category:
        where_clauses.append("category = ?")
        params.append(category)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    total_row = db_conn.execute(f"SELECT COUNT(1) FROM news_archive {where_sql}", params).fetchone()
    total = total_row[0] if total_row else 0

    params_with_paging = list(params)
    params_with_paging.extend([limit, offset])
    order_dir = "ASC" if order and order.lower() == "asc" else "DESC"
    rows = db_conn.execute(
        f"""
        SELECT url, source_name, source_id, author, title, description, url_to_image,
               published_at, content, category, term, saved_at
        FROM news_archive
        {where_sql}
        ORDER BY COALESCE(published_at, saved_at) {order_dir}, id {order_dir}
        LIMIT ? OFFSET ?
        """,
        params_with_paging,
    ).fetchall()

    articles: List[StoredArticle] = []
    for (
        url,
        source_name,
        source_id,
        author,
        title,
        description,
        url_to_image,
        published_at,
        content,
        category,
        term_value,
        saved_at,
    ) in rows:
        articles.append(
            StoredArticle(
                source={"id": source_id, "name": source_name},
                author=author,
                title=title,
                description=description,
                url=url,
                urlToImage=url_to_image,
                publishedAt=published_at,
                content=content,
                category=category,
                term=term_value,
                saved_at=saved_at,
            )
        )
    return ArchiveResponse(total=total, articles=articles)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.get("/news", response_model=NewsResponse)
def get_news(
    term: str = Query(..., min_length=1, max_length=200, description="Keyword to search for"),
    advanced: Optional[str] = Query(None, min_length=1, max_length=500, description="Advanced query string"),
    language: Optional[str] = Query(None, min_length=2, max_length=2, description="ISO-639-1 language code"),
) -> NewsResponse:
    query = advanced or term

    newsapi_articles = fetch_newsapi_articles(query, language)
    gnews_articles = fetch_gnews_articles(query, language)
    newsdata_articles = fetch_newsdata_articles(query, language)
    worldnews_articles = fetch_worldnews_articles(query, language)
    guardian_articles = fetch_guardian_articles(query, language)
    nyt_articles = fetch_nyt_articles(query, language)
    combined = deduplicate_articles(
        [
            *newsapi_articles,
            *gnews_articles,
            *newsdata_articles,
            *worldnews_articles,
            *guardian_articles,
            *nyt_articles,
        ]
    )
    sorted_articles = sorted(
        combined,
        key=lambda article: parse_datetime_to_timestamp(article.get("publishedAt")),
        reverse=True,
    )
    store_articles(query, language, sorted_articles)
    articles = [Article(**article) for article in sorted_articles]

    if not articles:
        raise HTTPException(status_code=404, detail="No articles returned for term")

    return NewsResponse(term=query, total_results=len(articles), articles=articles)


@app.get("/news/archive", response_model=ArchiveResponse)
def get_archive(
    term: Optional[str] = Query(None, min_length=1, max_length=200, description="Term used in searches"),
    source: Optional[str] = Query(None, min_length=1, max_length=200, description="Source name"),
    category: Optional[str] = Query(None, min_length=1, max_length=200, description="Category"),
    order: str = Query("desc", pattern="^(asc|desc)$", description="Sort by published/saved date"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ArchiveResponse:
    return fetch_archive(term, source, category, order, limit, offset)


def fetch_archive_meta(limit: int = 50) -> ArchiveMeta:
    sources_rows = db_conn.execute(
        """
        SELECT source_name, COUNT(1) as cnt
        FROM news_archive
        WHERE source_name IS NOT NULL
        GROUP BY source_name
        ORDER BY cnt DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    categories_rows = db_conn.execute(
        """
        SELECT category, COUNT(1) as cnt
        FROM news_archive
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY cnt DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    sources = [ArchiveFacet(value=row[0], count=row[1]) for row in sources_rows if row[0]]
    categories = [ArchiveFacet(value=row[0], count=row[1]) for row in categories_rows if row[0]]
    return ArchiveMeta(sources=sources, categories=categories)


@app.get("/news/archive/meta", response_model=ArchiveMeta)
def get_archive_meta(limit: int = Query(50, ge=1, le=200)) -> ArchiveMeta:
    return fetch_archive_meta(limit)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
