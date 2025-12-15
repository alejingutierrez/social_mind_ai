const { allowCORS, buildNewsResponse } = require('./_mockData')

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

const fetchWithTimeout = async (url, options = {}, timeoutMs = 6000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const normalizeUrl = (url) => {
  if (!url) return null
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`.replace(/\/$/, '')
  } catch {
    return url
  }
}

const mapBase = (article, fallbackSource) => ({
  source: { id: article.source?.id ?? null, name: article.source?.name ?? fallbackSource },
  author: article.author ?? null,
  title: article.title ?? article.headline?.main ?? '',
  description: article.description ?? article.abstract ?? article.trailText ?? null,
  url: article.url ?? article.webUrl ?? article.link ?? null,
  urlToImage: article.urlToImage ?? article.image_url ?? article.fields?.thumbnail ?? null,
  publishedAt: article.publishedAt ?? article.publishedAtUtc ?? article.firstPublished ?? article.pub_date ?? null,
  content: article.content ?? null,
  category: article.category ?? null,
})

const fetchNewsApi = async (term, language, advanced) => {
  if (!NEWS_API_KEY) return []
  const url = new URL(NEWS_API_URL)
  url.searchParams.set('q', advanced || term)
  url.searchParams.set('pageSize', String(GNEWS_MAX_RESULTS))
  url.searchParams.set('sortBy', 'publishedAt')
  if (language) url.searchParams.set('language', language)
  const resp = await fetchWithTimeout(url.toString(), { headers: { 'X-Api-Key': NEWS_API_KEY } })
  if (!resp.ok) throw new Error(`NewsAPI ${resp.status}`)
  const data = await resp.json()
  return (data.articles || []).map((item) => mapBase(item, 'NewsAPI'))
}

const fetchGNews = async (term, language) => {
  if (!GNEWS_API_KEY) return []
  const url = new URL(GNEWS_API_URL)
  url.searchParams.set('q', term)
  url.searchParams.set('lang', language || 'en')
  url.searchParams.set('max', String(GNEWS_MAX_RESULTS))
  url.searchParams.set('token', GNEWS_API_KEY)
  const resp = await fetchWithTimeout(url.toString())
  if (!resp.ok) throw new Error(`GNews ${resp.status}`)
  const data = await resp.json()
  return (data.articles || []).map((item) => mapBase(item, 'GNews'))
}

const fetchNewsData = async (term, language) => {
  if (!NEWSDATA_API_KEY) return []
  const url = new URL(NEWSDATA_API_URL)
  url.searchParams.set('apikey', NEWSDATA_API_KEY)
  url.searchParams.set('q', term)
  if (language) url.searchParams.set('language', language)
  const resp = await fetchWithTimeout(url.toString())
  if (!resp.ok) throw new Error(`NewsData.io ${resp.status}`)
  const data = await resp.json()
  return (data.results || []).map((item) =>
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

const fetchWorldNews = async (term, language) => {
  if (!WORLDNEWS_API_KEY) return []
  const url = new URL(WORLDNEWS_API_URL)
  url.searchParams.set('api-key', WORLDNEWS_API_KEY)
  url.searchParams.set('text', term)
  if (language) url.searchParams.set('language', language)
  const resp = await fetchWithTimeout(url.toString())
  if (!resp.ok) throw new Error(`WorldNews ${resp.status}`)
  const data = await resp.json()
  return (data.news || []).map((item) =>
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

const fetchGuardian = async (term) => {
  if (!GUARDIAN_API_KEY) return []
  const url = new URL(GUARDIAN_API_URL)
  url.searchParams.set('api-key', GUARDIAN_API_KEY)
  url.searchParams.set('q', term)
  url.searchParams.set('show-fields', 'trailText,thumbnail')
  const resp = await fetchWithTimeout(url.toString())
  if (!resp.ok) throw new Error(`Guardian ${resp.status}`)
  const data = await resp.json()
  return (data.response?.results || []).map((item) =>
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

const fetchNYT = async (term) => {
  if (!NYT_API_KEY) return []
  const url = new URL(NYT_API_URL)
  url.searchParams.set('q', term)
  url.searchParams.set('api-key', NYT_API_KEY)
  const resp = await fetchWithTimeout(url.toString())
  if (!resp.ok) throw new Error(`NYT ${resp.status}`)
  const data = await resp.json()
  return (data.response?.docs || []).map((item) => {
    const rawImage = item.multimedia?.[0]?.url
    const fullImage =
      rawImage && rawImage.startsWith('http')
        ? rawImage
        : rawImage
          ? `https://www.nytimes.com/${rawImage.replace(/^\\//, '')}`
          : null
    return mapBase(
      {
        ...item,
        url: item.web_url,
        urlToImage: fullImage,
        publishedAt: item.pub_date,
        description: item.abstract,
        source: { name: item.source },
      },
      'NYT',
    )
  })
}

export default async function handler(req, res) {
  if (allowCORS(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const pickParam = (value, fallback = '') => {
      const raw = Array.isArray(value) ? value[0] : value
      if (raw === undefined || raw === null) return fallback
      return String(raw)
    }

    const term = pickParam(req.query.term).trim() || 'ai'
    const language = pickParam(req.query.language).trim() || undefined
    const advanced = pickParam(req.query.advanced).trim() || undefined

    const runProvider = async (name, fn) => {
      try {
        return await fn()
      } catch (error) {
        console.warn(`${name} failed`, error?.message || error)
        return []
      }
    }

  const tasks = [
    runProvider('NewsAPI', () => fetchNewsApi(term, language, advanced)),
    runProvider('GNews', () => fetchGNews(term, language)),
    runProvider('NewsData', () => fetchNewsData(term, language)),
    runProvider('WorldNews', () => fetchWorldNews(term, language)),
    runProvider('Guardian', () => fetchGuardian(term)),
    runProvider('NYT', () => fetchNYT(term)),
  ]

    const results = await Promise.all(tasks)
    const articles = results.flat()
    const deduped = []
    const seen = new Set()
    for (const article of articles) {
      const key = normalizeUrl(article.url) || article.title || Math.random().toString()
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(article)
    }

    if (deduped.length === 0) {
      return res.status(200).json(buildNewsResponse(term))
    }

    return res.status(200).json({
      term,
      total_results: deduped.length,
      articles: deduped,
    })
  } catch (error) {
    console.error('news handler fatal', error)
    return res.status(200).json(buildNewsResponse('demo'))
  }
}
