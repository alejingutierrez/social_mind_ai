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
OPENAI_API_URL = os.environ.get("OPENAI_API_URL", "https://api.openai.com/v1/chat/completions")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4.1")
OPENAI_TIMEOUT = int(os.environ.get("OPENAI_TIMEOUT", "120"))
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
            idioma TEXT,
            confianza REAL,
            relevancia INTEGER,
            accion_recomendada TEXT,
            cita_clave TEXT,
            created_at TEXT NOT NULL
        );
        """
    )
    info = conn.execute("PRAGMA table_info(insights)").fetchall()
    columns = {row[1] for row in info}
    new_columns = {
        "article_url": "article_url TEXT",
        "article_image": "article_image TEXT",
        "idioma": "idioma TEXT",
        "confianza": "confianza REAL",
        "relevancia": "relevancia INTEGER",
        "accion_recomendada": "accion_recomendada TEXT",
        "cita_clave": "cita_clave TEXT",
        # Nuevos campos para análisis enriquecido con OpenAI
        "resumen_ejecutivo": "resumen_ejecutivo TEXT",
        "tono": "tono TEXT",
        "temas_principales": "temas_principales TEXT",
        "subtemas": "subtemas TEXT",
        "stakeholders": "stakeholders TEXT",
        "impacto_social": "impacto_social TEXT",
        "impacto_economico": "impacto_economico TEXT",
        "impacto_politico": "impacto_politico TEXT",
        "palabras_clave_contextuales": "palabras_clave_contextuales TEXT",
        "trending_topics": "trending_topics TEXT",
        "analisis_competitivo": "analisis_competitivo TEXT",
        "credibilidad_fuente": "credibilidad_fuente REAL",
        "sesgo_detectado": "sesgo_detectado TEXT",
        "localizacion_geografica": "localizacion_geografica TEXT",
        "fuentes_citadas": "fuentes_citadas TEXT",
        "datos_numericos": "datos_numericos TEXT",
        "urgencia": "urgencia TEXT",
        "audiencia_objetivo": "audiencia_objetivo TEXT",
    }
    if "sentimiento" not in columns and "sentiment" in columns:
        conn.execute("ALTER TABLE insights RENAME COLUMN sentiment TO sentimiento")
        conn.commit()
        info = conn.execute("PRAGMA table_info(insights)").fetchall()
        columns = {row[1] for row in info}
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


def post_openai_json(system_prompt: str, user_prompt: str) -> Dict[str, Any]:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

    payload = {
        "model": LLM_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        response = requests.post(OPENAI_API_URL, json=payload, headers=headers, timeout=OPENAI_TIMEOUT)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach OpenAI API: {exc}") from exc

    try:
        body = response.json()
        content = body["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="OpenAI response missing expected content") from exc

    try:
        return parse_llm_json(content)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail=f"Invalid JSON from OpenAI: {exc}") from exc


def call_llm(article: Dict[str, Any]) -> Dict[str, Any]:
    system_prompt = (
        "Eres un analista experto en inteligencia de negocios que recibe noticias y genera análisis profundos y accionables. "
        "Siempre respondes únicamente JSON válido siguiendo el esquema proporcionado."
    )
    user_prompt = f"""
Analiza esta noticia en profundidad y responde con JSON usando exactamente estas claves:

