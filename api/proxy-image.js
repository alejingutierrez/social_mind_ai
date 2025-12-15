export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const target = req.query.url
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  try {
    const upstream = await fetch(target)
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` })
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.status(200).send(buffer)
  } catch (error) {
    console.warn('proxy-image failed', error)
    return res.status(502).json({ error: 'Proxy failed' })
  }
}
