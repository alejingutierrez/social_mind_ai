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
