const { allowCORS, buildInsights } = require('../_mockData')

module.exports = function handler(req, res) {
  if (allowCORS(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const items = buildInsights()
  return res.status(200).json({ total: items.length, items })
}
