import type { VercelRequest, VercelResponse } from '@vercel/node'
import { allowCORS, buildNewsResponse } from './_mockData'

const NEWS_API_KEY = process.env.NEWS_API_KEY
const NEWS_API_URL = process.env.NEWS_API_URL || 'https://newsapi.org/v2/everything'

const GNEWS_API_KEY = process.env.GNEWS_API_KEY
const GNEWS_API_URL = process.env.GNEWS_API_URL || 'https://gnews.io/api/v4/search'
const GNEWS_MAX_RESULTS = Number(process.env.GNEWS_MAX_RESULTS || 10)

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY
const NEWSDATA_API_URL = process.env.NEWSDATA_API_URL || 'https://newsdata.io/api/1/latest'

const WORLDNEWS_API_KEY = process.env.WORLDNEWS_API_KEY
const WORLDNEWS_API_URL = process.env.WORLDNEWS_API_URL || 'https://api.worldnewsapi.com/search-news'

const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY
const GUARDIAN_API_URL = process.env.GUARDIAN_API_URL || 'https://content.guardianapis.com/search'

const NYT_API_KEY = process.env.NYT_API_KEY
const NYT_API_URL = process.env.NYT_API_URL || 'https://api.nytimes.com/svc/search/v2/articlesearch.json'

const normalizeUrl = (url?: string | null) => {
  if (!url) return null
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`.replace(/\/$/, '')
  } catch {
    return url
  }
}

const mapBase = (article: any, fallbackSource: string) => ({
  source: { id: article.source?.id ?? null, name: article.source?.name ?? fallbackSource },
  author: article.author ?? null,
  title: article.title ?? article.headline?.main ?? '',
  description: article.description ?? article.abstract ?? article.trailText ?? null,
  url: article.url ?? article.webUrl ?? (article.link ?? null),
  urlToImage: article.urlToImage ?? article.image_url ?? article.fields?.thumbnail ?? null,
  publishedAt: article.publishedAt ?? article.publishedAtUtc ?? article.firstPublished ?? article.pub_date ?? null,
  content: article.content ?? null,
  category: article.category ?? null,
})

const fetchNewsApi = async (term: string, language?: string, advanced?: string) => {
  if (!NEWS_API_KEY) return []
  const url = new URL(NEWS_API_URL)
  url.searchParams.set('q', advanced || term)
  url.searchParams.set('pageSize', String(GNEWS_MAX_RESULTS))
  url.searchParams.set('sortBy', 'publishedAt')
  if (language) url.searchParams.set('language', language)
  const resp = await fetch(url.toString(), { headers: { 'X-Api-Key': NEWS_API_KEY } })
  if (!resp.ok) throw new Error(`NewsAPI ${resp.status}`)
  const data = await resp.json()
  return (data.articles || []).map((item: any) => mapBase(item, 'NewsAPI'))
}

const fetchGNews = async (term: string, language?: string) => {
  if (!GNEWS_API_KEY) return []
  const url = new URL(GNEWS_API_URL)
  url.searchParams.set('q', term)
  url.searchParams.set('lang', language || 'en')
  url.searchParams.set('max', String(GNEWS_MAX_RESULTS))
  url.searchParams.set('token', GNEWS_API_KEY)
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`GNews ${resp.status}`)
  const data = await resp.json()
  return (data.articles || []).map((item: any) => mapBase(item, 'GNews'))
}

const fetchNewsData = async (term: string, language?: string) => {
  if (!NEWSDATA_API_KEY) return []
  const url = new URL(NEWSDATA_API_URL)
  url.searchParams.set('apikey', NEWSDATA_API_KEY)
  url.searchParams.set('q', term)
  if (language) url.searchParams.set('language', language)
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`NewsData.io ${resp.status}`)
  const data = await resp.json()
  return (data.results || []).map((item: any) =>
    mapBase(
      {
        ...item,
        urlToImage: item.image_url,
        publishedAt: item.pubDate,
        description: item.description,
        source: { name: item.source_id },
      },
      'NewsData',
    ),
  )
}

const fetchWorldNews = async (term: string, language?: string) => {
  if (!WORLDNEWS_API_KEY) return []
  const url = new URL(WORLDNEWS_API_URL)
  url.searchParams.set('api-key', WORLDNEWS_API_KEY)
  url.searchParams.set('text', term)
  if (language) url.searchParams.set('language', language)
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`WorldNews ${resp.status}`)
  const data = await resp.json()
  return (data.news || []).map((item: any) =>
    mapBase(
      {
        ...item,
        url: item.url,
        urlToImage: item.image,
        publishedAt: item.publish_date,
      },
      'World News',
    ),
  )
}

const fetchGuardian = async (term: string) => {
  if (!GUARDIAN_API_KEY) return []
  const url = new URL(GUARDIAN_API_URL)
  url.searchParams.set('api-key', GUARDIAN_API_KEY)
  url.searchParams.set('q', term)
  url.searchParams.set('show-fields', 'trailText,thumbnail')
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`Guardian ${resp.status}`)
  const data = await resp.json()
  return (data.response?.results || []).map((item: any) =>
    mapBase(
      {
        ...item,
        url: item.webUrl,
        urlToImage: item.fields?.thumbnail,
        description: item.fields?.trailText,
        publishedAt: item.webPublicationDate,
      },
      'The Guardian',
    ),
  )
}

const fetchNYT = async (term: string) => {
  if (!NYT_API_KEY) return []
  const url = new URL(NYT_API_URL)
  url.searchParams.set('q', term)
  url.searchParams.set('api-key', NYT_API_KEY)
  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`NYT ${resp.status}`)
  const data = await resp.json()
  return (data.response?.docs || []).map((item: any) =>
    mapBase(
      {
        ...item,
        url: item.web_url,
        urlToImage: item.multimedia?.[0]?.url,
        publishedAt: item.pub_date,
        description: item.abstract,
        source: { name: item.source },
      },
      'NYT',
    ),
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (allowCORS(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const term = (req.query.term as string)?.trim() || 'ai'
  const language = (req.query.language as string)?.trim()
  const advanced = (req.query.advanced as string)?.trim()

  const tasks = [
    fetchNewsApi(term, language, advanced),
    fetchGNews(term, language),
    fetchNewsData(term, language),
    fetchWorldNews(term, language),
    fetchGuardian(term),
    fetchNYT(term),
  ]

  try {
    const settled = await Promise.allSettled(tasks)
    const articles: any[] = []
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        articles.push(...result.value)
      } else {
        console.warn('Provider failed', result.reason)
      }
    }
    const deduped: any[] = []
    const seen = new Set<string>()
    for (const article of articles) {
      const key = normalizeUrl(article.url) || article.title || Math.random().toString()
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(article)
    }

    if (deduped.length === 0) {
      // Fallback to stub so UI shows algo útil
      const fallback = buildNewsResponse(term)
      return res.status(200).json(fallback)
    }

    return res.status(200).json({
      term,
      total_results: deduped.length,
      articles: deduped,
    })
  } catch (error: any) {
    console.error('news handler fatal', error)
    return res.status(200).json(buildNewsResponse(term))
  }
}
