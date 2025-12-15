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

const newsApiBase = import.meta.env.VITE_NEWS_API ?? 'http://localhost:19081'
const insightsApiBase = import.meta.env.VITE_INSIGHTS_API ?? 'http://localhost:19090'
const analysisApiBase = import.meta.env.VITE_ANALYSIS_API ?? 'http://localhost:19100'

const newsClient = axios.create({ baseURL: newsApiBase })
const insightsClient = axios.create({ baseURL: insightsApiBase })
const analysisClient = axios.create({ baseURL: analysisApiBase })

export interface NewsSearchResponse {
  term: string
  total_results: number
  articles: NewsArticle[]
}

export const searchNews = async (term: string, language?: string, advanced?: string) => {
  const params: Record<string, string> = { term }
  if (language) params.language = language
  if (advanced) params.advanced = advanced
  const { data } = await newsClient.get<NewsSearchResponse>('/news', { params })
  return data
}

export const classifyArticles = async (
  payload: { term?: string; articles?: Partial<NewsArticle>[]; language?: string },
) => {
  const { data } = await insightsClient.post<InsightResponse>('/insights/classify', payload)
  return data
}

export const classifyByTerm = async (term: string, language?: string) => {
  const params: Record<string, string> = { term }
  if (language) params.language = language
  const { data } = await insightsClient.get<InsightResponse>('/insights', { params })
  return data
}

export const fetchInsightsList = async (
  options: { term?: string; limit?: number; offset?: number } = {},
) => {
  const { data } = await insightsClient.get<PaginatedInsights>('/insights/list', {
    params: options,
  })
  return data
}

export const fetchInsightsHistory = async (limit = 100) => {
  const { data } = await insightsClient.get<Insight[]>("/history", { params: { limit } })
  return data
}

export const runAnalysis = async (
  payload: { term?: string; limit?: number; insight_ids?: number[] },
) => {
  const { data } = await analysisClient.post<AggregatedAnalysis>('/analysis/run', payload)
  return data
}

export const fetchAnalysisHistory = async (limit = 20) => {
  const { data } = await analysisClient.get<AnalysisHistoryItem[]>('/analysis/history', {
    params: { limit },
  })
  return data
}

export const fetchNewsArchive = async (
  options: { term?: string; source?: string; category?: string; order?: 'asc' | 'desc'; limit?: number; offset?: number } = {},
) => {
  const { data } = await newsClient.get<ArchiveResponse>('/news/archive', { params: options })
  return data
}

export const fetchNewsArchiveMeta = async (limit = 50) => {
  const { data } = await newsClient.get<ArchiveMeta>('/news/archive/meta', { params: { limit } })
  return data
}

// Aliases for compatibility with new pages
export const getInsights = fetchInsightsList
export const getAnalysisHistory = fetchAnalysisHistory
export const getAnalysis = async () => {
  const history = await fetchAnalysisHistory(1)
  return history[0] || null
}
