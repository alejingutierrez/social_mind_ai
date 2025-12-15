import { allowCORS, buildAnalysis } from '../_mockData.js'

export default function handler(req, res) {
  if (allowCORS(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const payload = buildAnalysis()
  return res.status(200).json(payload)
}
