import type { VercelRequest, VercelResponse } from '@vercel/node'
import { allowCORS, buildNewsResponse } from './_mockData'

const NEWS_API_KEY = process.env.NEWS_API_KEY
const NEWS_API_URL = process.env.NEWS_API_URL || 'https://newsapi.org/v2/everything'
const DEFAULT_PAGE_SIZE = Number(process.env.GNEWS_MAX_RESULTS || 10)
const SOURCE_NAME = 'NewsAPI'

const normalizeArticle = (article: any) => ({
  source: { id: article.source?.id ?? null, name: article.source?.name ?? SOURCE_NAME },
  author: article.author ?? null,
  title: article.title ?? '',
  description: article.description ?? null,
  url: article.url ?? null,
  urlToImage: article.urlToImage ?? null,
  publishedAt: article.publishedAt ?? null,
  content: article.content ?? null,
  category: article.category ?? null,
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (allowCORS(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!NEWS_API_KEY) {
    return res.status(500).json({ error: 'NEWS_API_KEY missing in Vercel env' })
  }

  const term = (req.query.term as string)?.trim() || 'ai'
  const language = (req.query.language as string)?.trim()
  const advanced = (req.query.advanced as string)?.trim()

  try {
    const url = new URL(NEWS_API_URL)
    url.searchParams.set('q', advanced || term)
    url.searchParams.set('pageSize', String(DEFAULT_PAGE_SIZE))
    url.searchParams.set('sortBy', 'publishedAt')
    if (language) url.searchParams.set('language', language)
    const apiResp = await fetch(url.toString(), {
      headers: { 'X-Api-Key': NEWS_API_KEY },
    })
    if (!apiResp.ok) {
      const errText = await apiResp.text()
      return res.status(apiResp.status).json({ error: `NewsAPI error: ${errText}` })
    }
    const data = await apiResp.json()
    const articles = Array.isArray(data.articles) ? data.articles.map(normalizeArticle) : []
    return res.status(200).json({
      term,
      total_results: articles.length,
      articles,
    })
  } catch (error: any) {
    // Fallback to stubbed data so the UI is never empty
    console.error('news handler failed', error)
    return res.status(200).json(buildNewsResponse(term))
  }
}
