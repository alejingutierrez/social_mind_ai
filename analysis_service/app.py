import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = os.environ.get("INSIGHTS_DB_PATH", "/data/insights.db")
LLM_API_URL = os.environ.get("LLM_API_URL", "http://host.docker.internal:11434/api/generate")
LLM_MODEL = os.environ.get("LLM_MODEL", "qwen2.5:14b")
MAX_LIMIT = int(os.environ.get("ANALYSIS_MAX_LIMIT", "20"))

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS analysis_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term TEXT,
            insight_ids TEXT NOT NULL,
            result_json TEXT NOT NULL,
            count INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )
    return conn


def parse_llm_json(raw_text: str) -> Dict[str, Any]:
    raw_text = raw_text.strip()
    start = raw_text.find("{")
    end = raw_text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("LLM response did not contain JSON object")
    cleaned = raw_text[start : end + 1]
    return json.loads(cleaned)


def format_articles(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    articles: List[Dict[str, Any]] = []
    for row in rows:
        record = dict(row)
        articles.append(
            {
                "term": record.get("term"),
                "sentimiento": record.get("sentimiento"),
                "resumen": record.get("resumen"),
                "categoria": record.get("categoria"),
                "etiquetas": record.get("etiquetas"),
                "marca": record.get("marca"),
                "entidad": record.get("entidad"),
                "titulo": record.get("article_title"),
                "descripcion": record.get("article_description"),
                "contenido": record.get("article_content"),
                "url": record.get("article_url"),
                "imagen": record.get("article_image"),
                "created_at": record.get("created_at"),
            }
        )
    return articles


def call_llm_for_summary(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    articles_json = json.dumps(articles, ensure_ascii=False)
    prompt = f"""
Eres un estratega senior. Recibirás un conjunto de noticias previamente clasificadas.
Devuelve únicamente JSON válido exactamente con esta estructura y sin texto adicional:
{{
  "insights": [
    {{"titulo": "", "descripcion": ""}},
    {{"titulo": "", "descripcion": ""}}
  ],
  "oportunidades_negocio": [
    {{"titulo": "", "descripcion": ""}},
    {{"titulo": "", "descripcion": ""}}
  ],
  "riesgos_reputacionales": [
    {{"titulo": "", "descripcion": ""}},
    {{"titulo": "", "descripcion": ""}}
  ]
}}
Requisitos:
- Cada lista debe contener exactamente 2 elementos.
- "titulo" máximo 6 palabras, "descripcion" máximo 30 palabras.
- Si no hay información suficiente usa "null" en el campo que falte.
- Analiza el conjunto completo, no cada noticia por separado.

Noticias proporcionadas (JSON):
{articles_json}
"""

    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    try:
        response = requests.post(LLM_API_URL, json=payload, timeout=300)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach LLM API: {exc}") from exc

    body = response.json()
    raw_text = body.get("response", "")
    if not raw_text:
        raise HTTPException(status_code=502, detail="LLM response missing 'response' field")

    try:
        return parse_llm_json(raw_text)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=502, detail=f"Invalid JSON from LLM: {exc}") from exc


conn = get_connection()
app = FastAPI(title="Insights Aggregator", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SummaryItem(BaseModel):
    titulo: Optional[str]
    descripcion: Optional[str]


class AggregatedResponse(BaseModel):
    analysis_id: Optional[int] = None
    term: Optional[str]
    count: int
    insights: List[SummaryItem]
    oportunidades_negocio: List[SummaryItem]
    riesgos_reputacionales: List[SummaryItem]


class AnalysisRequest(BaseModel):
    term: Optional[str] = None
    limit: Optional[int] = 10
    insight_ids: Optional[List[int]] = None


class AnalysisHistoryItem(BaseModel):
    id: int
    term: Optional[str]
    count: int
    insight_ids: List[int]
    insights: List[SummaryItem]
    oportunidades_negocio: List[SummaryItem]
    riesgos_reputacionales: List[SummaryItem]
    created_at: str


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "db_path": DB_PATH}


def fetch_insight_rows(
    term: Optional[str], limit: int, insight_ids: Optional[List[int]]
) -> List[sqlite3.Row]:
    if insight_ids:
        placeholders = ",".join("?" for _ in insight_ids)
        rows = conn.execute(
            f"SELECT * FROM insights WHERE id IN ({placeholders})",
            insight_ids,
        ).fetchall()
        row_map = {row["id"]: row for row in rows}
        ordered_rows = [row_map[i] for i in insight_ids if i in row_map]
        if not ordered_rows:
            raise HTTPException(status_code=404, detail="Selected insights not found")
        return ordered_rows
    params: List[Any] = []
    query = "SELECT * FROM insights"
    if term:
        query += " WHERE term = ?"
        params.append(term)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    rows = conn.execute(query, params).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail="No insights stored for given criteria")
    return rows


