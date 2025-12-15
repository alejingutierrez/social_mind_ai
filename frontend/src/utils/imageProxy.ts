const normalizeBase = (value?: string | null) => {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

const envProxyBase = normalizeBase(import.meta.env.VITE_IMAGE_PROXY as string | undefined)
const runtimeProxyBase =
  typeof window !== 'undefined' && import.meta.env.PROD ? normalizeBase(`${window.location.origin}/api`) : null
const newsApiBase = normalizeBase(import.meta.env.VITE_NEWS_API as string | undefined)

const proxyBase = envProxyBase ?? runtimeProxyBase ?? (newsApiBase && newsApiBase.includes('/api') ? newsApiBase : null)

const buildProxyUrl = (base: string, target: string) => {
  const normalized = base.endsWith('/proxy-image') ? base : `${base}/proxy-image`
  return `${normalized}?url=${encodeURIComponent(target)}`
}

export const proxyImageUrl = (url?: string | null) => {
  if (!url) return null
  if (!proxyBase) return url
  return buildProxyUrl(proxyBase, url)
}
