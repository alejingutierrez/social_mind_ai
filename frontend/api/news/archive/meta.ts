import type { VercelRequest, VercelResponse } from '@vercel/node'
import { allowCORS } from '../../_mockData'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (allowCORS(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  return res.status(200).json({
    sources: [{ value: 'Mock Times', count: 1 }],
    categories: [{ value: 'demo', count: 1 }],
  })
}
