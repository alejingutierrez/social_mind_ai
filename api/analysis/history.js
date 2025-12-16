const { listAnalysis } = require('../../serverless_lib/analysis')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  try {
    const rows = await listAnalysis(limit)
    const mapped = rows.map((row) => {
      const payload = typeof row.result_json === 'string' ? JSON.parse(row.result_json) : row.result_json
      return {
        id: row.id,
        analysis_id: row.id,
        term: row.term,
        count: row.count,
        insights: payload?.insights || [],
        oportunidades_negocio: payload?.oportunidades_negocio || [],
        riesgos_reputacionales: payload?.riesgos_reputacionales || [],
        created_at: row.created_at,
        insight_ids: row.insight_ids || [],
        // Enriched analysis fields
        sintesis_general: row.sintesis_general,
        narrativa_principal: row.narrativa_principal,
        narrativas_alternativas: row.narrativas_alternativas,
        framing_predominante: row.framing_predominante,
        linea_temporal: row.linea_temporal,
        contexto_necesario: row.contexto_necesario,
        actores_principales: row.actores_principales,
        voces_presentes: row.voces_presentes,
        voces_ausentes: row.voces_ausentes,
        posiciones_enfrentadas: row.posiciones_enfrentadas,
        puntos_de_consenso: row.puntos_de_consenso,
        puntos_de_conflicto: row.puntos_de_conflicto,
        datos_clave: row.datos_clave,
        fuentes_primarias: row.fuentes_primarias,
        citas_destacadas: row.citas_destacadas,
        tono_general_cobertura: row.tono_general_cobertura,
        equilibrio_cobertura: row.equilibrio_cobertura,
        calidad_periodistica: row.calidad_periodistica,
        nivel_credibilidad: row.nivel_credibilidad,
        consistencia_hechos: row.consistencia_hechos,
        verificacion_necesaria: row.verificacion_necesaria,
        sesgos_identificados: row.sesgos_identificados,
        lenguaje_cargado: row.lenguaje_cargado,
        epicentro_geografico: row.epicentro_geografico,
        alcance_geografico: row.alcance_geografico,
        zonas_afectadas: row.zonas_afectadas,
        temas_dominantes: row.temas_dominantes,
        temas_emergentes: row.temas_emergentes,
        palabras_clave_frecuentes: row.palabras_clave_frecuentes,
        hashtags_tendencia: row.hashtags_tendencia,
        impacto_social_proyectado: row.impacto_social_proyectado,
        impacto_politico_proyectado: row.impacto_politico_proyectado,
        impacto_economico_proyectado: row.impacto_economico_proyectado,
        escenarios_posibles: row.escenarios_posibles,
        eventos_por_vigilar: row.eventos_por_vigilar,
        aspectos_ignorados: row.aspectos_ignorados,
        audiencia_objetivo_agregada: row.audiencia_objetivo_agregada,
        nivel_tecnico: row.nivel_tecnico,
      }
    })
    return res.status(200).json(mapped)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return res.status(502).json({ error: message })
  }
}
