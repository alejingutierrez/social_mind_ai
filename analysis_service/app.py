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
OPENAI_API_URL = os.environ.get("OPENAI_API_URL", "https://api.openai.com/v1/chat/completions")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o-mini")
OPENAI_TIMEOUT = int(os.environ.get("OPENAI_TIMEOUT", "180"))
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
                "resumen_ejecutivo": record.get("resumen_ejecutivo"),
                "categoria": record.get("categoria"),
                "etiquetas": record.get("etiquetas"),
                "marca": record.get("marca"),
                "entidad": record.get("entidad"),
                "tono": record.get("tono"),
                "temas_principales": record.get("temas_principales"),
                "subtemas": record.get("subtemas"),
                "stakeholders": record.get("stakeholders"),
                "impacto_social": record.get("impacto_social"),
                "impacto_economico": record.get("impacto_economico"),
                "impacto_politico": record.get("impacto_politico"),
                "palabras_clave_contextuales": record.get("palabras_clave_contextuales"),
                "trending_topics": record.get("trending_topics"),
                "analisis_competitivo": record.get("analisis_competitivo"),
                "credibilidad_fuente": record.get("credibilidad_fuente"),
                "sesgo_detectado": record.get("sesgo_detectado"),
                "localizacion_geografica": record.get("localizacion_geografica"),
                "fuentes_citadas": record.get("fuentes_citadas"),
                "datos_numericos": record.get("datos_numericos"),
                "urgencia": record.get("urgencia"),
                "audiencia_objetivo": record.get("audiencia_objetivo"),
                "titulo": record.get("article_title"),
                "descripcion": record.get("article_description"),
                "contenido": record.get("article_content"),
                "url": record.get("article_url"),
                "imagen": record.get("article_image"),
                "cita_clave": record.get("cita_clave"),
                "created_at": record.get("created_at"),
            }
        )
    return articles


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
        "temperature": 0.3,
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


def call_llm_for_summary(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
    articles_json = json.dumps(articles, ensure_ascii=False)
    system_prompt = (
        "Eres un analista periodístico senior experto en análisis de cobertura mediática. "
        "Recibirás un conjunto de noticias previamente clasificadas y debes generar un análisis "
        "periodístico completo del conjunto, identificando narrativas, actores, sesgos y tendencias. "
        "Siempre devuelve únicamente JSON válido."
    )
    user_prompt = f"""
Analiza este conjunto de noticias y genera un análisis periodístico completo.
Devuelve exclusivamente JSON con esta estructura:

{{
  "sintesis_general": "Párrafo de 200-300 palabras resumiendo qué está pasando, los hechos principales y por qué es relevante",
  "narrativa_principal": "La historia o ángulo dominante en la cobertura (1-2 frases)",
  "narrativas_alternativas": "Otros ángulos o perspectivas presentes, separados por coma",
  "framing_predominante": "Cómo se enmarca: conflicto_politico|consecuencias|interes_humano|responsabilidad|moralidad|otro",
  "linea_temporal": "Cronología de eventos clave mencionados en las noticias",
  "contexto_necesario": "Background histórico o información previa relevante para entender la historia",
  "actores_principales": "Lista de personas, organizaciones protagonistas, separadas por coma",
  "voces_presentes": "Qué perspectivas están representadas en la cobertura",
  "voces_ausentes": "Perspectivas importantes que faltan en la cobertura o null",
  "posiciones_enfrentadas": "Diferentes posturas sobre el tema con formato: Actor: posición",
  "puntos_de_consenso": "Aspectos en los que hay acuerdo o null",
  "puntos_de_conflicto": "Aspectos más controversiales",
  "datos_clave": "Estadísticas, números, porcentajes importantes mencionados, separados por coma",
  "fuentes_primarias": "Documentos, estudios, investigaciones citadas, separados por coma o null",
  "citas_destacadas": "Las 3-5 citas textuales más impactantes, separadas por |",
  "tono_general_cobertura": "urgente|alarmista|neutral|esperanzador|critico|tecnico",
  "equilibrio_cobertura": "Análisis de si la cobertura es balanceada o sesgada y hacia qué",
  "calidad_periodistica": "Evaluación de si hay fuentes verificables, datos de soporte, distinción hecho/opinión",
  "nivel_credibilidad": "Promedio de credibilidad de fuentes y evaluación general",
  "consistencia_hechos": "Si los hechos son consistentes entre fuentes o hay contradicciones",
  "verificacion_necesaria": "Afirmaciones que requieren fact-checking o null",
  "sesgos_identificados": "Patrones de sesgo detectados con porcentajes si es posible",
  "lenguaje_cargado": "Palabras o frases con connotación, eufemismos, términos sesgados o null",
  "epicentro_geografico": "Principales ubicaciones de los eventos",
  "alcance_geografico": "local|nacional|regional|internacional|global",
  "zonas_afectadas": "Lugares con mayor impacto, separados por coma",
  "temas_dominantes": "Top 5-7 temas más recurrentes, separados por coma",
  "temas_emergentes": "Nuevos temas apareciendo, separados por coma o null",
  "palabras_clave_frecuentes": "Términos más mencionados con frecuencia si es posible: palabra1:N, palabra2:M",
  "hashtags_tendencia": "Trending topics relacionados, separados por coma o null",
  "impacto_social_proyectado": "Cómo afecta/afectará a la sociedad",
  "impacto_politico_proyectado": "Consecuencias políticas esperadas",
  "impacto_economico_proyectado": "Implicaciones económicas",
  "escenarios_posibles": "Qué podría pasar: optimista, realista, pesimista",
  "eventos_por_vigilar": "Próximos acontecimientos clave, fechas importantes",
  "aspectos_ignorados": "Perspectivas importantes que faltan, preguntas sin responder o null",
  "audiencia_objetivo_agregada": "A quién está dirigida la cobertura: general|especializada|academica|etc",
  "nivel_tecnico": "basico|intermedio|avanzado|especializado"
}}

IMPORTANTE:
- Analiza el conjunto completo de noticias como un todo, no individualmente
- Si un campo no aplica o no hay suficiente información, usa null
- Sé específico y basado en evidencia de las noticias proporcionadas
- No inventes información que no esté en las noticias

Noticias a analizar (JSON con insights enriquecidos):
{articles_json}
"""
    return post_openai_json(system_prompt, user_prompt)


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
