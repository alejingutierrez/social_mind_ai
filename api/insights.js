const { fetchNews, saveArticles } = require('../serverless_lib/news')
const { classifyArticles } = require('../serverless_lib/insights')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const term = (req.query.term || '').trim()
  const language = (req.query.language || '').trim()
  if (!term) return res.status(400).json({ error: 'term is required' })

  try {
    const news = await fetchNews(term, language)
    await saveArticles(term, news.articles, 'newsapi')
    const insights = await classifyArticles(term, news.articles)
    return res.status(200).json({ term, count: insights.length, insights })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return res.status(502).json({ error: message })
  }
}
