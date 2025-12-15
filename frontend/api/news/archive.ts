import type { VercelRequest, VercelResponse } from '@vercel/node'
import { allowCORS, buildNewsResponse } from '../_mockData'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (allowCORS(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const term = (req.query.term as string) || 'demo'
  const base = buildNewsResponse(term)
  const now = new Date().toISOString()
  const articles = base.articles.map((article) => ({ ...article, term, saved_at: now }))
  return res.status(200).json({ total: articles.length, articles })
}
