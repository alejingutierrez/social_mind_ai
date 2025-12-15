from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

NEWS_SERVICE_URL = os.environ.get("NEWS_SERVICE_URL", "http://news_service:8080")
LLM_API_URL = os.environ.get("LLM_API_URL", "http://host.docker.internal:11434/api/generate")
LLM_MODEL = os.environ.get("LLM_MODEL", "qwen2.5:14b")
DB_PATH = os.environ.get("INSIGHTS_DB_PATH", "/data/insights.db")
MAX_ARTICLES = int(os.environ.get("MAX_ARTICLES", "10"))

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS insights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term TEXT NOT NULL,
            sentimiento TEXT,
            resumen TEXT,
            categoria TEXT,
            etiquetas TEXT,
            marca TEXT,
            entidad TEXT,
            article_title TEXT,
            article_description TEXT,
            article_content TEXT,
            article_url TEXT,
            article_image TEXT,
            created_at TEXT NOT NULL
        );
        """
    )
    info = conn.execute("PRAGMA table_info(insights)").fetchall()
    columns = {row[1] for row in info}
    if "sentimiento" not in columns and "sentiment" in columns:
        conn.execute("ALTER TABLE insights RENAME COLUMN sentiment TO sentimiento")
        conn.commit()
        info = conn.execute("PRAGMA table_info(insights)").fetchall()
        columns = {row[1] for row in info}
    new_columns = {
        "article_url": "article_url TEXT",
        "article_image": "article_image TEXT",
    }
    for name, ddl in new_columns.items():
        if name not in columns:
            conn.execute(f"ALTER TABLE insights ADD COLUMN {ddl}")
            conn.commit()
    return conn


def parse_llm_json(raw_text: str) -> Dict[str, Any]:
    raw_text = raw_text.strip()
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("LLM response did not contain JSON object")
    cleaned = raw_text[start : end + 1]
    return json.loads(cleaned)


def call_llm(article: Dict[str, Any]) -> Dict[str, Any]:
    prompt = f"""
Eres un analista que recibe noticias y siempre responde únicamente JSON válido.
Usa este formato y llaves exactas:
{{
  "sentimiento": "positivo|negativo|neutro|indeterminado",
  "resumen": "10 palabras",
  "categoria": "politica|tecnologia|finanzas|deportes|entretenimiento|otros",
  "etiquetas": "palabra1,palabra2",
  "marca": "marca principal o null",
  "entidad": "nombre propio principal distinto de la marca o null"
}}
Si un dato no existe usa null. No agregues texto adicional.

Titulo: {article.get('title') or ''}
Descripcion: {article.get('description') or ''}
Contenido: {article.get('content') or ''}
"""

    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    try:
        response = requests.post(LLM_API_URL, json=payload, timeout=180)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach LLM API: {exc}") from exc

    llm_payload = response.json()
    raw_text = llm_payload.get("response", "")
    if not raw_text:
        raise HTTPException(status_code=502, detail="LLM response missing 'response' field")

    try:
        return parse_llm_json(raw_text)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail=f"Invalid JSON from LLM: {exc}") from exc


def fetch_news(term: str, language: Optional[str] = None) -> List[Dict[str, Any]]:
    params = {"term": term}
    if language:
        params["language"] = language

    try:
        response = requests.get(f"{NEWS_SERVICE_URL}/news", params=params, timeout=60)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach news service: {exc}") from exc

    payload = response.json()
    return payload.get("articles", [])[:MAX_ARTICLES]


def store_insight_record(term: str, article: Dict[str, Any], llm_data: Dict[str, Any]) -> int:
    now = datetime.utcnow().isoformat()
    cursor = conn.execute(
        """
        INSERT INTO insights (
            term, sentimiento, resumen, categoria, etiquetas, marca, entidad,
            article_title, article_description, article_content, article_url,
            article_image, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            term,
            llm_data.get("sentimiento"),
            llm_data.get("resumen"),
            llm_data.get("categoria"),
            llm_data.get("etiquetas"),
            llm_data.get("marca"),
            llm_data.get("entidad"),
            article.get("title"),
            article.get("description"),
            article.get("content"),
            article.get("url"),
            article.get("urlToImage") or article.get("url_to_image"),
            now,
        ),
    )
    conn.commit()
    return cursor.lastrowid


