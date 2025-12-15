const { allowCORS } = require('../../_mockData')

module.exports = function handler(req, res) {
  if (allowCORS(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  return res.status(200).json({
    sources: [{ value: 'NewsAPI', count: 1 }],
    categories: [{ value: 'demo', count: 1 }],
  })
}
