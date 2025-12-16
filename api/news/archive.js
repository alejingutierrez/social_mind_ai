const { listArchive } = require('../../serverless_lib/news')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const term = (req.query.term || '').trim() || undefined
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const order = (req.query.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'

  try {
    const data = await listArchive({ term, limit, offset, order })
    return res.status(200).json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return res.status(502).json({ error: message })
  }
}
