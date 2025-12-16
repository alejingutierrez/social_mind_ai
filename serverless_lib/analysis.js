const { query } = require('./db')
const { callOpenAI, parseJson } = require('./openai')

const analysisSystemPrompt =
  'Eres un estratega senior. Recibirás un conjunto de noticias previamente clasificadas y debes devolver únicamente JSON válido con hallazgos agregados.'

function buildAggregationPrompt(articlesJson) {
  return `Devuelve exclusivamente JSON con esta estructura y sin texto adicional:
{
  "insights": [
    {"titulo": "", "descripcion": ""},
    {"titulo": "", "descripcion": ""}
  ],
  "oportunidades_negocio": [
    {"titulo": "", "descripcion": ""},
    {"titulo": "", "descripcion": ""}
  ],
  "riesgos_reputacionales": [
    {"titulo": "", "descripcion": ""},
    {"titulo": "", "descripcion": ""}
  ]
}
Requisitos:
- Cada lista debe contener exactamente 2 elementos.
- "titulo" máximo 6 palabras, "descripcion" máximo 30 palabras.
- Si no hay información suficiente usa "null" en el campo que falte.
- Analiza el conjunto completo, no cada noticia por separado.

Noticias proporcionadas (JSON):
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
