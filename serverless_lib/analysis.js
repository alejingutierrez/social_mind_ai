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
    INSERT INTO analysis_results (
      term, insight_ids, result_json, count,
      sintesis_general, narrativa_principal, narrativas_alternativas, framing_predominante,
      linea_temporal, contexto_necesario, actores_principales, voces_presentes, voces_ausentes,
      posiciones_enfrentadas, puntos_de_consenso, puntos_de_conflicto, datos_clave,
      fuentes_primarias, citas_destacadas, tono_general_cobertura, equilibrio_cobertura,
      calidad_periodistica, nivel_credibilidad, consistencia_hechos, verificacion_necesaria,
      sesgos_identificados, lenguaje_cargado, epicentro_geografico, alcance_geografico,
      zonas_afectadas, temas_dominantes, temas_emergentes, palabras_clave_frecuentes,
      hashtags_tendencia, impacto_social_proyectado, impacto_politico_proyectado,
      impacto_economico_proyectado, escenarios_posibles, eventos_por_vigilar,
      aspectos_ignorados, audiencia_objetivo_agregada, nivel_tecnico
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42)
    RETURNING *
    `,
    [
      term,
      insightIds,
      JSON.stringify(result),
      insightIds.length,
      result.sintesis_general || null,
      result.narrativa_principal || null,
      result.narrativas_alternativas || null,
      result.framing_predominante || null,
      result.linea_temporal || null,
      result.contexto_necesario || null,
      result.actores_principales || null,
      result.voces_presentes || null,
      result.voces_ausentes || null,
      result.posiciones_enfrentadas || null,
      result.puntos_de_consenso || null,
      result.puntos_de_conflicto || null,
      result.datos_clave || null,
      result.fuentes_primarias || null,
      result.citas_destacadas || null,
      result.tono_general_cobertura || null,
      result.equilibrio_cobertura || null,
      result.calidad_periodistica || null,
      result.nivel_credibilidad || null,
      result.consistencia_hechos || null,
      result.verificacion_necesaria || null,
      result.sesgos_identificados || null,
      result.lenguaje_cargado || null,
      result.epicentro_geografico || null,
      result.alcance_geografico || null,
      result.zonas_afectadas || null,
      result.temas_dominantes || null,
      result.temas_emergentes || null,
      result.palabras_clave_frecuentes || null,
      result.hashtags_tendencia || null,
      result.impacto_social_proyectado || null,
      result.impacto_politico_proyectado || null,
      result.impacto_economico_proyectado || null,
      result.escenarios_posibles || null,
      result.eventos_por_vigilar || null,
      result.aspectos_ignorados || null,
      result.audiencia_objetivo_agregada || null,
      result.nivel_tecnico || null,
    ],
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
