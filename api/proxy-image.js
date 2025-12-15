const decodeUrl = (raw) => {
  if (!raw) return null
  let value = String(raw).trim()
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(value)
      if (decoded === value) break
      value = decoded
    } catch {
      break
    }
  }
  return value
}

const upgradeHttp = (url) => {
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('http://')) return url.replace(/^http:\/\//, 'https://')
  return url
}

const originFrom = (url) => {
  try {
    const u = new URL(url)
    return u.origin
  } catch {
    return null
  }
}

const asWsrv = (url) => {
  try {
    const u = new URL(url)
    const bare = `${u.hostname}${u.pathname}${u.search}`
    return `https://wsrv.nl/?url=${encodeURIComponent(bare)}`
  } catch {
    return null
  }
}

const buildHeaders = (referer) => {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  }
  if (referer) headers.Referer = referer
  return headers
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const target = decodeUrl(req.query.url)
  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  try {
    const preferred = upgradeHttp(target)
    const candidates = Array.from(
      new Set(
        [
          preferred,
          target,
          target.startsWith('http://') ? target.replace(/^http:\/\//, 'https://') : null,
          asWsrv(preferred),
        ].filter(Boolean),
      ),
    )

    let upstream
    let lastError
    for (const candidate of candidates) {
      const attempts = [
        buildHeaders(originFrom(candidate) || 'https://social-mind-ai.vercel.app'),
        buildHeaders(null),
      ]

      /* eslint-disable no-await-in-loop */
      for (const headers of attempts) {
        try {
          const resp = await fetch(candidate, { headers, redirect: 'follow' })
          if (resp.ok) {
            upstream = resp
            break
          }
          lastError = new Error(`upstream ${resp.status}`)
        } catch (error) {
          lastError = error
          continue
        }
      }
      if (upstream) break
    }

    if (!upstream) {
      console.warn('proxy-image unable to fetch', target, lastError?.message || lastError)
      return fallback(res)
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const buffer = Buffer.from(await upstream.arrayBuffer())
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.status(200).send(buffer)
  } catch (error) {
    console.warn('proxy-image failed', error)
    return fallback(res, 502)
  }
}

const fallback = (res, status = 200) => {
  // 1x1 transparent PNG
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
  const buffer = Buffer.from(pngBase64, 'base64')
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'public, max-age=60')
  res.status(status).send(buffer)
}