def load_insights_by_ids(ids: List[int]) -> List["Insight"]:
    if not ids:
        return []
    placeholders = ",".join("?" for _ in ids)
    rows = conn.execute(
        f"SELECT * FROM insights WHERE id IN ({placeholders}) ORDER BY id",
        ids,
    ).fetchall()
    return [Insight(**dict(row)) for row in rows]


def classify_articles(term: str, articles: List[Dict[str, Any]]) -> "InsightResponse":
    if not articles:
        raise HTTPException(status_code=404, detail="No articles provided for classification")
    saved_ids: List[int] = []
    for article in articles[:MAX_ARTICLES]:
        llm_data = call_llm(article)
        saved_ids.append(store_insight_record(term, article, llm_data))
    insights = load_insights_by_ids(saved_ids)
    return InsightResponse(term=term, count=len(insights), insights=insights)


def list_insights(term: Optional[str], limit: int, offset: int) -> "PaginatedInsights":
    params: List[Any] = []
    where_clause = ""
    if term:
        where_clause = "WHERE term = ?"
        params.append(term)
    total = conn.execute(
        f"SELECT COUNT(1) FROM insights {where_clause}",
        params,
    ).fetchone()[0]
    params_with_paging = list(params)
    params_with_paging.extend([limit, offset])
    rows = conn.execute(
        f"SELECT * FROM insights {where_clause} ORDER BY id DESC LIMIT ? OFFSET ?",
        params_with_paging,
    ).fetchall()
    return PaginatedInsights(total=total, items=[Insight(**dict(row)) for row in rows])


conn = get_connection()
app = FastAPI(title="News Insights Service", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Insight(BaseModel):
    id: int
    term: str
    sentimiento: Optional[str]
    resumen: Optional[str]
    categoria: Optional[str]
    etiquetas: Optional[str]
    marca: Optional[str]
    entidad: Optional[str]
    article_title: Optional[str]
    article_description: Optional[str]
    article_content: Optional[str]
    article_url: Optional[str]
    article_image: Optional[str]
    created_at: str


class ArticleInput(BaseModel):
    title: Optional[str]
    description: Optional[str]
    content: Optional[str]
    url: Optional[str]
    urlToImage: Optional[str] = Field(None, alias="urlToImage")


class ClassificationRequest(BaseModel):
    term: Optional[str] = None
    language: Optional[str] = None
    articles: Optional[List[ArticleInput]] = None


class InsightResponse(BaseModel):
    term: str
    count: int
    insights: List[Insight]


class PaginatedInsights(BaseModel):
    total: int
    items: List[Insight]


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "db_path": DB_PATH}


@app.get("/insights", response_model=InsightResponse)
def generate_insights(
    term: str = Query(..., min_length=1, max_length=200),
    language: Optional[str] = Query(None, min_length=2, max_length=2),
) -> InsightResponse:
    articles = fetch_news(term, language)
    if not articles:
        raise HTTPException(status_code=404, detail="No articles returned for term")
    return classify_articles(term, articles)


@app.post("/insights/classify", response_model=InsightResponse)
def classify_from_payload(request: ClassificationRequest) -> InsightResponse:
    if request.articles:
        articles = [article.dict(by_alias=True, exclude_none=True) for article in request.articles]
        term = request.term or "custom"
        return classify_articles(term, articles)
    if request.term:
        articles = fetch_news(request.term, request.language)
        if not articles:
            raise HTTPException(status_code=404, detail="No articles returned for term")
        return classify_articles(request.term, articles)
    raise HTTPException(status_code=400, detail="Provide either a term or a list of articles")


@app.get("/insights/list", response_model=PaginatedInsights)
def list_insights_endpoint(
    term: Optional[str] = Query(None, min_length=1, max_length=200),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> PaginatedInsights:
    return list_insights(term, limit, offset)


@app.get("/history", response_model=List[Insight])
def get_history(limit: int = Query(50, ge=1, le=500)) -> List[Insight]:
    data = list_insights(None, limit, 0)
    return data.items


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8090)))
