const { fetchNews, saveArticles } = require('../../serverless_lib/news')
const { classifyArticles } = require('../../serverless_lib/insights')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const rawBody = req.body || {}
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody || '{}') : rawBody
    const term = (body.term || '').trim()
    const language = (body.language || '').trim()
    const articles = Array.isArray(body.articles) ? body.articles : null

    let targetTerm = term
    let sourceArticles = articles

    if (!sourceArticles || sourceArticles.length === 0) {
      if (!term) return res.status(400).json({ error: 'term or articles required' })
      const news = await fetchNews(term, language)
      await saveArticles(term, news.articles, 'newsapi')
      sourceArticles = news.articles
    }
    if (!targetTerm) {
      targetTerm = 'custom'
    }

    const insights = await classifyArticles(targetTerm, sourceArticles)
    return res.status(200).json({ term: targetTerm, count: insights.length, insights })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return res.status(502).json({ error: message })
  }
}
