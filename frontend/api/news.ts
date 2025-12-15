import type { VercelRequest, VercelResponse } from '@vercel/node'
import { allowCORS, buildNewsResponse } from './_mockData'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (allowCORS(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const term = (req.query.term as string) || 'demo'
  return res.status(200).json(buildNewsResponse(term))
}