def execute_analysis(term: Optional[str], rows: List[sqlite3.Row]) -> Dict[str, Any]:
    articles = format_articles(rows)
    llm_result = call_llm_for_summary(articles)
    insights = llm_result.get("insights")
    oportunidades = llm_result.get("oportunidades_negocio")
    riesgos = llm_result.get("riesgos_reputacionales")

    if not isinstance(insights, list) or not isinstance(oportunidades, list) or not isinstance(riesgos, list):
        raise HTTPException(status_code=502, detail="LLM JSON missing required arrays")

    return {
        "insights": insights,
        "oportunidades_negocio": oportunidades,
        "riesgos_reputacionales": riesgos,
    }


def persist_analysis(term: Optional[str], insight_ids: List[int], result: Dict[str, Any], count: int) -> int:
    now = datetime.utcnow().isoformat()
    cursor = conn.execute(
        """
        INSERT INTO analysis_results (term, insight_ids, result_json, count, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            term,
            json.dumps(insight_ids),
            json.dumps(result, ensure_ascii=False),
            count,
            now,
        ),
    )
    conn.commit()
    return cursor.lastrowid


def build_response(
    term: Optional[str],
    rows: List[sqlite3.Row],
    result: Dict[str, Any],
    analysis_id: Optional[int] = None,
) -> AggregatedResponse:
    return AggregatedResponse(
        analysis_id=analysis_id,
        term=term,
        count=len(rows),
        insights=[SummaryItem(**item) for item in result["insights"]],
        oportunidades_negocio=[SummaryItem(**item) for item in result["oportunidades_negocio"]],
        riesgos_reputacionales=[SummaryItem(**item) for item in result["riesgos_reputacionales"]],
    )


@app.get("/analysis", response_model=AggregatedResponse)
def analyze(
    term: Optional[str] = Query(None, min_length=1, max_length=200),
    limit: int = Query(10, ge=2, le=MAX_LIMIT),
) -> AggregatedResponse:
    rows = fetch_insight_rows(term, limit, None)
    result = execute_analysis(term, rows)
    return build_response(term, rows, result)


@app.post("/analysis/run", response_model=AggregatedResponse)
def run_persistent_analysis(request: AnalysisRequest) -> AggregatedResponse:
    limit = min(request.limit or 10, MAX_LIMIT)
    insight_ids = request.insight_ids
    if insight_ids:
        if len(insight_ids) > MAX_LIMIT:
            raise HTTPException(status_code=400, detail=f"A maximum of {MAX_LIMIT} insights can be analyzed at once")
        rows = fetch_insight_rows(None, limit, insight_ids)
        inferred_term = request.term or (rows[0]["term"] if rows else None)
    else:
        rows = fetch_insight_rows(request.term, limit, None)
        inferred_term = request.term
    result = execute_analysis(inferred_term, rows)
    stored_id = persist_analysis(
        inferred_term,
        [row["id"] for row in rows],
        result,
        len(rows),
    )
    return build_response(inferred_term, rows, result, analysis_id=stored_id)


@app.get("/analysis/history", response_model=List[AnalysisHistoryItem])
def analysis_history(limit: int = Query(20, ge=1, le=100)) -> List[AnalysisHistoryItem]:
    rows = conn.execute(
        "SELECT * FROM analysis_results ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    history: List[AnalysisHistoryItem] = []
    for row in rows:
        insight_ids = json.loads(row["insight_ids"])
        result_payload = json.loads(row["result_json"])
        history.append(
            AnalysisHistoryItem(
                id=row["id"],
                term=row["term"],
                count=row["count"],
                insight_ids=insight_ids,
                insights=[SummaryItem(**item) for item in result_payload.get("insights", [])],
                oportunidades_negocio=[
                    SummaryItem(**item) for item in result_payload.get("oportunidades_negocio", [])
                ],
                riesgos_reputacionales=[
                    SummaryItem(**item) for item in result_payload.get("riesgos_reputacionales", [])
                ],
                created_at=row["created_at"],
            )
        )
    return history


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8100)))
