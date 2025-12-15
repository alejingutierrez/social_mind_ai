const base = (import.meta.env.VITE_NEWS_API as string | undefined)?.replace(/\/$/, '')

export const proxyImageUrl = (url?: string | null) => {
  if (!url) return null
  if (!base) return url
  return `${base}/proxy-image?url=${encodeURIComponent(url)}`
}
