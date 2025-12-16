const { archiveMeta } = require('../../../serverless_lib/news')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  try {
    const meta = await archiveMeta(limit)
    return res.status(200).json(meta)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return res.status(502).json({ error: message })
  }
}
