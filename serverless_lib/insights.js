const { query } = require('./db')
const { callOpenAI, parseJson } = require('./openai')

const MAX_ARTICLES = Number(process.env.MAX_ARTICLES || 5)

const classifySystemPrompt =
  'Eres un analista experto en inteligencia de negocios que recibe noticias y genera análisis profundos y accionables. ' +
  'Siempre respondes únicamente JSON válido siguiendo el esquema proporcionado.'

function buildClassificationPrompt(article) {
  return `Analiza esta noticia en profundidad y responde con JSON usando exactamente estas claves:

{
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
}

Si un dato no existe o no es aplicable, usa null. No agregues texto adicional fuera del JSON.

Titulo: ${article.title || ''}
Descripcion: ${article.description || ''}
Contenido: ${article.content || ''}`
}

async function classifyArticles(term, articles) {
  const results = []
  for (const article of articles.slice(0, MAX_ARTICLES)) {
    const userPrompt = buildClassificationPrompt(article)
    const content = await callOpenAI({ system: classifySystemPrompt, user: userPrompt, responseSchema: true })
    const parsed = parseJson(content)
    const saved = await saveInsight(term, article, parsed)
    results.push(saved)
  }
  return results
}

async function saveInsight(term, article, llm) {
  const values = [
    term,
    llm.sentimiento || null,
    llm.resumen || null,
    llm.categoria || null,
    llm.etiquetas || null,
    llm.marca || null,
    llm.entidad || null,
    article.title || null,
    article.description || null,
    article.content || null,
    article.url || null,
    article.urlToImage || article.url_to_image || null,
    llm.idioma || null,
    llm.confianza != null ? Number(llm.confianza) : null,
    llm.relevancia != null ? Number(llm.relevancia) : null,
    llm.accion_recomendada || null,
    llm.cita_clave || null,
    // Nuevos campos enriquecidos
    llm.resumen_ejecutivo || null,
    llm.tono || null,
    llm.temas_principales || null,
    llm.subtemas || null,
    llm.stakeholders || null,
    llm.impacto_social || null,
    llm.impacto_economico || null,
    llm.impacto_politico || null,
    llm.palabras_clave_contextuales || null,
    llm.trending_topics || null,
    llm.analisis_competitivo || null,
    llm.credibilidad_fuente != null ? Number(llm.credibilidad_fuente) : null,
    llm.sesgo_detectado || null,
    llm.localizacion_geografica || null,
    llm.fuentes_citadas || null,
    llm.datos_numericos || null,
    llm.urgencia || null,
    llm.audiencia_objetivo || null,
  ]
  const { rows } = await query(
    `
    INSERT INTO insights (
      term, sentimiento, resumen, categoria, etiquetas, marca, entidad,
      article_title, article_description, article_content, article_url, article_image,
      idioma, confianza, relevancia, accion_recomendada, cita_clave,
      resumen_ejecutivo, tono, temas_principales, subtemas, stakeholders,
      impacto_social, impacto_economico, impacto_politico, palabras_clave_contextuales,
      trending_topics, analisis_competitivo, credibilidad_fuente, sesgo_detectado,
      localizacion_geografica, fuentes_citadas, datos_numericos, urgencia, audiencia_objetivo
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
    RETURNING *
    `,
    values,
  )
  return rows[0]
}

async function listInsights({ term, limit = 50, offset = 0 }) {
  const params = []
  const where = []
  if (term) {
    params.push(term)
    where.push(`term = $${params.length}`)
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const totalRes = await query(`SELECT COUNT(1) FROM insights ${whereClause}`, params)
  const total = Number(totalRes.rows[0].count || 0)
  params.push(limit, offset)
  const rowsRes = await query(
    `
    SELECT * FROM insights
    ${whereClause}
    ORDER BY id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  )
  return { total, items: rowsRes.rows }
}

async function getInsightsByIds(ids) {
  if (!ids?.length) return []
  const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(',')
  const { rows } = await query(
    `SELECT * FROM insights WHERE id IN (${placeholders}) ORDER BY id`,
    ids,
  )
  return rows
}

async function recentInsights(limit = 50) {
  const { rows } = await query(
    'SELECT * FROM insights ORDER BY id DESC LIMIT $1',
    [limit],
  )
  return rows
}

module.exports = {
  classifyArticles,
  listInsights,
  getInsightsByIds,
  recentInsights,
}
