const { listInsights, getInsightsByIds } = require('../../serverless_lib/insights')
const { runAggregation, saveAnalysis } = require('../../serverless_lib/analysis')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const rawBody = req.body || {}
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody || '{}') : rawBody
    const insightIds = Array.isArray(body.insight_ids) ? body.insight_ids.map(Number).filter(Boolean) : []
    const limit = Math.min(Number(body.limit) || 6, 20)
    const term = (body.term || '').trim() || null

    let insights = []
    if (insightIds.length) {
      insights = await getInsightsByIds(insightIds)
      if (!insights.length) return res.status(404).json({ error: 'No insights found for the given ids' })
    } else {
      const list = await listInsights({ term: term || undefined, limit, offset: 0 })
      insights = list.items
      if (!insights.length) return res.status(404).json({ error: 'No insights available to analyze' })
    }

    const articles = insights.map((row) => ({
      term: row.term,
      sentimiento: row.sentimiento,
      resumen: row.resumen,
      resumen_ejecutivo: row.resumen_ejecutivo,
      categoria: row.categoria,
      etiquetas: row.etiquetas,
      marca: row.marca,
      entidad: row.entidad,
      tono: row.tono,
      temas_principales: row.temas_principales,
      subtemas: row.subtemas,
      stakeholders: row.stakeholders,
      impacto_social: row.impacto_social,
      impacto_economico: row.impacto_economico,
      impacto_politico: row.impacto_politico,
      palabras_clave_contextuales: row.palabras_clave_contextuales,
      trending_topics: row.trending_topics,
      analisis_competitivo: row.analisis_competitivo,
      credibilidad_fuente: row.credibilidad_fuente,
      sesgo_detectado: row.sesgo_detectado,
      localizacion_geografica: row.localizacion_geografica,
      fuentes_citadas: row.fuentes_citadas,
      datos_numericos: row.datos_numericos,
      urgencia: row.urgencia,
      audiencia_objetivo: row.audiencia_objetivo,
      titulo: row.article_title,
      descripcion: row.article_description,
      contenido: row.article_content,
      url: row.article_url,
      imagen: row.article_image,
      cita_clave: row.cita_clave,
      created_at: row.created_at,
    }))

    const result = await runAggregation(term, articles)
    const stored = await saveAnalysis(term, insights.map((r) => Number(r.id)), result)

    return res.status(200).json({
      analysis_id: stored.id,
      term,
      count: insights.length,
      insights: result.insights || [],
      oportunidades_negocio: result.oportunidades_negocio || [],
      riesgos_reputacionales: result.riesgos_reputacionales || [],
      // Enriched analysis fields
      sintesis_general: result.sintesis_general,
      narrativa_principal: result.narrativa_principal,
      narrativas_alternativas: result.narrativas_alternativas,
      framing_predominante: result.framing_predominante,
      linea_temporal: result.linea_temporal,
      contexto_necesario: result.contexto_necesario,
      actores_principales: result.actores_principales,
      voces_presentes: result.voces_presentes,
      voces_ausentes: result.voces_ausentes,
      posiciones_enfrentadas: result.posiciones_enfrentadas,
      puntos_de_consenso: result.puntos_de_consenso,
      puntos_de_conflicto: result.puntos_de_conflicto,
      datos_clave: result.datos_clave,
      fuentes_primarias: result.fuentes_primarias,
      citas_destacadas: result.citas_destacadas,
      tono_general_cobertura: result.tono_general_cobertura,
      equilibrio_cobertura: result.equilibrio_cobertura,
      calidad_periodistica: result.calidad_periodistica,
      nivel_credibilidad: result.nivel_credibilidad,
      consistencia_hechos: result.consistencia_hechos,
      verificacion_necesaria: result.verificacion_necesaria,
      sesgos_identificados: result.sesgos_identificados,
      lenguaje_cargado: result.lenguaje_cargado,
      epicentro_geografico: result.epicentro_geografico,
      alcance_geografico: result.alcance_geografico,
      zonas_afectadas: result.zonas_afectadas,
      temas_dominantes: result.temas_dominantes,
      temas_emergentes: result.temas_emergentes,
      palabras_clave_frecuentes: result.palabras_clave_frecuentes,
      hashtags_tendencia: result.hashtags_tendencia,
      impacto_social_proyectado: result.impacto_social_proyectado,
      impacto_politico_proyectado: result.impacto_politico_proyectado,
      impacto_economico_proyectado: result.impacto_economico_proyectado,
      escenarios_posibles: result.escenarios_posibles,
      eventos_por_vigilar: result.eventos_por_vigilar,
      aspectos_ignorados: result.aspectos_ignorados,
      audiencia_objetivo_agregada: result.audiencia_objetivo_agregada,
      nivel_tecnico: result.nivel_tecnico,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return res.status(502).json({ error: message })
  }
}
