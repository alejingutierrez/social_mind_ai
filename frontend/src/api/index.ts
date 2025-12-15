import axios from 'axios'
import type {
  AggregatedAnalysis,
  AnalysisHistoryItem,
  Insight,
  InsightResponse,
  NewsArticle,
  PaginatedInsights,
  ArchiveResponse,
  ArchiveMeta,
} from '../types'

const isHosted = typeof window !== 'undefined' && /vercel\.app$/i.test(window.location.hostname)

const sanitizeBase = (value?: string | null) => {
  const trimmed = value?.trim()
  if (!trimmed) return null
  const lower = trimmed.toLowerCase()
  const isLocal =
    lower.startsWith('http://localhost') ||
    lower.startsWith('https://localhost') ||
    lower.includes('127.0.0.1')
  if (isHosted && isLocal) {
    // Avoid calling localhost from Vercel; surface a clearer error instead of a failed request.
    return null
  }
  return trimmed
}

const newsApiBase = sanitizeBase(import.meta.env.VITE_NEWS_API) ?? (isHosted ? null : 'http://localhost:19081')
const insightsApiBase =
  sanitizeBase(import.meta.env.VITE_INSIGHTS_API) ?? (isHosted ? null : 'http://localhost:19090')
const analysisApiBase =
  sanitizeBase(import.meta.env.VITE_ANALYSIS_API) ?? (isHosted ? null : 'http://localhost:19100')

const requireClient = (base: string | null, name: string) => {
  if (!base) {
    throw new Error(`${name}_API_UNAVAILABLE`)
  }
  return axios.create({ baseURL: base })
}

const newsClient = newsApiBase ? requireClient(newsApiBase, 'NEWS') : null
const insightsClient = insightsApiBase ? requireClient(insightsApiBase, 'INSIGHTS') : null
const analysisClient = analysisApiBase ? requireClient(analysisApiBase, 'ANALYSIS') : null

export interface NewsSearchResponse {
  term: string
  total_results: number
  articles: NewsArticle[]
}

export const searchNews = async (term: string, language?: string, advanced?: string) => {
  const params: Record<string, string> = { term }
  if (language) params.language = language
  if (advanced) params.advanced = advanced
  const client = newsClient ?? requireClient(newsApiBase, 'NEWS')
  const { data } = await client.get<NewsSearchResponse>('/news', { params })
  return data
}

export const classifyArticles = async (
  payload: { term?: string; articles?: Partial<NewsArticle>[]; language?: string },
) => {
  const client = insightsClient ?? requireClient(insightsApiBase, 'INSIGHTS')
  const { data } = await client.post<InsightResponse>('/insights/classify', payload)
  return data
}

export const classifyByTerm = async (term: string, language?: string) => {
  const params: Record<string, string> = { term }
  if (language) params.language = language
  const client = insightsClient ?? requireClient(insightsApiBase, 'INSIGHTS')
  const { data } = await client.get<InsightResponse>('/insights', { params })
  return data
}

export const fetchInsightsList = async (
  options: { term?: string; limit?: number; offset?: number } = {},
) => {
  const client = insightsClient ?? requireClient(insightsApiBase, 'INSIGHTS')
  const { data } = await client.get<PaginatedInsights>('/insights/list', {
    params: options,
  })
  return data
}

export const fetchInsightsHistory = async (limit = 100) => {
  const client = insightsClient ?? requireClient(insightsApiBase, 'INSIGHTS')
  const { data } = await client.get<Insight[]>('/history', { params: { limit } })
  return data
}

export const runAnalysis = async (
  payload: { term?: string; limit?: number; insight_ids?: number[] },
) => {
  const client = analysisClient ?? requireClient(analysisApiBase, 'ANALYSIS')
  const { data } = await client.post<AggregatedAnalysis>('/analysis/run', payload)
  return data
}

export const fetchAnalysisHistory = async (limit = 20) => {
  const client = analysisClient ?? requireClient(analysisApiBase, 'ANALYSIS')
  const { data } = await client.get<AnalysisHistoryItem[]>('/analysis/history', {
    params: { limit },
  })
  return data
}

export const fetchNewsArchive = async (
  options: { term?: string; source?: string; category?: string; order?: 'asc' | 'desc'; limit?: number; offset?: number } = {},
) => {
  const client = newsClient ?? requireClient(newsApiBase, 'NEWS')
  const { data } = await client.get<ArchiveResponse>('/news/archive', { params: options })
  return data
}

export const fetchNewsArchiveMeta = async (limit = 50) => {
  const client = newsClient ?? requireClient(newsApiBase, 'NEWS')
  const { data } = await client.get<ArchiveMeta>('/news/archive/meta', { params: { limit } })
  return data
}

// Aliases for compatibility with new pages
export const getInsights = fetchInsightsList
export const getAnalysisHistory = fetchAnalysisHistory
export const getAnalysis = async () => {
  const history = await fetchAnalysisHistory(1)
  return history[0] || null
}
