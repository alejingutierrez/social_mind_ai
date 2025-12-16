const { query } = require('./db')
const { callOpenAI, parseJson } = require('./openai')

const analysisSystemPrompt =
  'Eres un analista periodístico senior experto en análisis de cobertura mediática. ' +
  'Recibirás un conjunto de noticias previamente clasificadas y debes generar un análisis ' +
  'periodístico completo del conjunto, identificando narrativas, actores, sesgos y tendencias. ' +
  'Siempre devuelve únicamente JSON válido.'

function buildAggregationPrompt(articlesJson) {
  return `Analiza este conjunto de noticias y genera un análisis periodístico completo.
Devuelve exclusivamente JSON con esta estructura:

{
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
}

IMPORTANTE:
- Analiza el conjunto completo de noticias como un todo, no individualmente
- Si un campo no aplica o no hay suficiente información, usa null
- Sé específico y basado en evidencia de las noticias proporcionadas
- No inventes información que no esté en las noticias

Noticias a analizar (JSON con insights enriquecidos):
${articlesJson}`
}

async function runAggregation(term, articles) {
  const payloadJson = JSON.stringify(articles)
  const prompt = buildAggregationPrompt(payloadJson)
  const content = await callOpenAI({ system: analysisSystemPrompt, user: prompt, responseSchema: true })
  return parseJson(content)
}

async function saveAnalysis(term, insightIds, result) {
  const { rows } = await query(
    `
    INSERT INTO analysis_results (term, insight_ids, result_json, count)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [term, insightIds, JSON.stringify(result), insightIds.length],
  )
  return rows[0]
}

async function listAnalysis(limit = 20) {
  const { rows } = await query(
    'SELECT * FROM analysis_results ORDER BY id DESC LIMIT $1',
    [limit],
  )
  return rows
}

module.exports = { runAggregation, saveAnalysis, listAnalysis }
