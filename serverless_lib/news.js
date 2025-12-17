const crypto = require('crypto')
const { query } = require('./db')

const NEWS_API_KEY = process.env.NEWS_API_KEY
const NEWS_API_URL = process.env.NEWS_API_URL || 'https://newsapi.org/v2/everything'
const NEWS_API_SORT_BY = process.env.NEWS_API_SORT_BY || 'publishedAt'

const GNEWS_API_KEY = process.env.GNEWS_API_KEY
const GNEWS_API_URL = process.env.GNEWS_API_URL || 'https://gnews.io/api/v4/search'
const GNEWS_MAX_RESULTS = Number(process.env.GNEWS_MAX_RESULTS || 10)

const NEWSDATA_API_KEY = process.env.NEWSDATA_API_KEY
const NEWSDATA_API_URL = process.env.NEWSDATA_API_URL || 'https://newsdata.io/api/1/latest'
const NEWSDATA_MAX_RESULTS = Number(process.env.NEWSDATA_MAX_RESULTS || 10)

const WORLDNEWS_API_KEY = process.env.WORLDNEWS_API_KEY
const WORLDNEWS_API_URL = process.env.WORLDNEWS_API_URL || 'https://api.worldnewsapi.com/search-news'
const WORLDNEWS_MAX_RESULTS = Number(process.env.WORLDNEWS_MAX_RESULTS || 10)

const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY
const GUARDIAN_API_URL = process.env.GUARDIAN_API_URL || 'https://content.guardianapis.com/search'
const GUARDIAN_MAX_RESULTS = Number(process.env.GUARDIAN_MAX_RESULTS || 10)

const NYT_API_KEY = process.env.NYT_API_KEY
const NYT_API_URL = process.env.NYT_API_URL || 'https://api.nytimes.com/svc/search/v2/articlesearch.json'

function normalizeUrl(raw) {
  if (!raw) return null
  try {
    const u = new URL(raw)
    u.search = ''
    u.hash = ''
    return u.toString()
  } catch {
    return raw
  }
}

const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const normalizeImageUrl = (raw) => {
  if (!raw) return null
  const value = String(raw).trim()
  if (!value) return null
  if (value.startsWith('//')) return `https:${value}`
  if (/^https?:\/\//i.test(value)) return value
  return `https://static01.nyt.com/${value.replace(/^\//, '')}`
}

const pickCategory = (raw) => {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const val = raw.find(Boolean)
    return val ? String(val) : null
  }
  return String(raw)
}

const mapBase = (article, fallbackSource) => ({
  source: { id: article.source?.id ?? null, name: article.source?.name ?? fallbackSource },
  author: article.author ?? null,
  title: article.title ?? article.headline?.main ?? '',
  description: article.description ?? article.abstract ?? article.trailText ?? null,
  url: article.url ?? article.webUrl ?? article.link ?? null,
  urlToImage: normalizeImageUrl(
    article.urlToImage ||
      article.image ||
      article.image_url ||
      article.imageUrl ||
      article.fields?.thumbnail ||
      article.multimedia?.[0]?.url,
  ),
  publishedAt:
    article.publishedAt ??
    article.webPublicationDate ??
    article.publish_date ??
    article.publishedAtUtc ??
    article.firstPublished ??
    article.pub_date ??
    null,
  content: article.content ?? null,
  category: pickCategory(article.category ?? article.categories ?? article.sectionName ?? article.section_name ?? article.section),
})

async function fetchNewsApi(term, language) {
  if (!NEWS_API_KEY) return []
  const url = new URL(NEWS_API_URL)
  url.searchParams.set('q', term)
  url.searchParams.set('pageSize', String(GNEWS_MAX_RESULTS))
  url.searchParams.set('sortBy', NEWS_API_SORT_BY)
  if (language) url.searchParams.set('language', language)
  const resp = await fetchWithTimeout(url.toString(), { headers: { 'X-Api-Key': NEWS_API_KEY } })
  if (!resp.ok) throw new Error(`NewsAPI ${resp.status}`)
  const data = await resp.json()
  return (data.articles || []).map((item) => mapBase(item, 'NewsAPI'))
}

