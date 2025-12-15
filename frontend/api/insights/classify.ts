import type { VercelRequest, VercelResponse } from '@vercel/node'
import { allowCORS, buildInsights } from '../_mockData'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (allowCORS(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const insights = buildInsights()
  return res.status(200).json({ term: 'demo', count: insights.length, insights })
}
