const { allowCORS, buildNewsResponse } = require('../_mockData')

module.exports = function handler(req, res) {
  if (allowCORS(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const term = (req.query.term || '').trim() || 'demo'
  const base = buildNewsResponse(term)
  const now = new Date().toISOString()
  const articles = base.articles.map((article) => ({ ...article, term, saved_at: now }))
  return res.status(200).json({ total: articles.length, articles })
}