async function fetchGNews(term, language) {
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

async function fetchNewsData(term, language) {
  if (!NEWSDATA_API_KEY) return []
  const url = new URL(NEWSDATA_API_URL)
  url.searchParams.set('apikey', NEWSDATA_API_KEY)
  url.searchParams.set('q', term)
  url.searchParams.set('size', String(NEWSDATA_MAX_RESULTS))
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

async function fetchWorldNews(term, language) {
  if (!WORLDNEWS_API_KEY) return []
  const url = new URL(WORLDNEWS_API_URL)
  url.searchParams.set('api-key', WORLDNEWS_API_KEY)
  url.searchParams.set('text', term)
  if (language) url.searchParams.set('language', language)
  url.searchParams.set('number', String(WORLDNEWS_MAX_RESULTS))
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

async function fetchGuardian(term) {
  if (!GUARDIAN_API_KEY) return []
  const url = new URL(GUARDIAN_API_URL)
  url.searchParams.set('api-key', GUARDIAN_API_KEY)
  url.searchParams.set('q', term)
  url.searchParams.set('page-size', String(GUARDIAN_MAX_RESULTS))
  url.searchParams.set('show-fields', 'trailText,thumbnail,body')
  const resp = await fetchWithTimeout(url.toString())
  if (!resp.ok) throw new Error(`Guardian ${resp.status}`)
  const data = await resp.json()
  return (data.response?.results || []).map((item) =>
    mapBase(
      {
        ...item,
        title: item.webTitle,
        url: item.webUrl,
        urlToImage: item.fields?.thumbnail,
        description: item.fields?.trailText,
        publishedAt: item.webPublicationDate,
      },
      'The Guardian',
    ),
  )
}

async function fetchNYT(term) {
  if (!NYT_API_KEY) return []
  const url = new URL(NYT_API_URL)
  url.searchParams.set('q', term)
  url.searchParams.set('api-key', NYT_API_KEY)
  const resp = await fetchWithTimeout(url.toString())
  if (!resp.ok) throw new Error(`NYT ${resp.status}`)
  const data = await resp.json()
  const docs = data.response?.docs || []

  return docs.map((item) => {
    try {
      // NYT multimedia structure: find first image with best quality
      let imageUrl = null
      if (Array.isArray(item.multimedia) && item.multimedia.length > 0) {
        const imageObj = item.multimedia.find(m => m && (m.subtype === 'xlarge' || m.subtype === 'superJumbo'))
        if (imageObj && imageObj.url) {
          imageUrl = imageObj.url
        } else if (item.multimedia[0] && item.multimedia[0].url) {
          imageUrl = item.multimedia[0].url
        }
      }

      return mapBase(
        {
          title: item.headline?.main || item.headline?.print_headline || '',
          url: item.web_url || '',
          urlToImage: imageUrl,
          publishedAt: item.pub_date || null,
          description: item.abstract || '',
          author: item.byline?.original || null,
          source: { name: item.source || 'The New York Times' },
          content: item.lead_paragraph || null,
        },
        'NYT',
      )
    } catch (err) {
      console.warn('Error mapping NYT article:', err.message, item.web_url)
      return null
    }
  }).filter(Boolean)
}

async function fetchNews(term, language) {
  const run = async (name, fn) => {
    try {
      return await fn()
    } catch (error) {
      console.warn(`${name} failed`, error?.message || error)
      return []
    }
  }

  const results = await Promise.all([
    run('NewsAPI', () => fetchNewsApi(term, language)),
    run('GNews', () => fetchGNews(term, language)),
    run('NewsData', () => fetchNewsData(term, language)),
    run('WorldNews', () => fetchWorldNews(term, language)),
    run('Guardian', () => fetchGuardian(term)),
    run('NYT', () => fetchNYT(term)),
  ])

  const articles = results.flat()
  const deduped = []
  const seen = new Set()
  for (const article of articles) {
    const key = normalizeUrl(article.url) || article.title || Math.random().toString()
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(article)
  }

  return {
    term,
    total_results: deduped.length,
    articles: deduped,
  }
}

async function saveArticles(term, articles, provider = 'newsapi') {
  if (!articles?.length) return []
  const rows = []
  for (const article of articles) {
    const normalizedUrl = normalizeUrl(article.url)
    const urlHash = normalizedUrl
      ? crypto.createHash('sha256').update(normalizedUrl).digest('hex')
      : crypto.randomUUID()
    const values = [
      term,
      provider,
      article.source ? JSON.stringify(article.source) : null,
      article.author || null,
      article.title || null,
      article.description || null,
      article.content || null,
      article.url || null,
      urlHash,
      article.urlToImage || article.url_to_image || null,
      article.category || null,
      article.publishedAt ? new Date(article.publishedAt) : null,
    ]
    await query(
      `
      INSERT INTO news_articles (
        term, provider, source, author, title, description, content, url,
        url_hash, url_to_image, category, published_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (url_hash) DO UPDATE SET
        term = EXCLUDED.term,
        provider = EXCLUDED.provider,
        source = EXCLUDED.source,
        author = EXCLUDED.author,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        content = EXCLUDED.content,
        url = EXCLUDED.url,
        url_to_image = COALESCE(EXCLUDED.url_to_image, news_articles.url_to_image),
        category = EXCLUDED.category,
        published_at = COALESCE(EXCLUDED.published_at, news_articles.published_at)
      `,
      values,
    )
    rows.push({
      ...article,
      term,
      provider,
      url: article.url,
      urlToImage: article.urlToImage || article.url_to_image || null,
      category: article.category || null,
      publishedAt: article.publishedAt || null,
    })
  }
  return rows
}

async function listArchive({ term, limit = 50, offset = 0, order = 'desc' }) {
  const params = []
  const where = []
  // Excluir artículos sin fecha de publicación
  where.push('published_at IS NOT NULL')
  if (term) {
    params.push(term)
    where.push(`term = $${params.length}`)
  }
  const whereClause = `WHERE ${where.join(' AND ')}`
  const totalRes = await query(`SELECT COUNT(1) FROM news_articles ${whereClause}`, params)
  const total = Number(totalRes.rows[0].count || 0)
  params.push(limit, offset)
  const orderDir = order === 'asc' ? 'ASC' : 'DESC'
  const rowsRes = await query(
    `
    SELECT * FROM news_articles
    ${whereClause}
    ORDER BY published_at ${orderDir}, created_at ${orderDir}
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  )
  // Transform database snake_case to frontend camelCase
  const articles = rowsRes.rows.map((row) => ({
    ...row,
    urlToImage: row.url_to_image,
    publishedAt: row.published_at,
    saved_at: row.created_at,
  }))
  return { total, articles }
}

async function archiveMeta(limit = 50) {
  const sourcesRes = await query(
    `
    SELECT COALESCE(source->>'name','desconocida') AS value, COUNT(1) AS count
    FROM news_articles
    GROUP BY value
    ORDER BY count DESC
    LIMIT $1
    `,
    [limit],
  )
  const categoriesRes = await query(
    `
    SELECT category AS value, COUNT(1) AS count
    FROM news_articles
    WHERE category IS NOT NULL AND category <> ''
    GROUP BY category
    ORDER BY count DESC
    LIMIT $1
    `,
    [limit],
  )
  return {
    sources: sourcesRes.rows,
    categories: categoriesRes.rows,
  }
}

module.exports = { fetchNews, saveArticles, listArchive, archiveMeta }
