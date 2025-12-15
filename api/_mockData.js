const sampleArticles = [
  {
    source: { name: 'Mock Times' },
    author: 'Equipo Social Mind',
    title: 'Demo: conectando frontend sin backend real',
    description: 'Este es un stub servido desde Vercel para evitar llamadas a localhost.',
    url: 'https://social-mind-ai.vercel.app/mock/demo',
    urlToImage:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    publishedAt: new Date().toISOString(),
    content: 'Contenido simulado para pruebas.',
    category: 'demo',
  },
]

export const buildNewsResponse = (term) => ({
  term,
  total_results: sampleArticles.length,
  articles: sampleArticles,
})

export const buildInsights = () => {
  const now = new Date().toISOString()
  return [
    {
      id: 1,
      term: 'demo',
      sentimiento: 'neutral',
      resumen: 'Contenido simulado (stub) porque el backend no está disponible.',
      categoria: 'demo',
      etiquetas: 'stub,vercel',
      marca: 'Social Mind',
      entidad: 'Demo',
      article_title: sampleArticles[0].title,
      article_description: sampleArticles[0].description,
      article_content: sampleArticles[0].content,
      article_url: sampleArticles[0].url,
      article_image: sampleArticles[0].urlToImage,
      created_at: now,
    },
  ]
}

export const buildAnalysis = () => {
  const now = new Date().toISOString()
  return {
    analysis_id: 1,
    term: 'demo',
    count: 1,
    insights: [{ titulo: 'Insight de ejemplo', descripcion: 'Resultado simulado desde stub.' }],
    oportunidades_negocio: [{ titulo: 'Oportunidad', descripcion: 'Prueba sin backend real.' }],
    riesgos_reputacionales: [{ titulo: 'Riesgo', descripcion: 'Prueba sin backend real.' }],
    created_at: now,
    insight_ids: [1],
  }
}

export const notFound = (res) => res.status(404).json({ error: 'Not found' })

export const allowCORS = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return true
  }
  return false
}
