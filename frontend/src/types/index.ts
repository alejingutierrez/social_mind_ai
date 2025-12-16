export interface NewsArticle {
  source?: { id?: string | null; name?: string | null }
  author?: string | null
  title?: string
  description?: string | null
  url?: string | null
  urlToImage?: string | null
  publishedAt?: string | null
  content?: string | null
  category?: string | null
}

export interface ArchiveArticle extends NewsArticle {
  term?: string | null
  saved_at: string
}

export interface ArchiveResponse {
  total: number
  articles: ArchiveArticle[]
}

export interface ArchiveFacet {
  value: string
  count: number
}

export interface ArchiveMeta {
  sources: ArchiveFacet[]
  categories: ArchiveFacet[]
}

export interface Insight {
  id: number
  term: string
  sentimiento?: string | null
  resumen?: string | null
  categoria?: string | null
  etiquetas?: string | null
  marca?: string | null
  entidad?: string | null
  idioma?: string | null
  confianza?: number | null
  relevancia?: number | null
  accion_recomendada?: string | null
  cita_clave?: string | null
  // Nuevos campos para análisis enriquecido
  resumen_ejecutivo?: string | null
  tono?: string | null
  temas_principales?: string | null
  subtemas?: string | null
  stakeholders?: string | null
  impacto_social?: string | null
  impacto_economico?: string | null
  impacto_politico?: string | null
  palabras_clave_contextuales?: string | null
  trending_topics?: string | null
  analisis_competitivo?: string | null
  credibilidad_fuente?: number | null
  sesgo_detectado?: string | null
  localizacion_geografica?: string | null
  fuentes_citadas?: string | null
  datos_numericos?: string | null
  urgencia?: string | null
  audiencia_objetivo?: string | null
  // Campos del artículo
  article_title?: string | null
  article_description?: string | null
  article_content?: string | null
  article_url?: string | null
  article_image?: string | null
  created_at: string
}

export interface InsightResponse {
  term: string
  count: number
  insights: Insight[]
}

export interface PaginatedInsights {
  total: number
  items: Insight[]
}

export interface SummaryItem {
  titulo?: string | null
  descripcion?: string | null
}

export interface AggregatedAnalysis {
  analysis_id?: number | null
  term?: string | null
  count: number
  insights: SummaryItem[]
  oportunidades_negocio: SummaryItem[]
  riesgos_reputacionales: SummaryItem[]
}

export interface AnalysisHistoryItem extends AggregatedAnalysis {
  id: number
  created_at: string
  insight_ids: number[]
}

export type AggregatedResponse = AggregatedAnalysis
