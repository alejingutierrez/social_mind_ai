import { allowCORS, buildInsights } from '../_mockData.js'

export default function handler(req, res) {
  if (allowCORS(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const insights = buildInsights()
  return res.status(200).json({ term: 'demo', count: insights.length, insights })
}