{{
  "sentimiento": "positivo|negativo|neutro|indeterminado",
  "resumen": "resumen breve de 10 palabras para referencia rápida",
  "resumen_ejecutivo": "resumen ejecutivo detallado de 50-100 palabras que capture la esencia, implicaciones y contexto del artículo",
  "categoria": "politica|tecnologia|finanzas|deportes|entretenimiento|salud|ciencia|otros",
  "etiquetas": "palabra1,palabra2,palabra3",
  "marca": "marca principal mencionada o null",
  "entidad": "nombre propio principal (persona u organización) distinto de la marca o null",
  "idioma": "codigo ISO 639-1",
  "confianza": 0.0-1.0,
  "relevancia": 1-5,
  "accion_recomendada": "recomendación estratégica específica basada en el contenido",
  "cita_clave": "frase textual más relevante o impactante del artículo",
  "tono": "formal|casual|urgente|alarmista|tecnico|optimista|pesimista|neutral",
  "temas_principales": "tema1,tema2,tema3 - máximo 5 temas clave",
  "subtemas": "subtema1,subtema2,subtema3 - temas secundarios relevantes",
  "stakeholders": "stakeholder1,stakeholder2 - personas u organizaciones clave afectadas o mencionadas",
  "impacto_social": "descripción del impacto o relevancia social, o null si no aplica",
  "impacto_economico": "descripción del impacto económico o financiero, o null si no aplica",
  "impacto_politico": "descripción del impacto político o regulatorio, o null si no aplica",
  "palabras_clave_contextuales": "keyword1,keyword2,keyword3 - términos clave con contexto",
  "trending_topics": "#hashtag1,#hashtag2 - hashtags o trending topics relacionados",
  "analisis_competitivo": "análisis de competidores o comparativas mencionadas, o null",
  "credibilidad_fuente": 0.0-1.0,
  "sesgo_detectado": "politico_izquierda|politico_derecha|comercial|neutral|pro_marca|anti_marca",
  "localizacion_geografica": "pais1,ciudad1,region1 - ubicaciones geográficas relevantes mencionadas",
  "fuentes_citadas": "fuente1,fuente2 - estudios, expertos o fuentes citadas en el artículo",
  "datos_numericos": "dato1: valor1, dato2: valor2 - estadísticas o números clave del artículo",
  "urgencia": "baja|media|alta|critica",
  "audiencia_objetivo": "B2B|B2C|gobierno|academico|general|profesional"
}}

Si un dato no existe o no es aplicable, usa null. No agregues texto adicional fuera del JSON.

Titulo: {article.get('title') or ''}
Descripcion: {article.get('description') or ''}
Contenido: {article.get('content') or ''}
"""
    return post_openai_json(system_prompt, user_prompt)


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
            article_image, idioma, confianza, relevancia, accion_recomendada, cita_clave,
            resumen_ejecutivo, tono, temas_principales, subtemas, stakeholders,
            impacto_social, impacto_economico, impacto_politico, palabras_clave_contextuales,
            trending_topics, analisis_competitivo, credibilidad_fuente, sesgo_detectado,
            localizacion_geografica, fuentes_citadas, datos_numericos, urgencia, audiencia_objetivo,
            created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            llm_data.get("idioma"),
            llm_data.get("confianza"),
            llm_data.get("relevancia"),
            llm_data.get("accion_recomendada"),
            llm_data.get("cita_clave"),
            llm_data.get("resumen_ejecutivo"),
            llm_data.get("tono"),
            llm_data.get("temas_principales"),
            llm_data.get("subtemas"),
            llm_data.get("stakeholders"),
            llm_data.get("impacto_social"),
            llm_data.get("impacto_economico"),
            llm_data.get("impacto_politico"),
            llm_data.get("palabras_clave_contextuales"),
            llm_data.get("trending_topics"),
            llm_data.get("analisis_competitivo"),
            llm_data.get("credibilidad_fuente"),
            llm_data.get("sesgo_detectado"),
            llm_data.get("localizacion_geografica"),
            llm_data.get("fuentes_citadas"),
            llm_data.get("datos_numericos"),
            llm_data.get("urgencia"),
            llm_data.get("audiencia_objetivo"),
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
    idioma: Optional[str] = None
    confianza: Optional[float] = None
    relevancia: Optional[int] = None
    accion_recomendada: Optional[str] = None
    cita_clave: Optional[str] = None
    # Nuevos campos para análisis enriquecido
    resumen_ejecutivo: Optional[str] = None
    tono: Optional[str] = None
    temas_principales: Optional[str] = None
    subtemas: Optional[str] = None
    stakeholders: Optional[str] = None
    impacto_social: Optional[str] = None
    impacto_economico: Optional[str] = None
    impacto_politico: Optional[str] = None
    palabras_clave_contextuales: Optional[str] = None
    trending_topics: Optional[str] = None
    analisis_competitivo: Optional[str] = None
    credibilidad_fuente: Optional[float] = None
    sesgo_detectado: Optional[str] = None
    localizacion_geografica: Optional[str] = None
    fuentes_citadas: Optional[str] = None
    datos_numericos: Optional[str] = None
    urgencia: Optional[str] = None
    audiencia_objetivo: Optional[str] = None
    # Campos del artículo
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
