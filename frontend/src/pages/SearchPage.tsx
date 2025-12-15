import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Empty,
  Input,
  message,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Collapse,
  Tooltip,
} from 'antd'
import { classifyArticles, searchNews } from '../api'
import type { Insight, NewsArticle } from '../types'
import { useNavigate } from 'react-router-dom'
import ProgressModal from '../components/ProgressModal'

const { Title, Paragraph, Text } = Typography
const FALLBACK_IMG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI1MCIgZmlsbD0iI2U1ZTVlNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAiIGR5PSIuMzVlbSIgZm9udC1zaXplPSIxNnB4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5JbWFnZW4gZGVzb24gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4='

const languageOptions = [
  { label: 'Todos los idiomas', value: '' },
  { label: 'Español', value: 'es' },
  { label: 'Inglés', value: 'en' },
  { label: 'Francés', value: 'fr' },
  { label: 'Portugués', value: 'pt' },
]

const SearchPage = () => {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [language, setLanguage] = useState('')
  const [advanced, setAdvanced] = useState('')
  const [news, setNews] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
const [classifying, setClassifying] = useState(false)
const [results, setResults] = useState<Insight[]>([])
const [hasSearched, setHasSearched] = useState(false)
const [progress, setProgress] = useState({ open: false, title: '', current: 0, total: 0, message: '' })

  const mapApiError = (error: unknown, fallback: string) => {
    const messageText = error instanceof Error ? error.message : ''
    if (messageText.includes('NEWS_API_UNAVAILABLE')) {
      return 'El backend de noticias no está accesible desde Vercel. Configura VITE_NEWS_API apuntando a un host público (no localhost).'
    }
    if (messageText.includes('INSIGHTS_API_UNAVAILABLE')) {
      return 'El backend de insights no está accesible. Ajusta VITE_INSIGHTS_API a una URL pública.'
    }
    if (messageText.includes('ANALYSIS_API_UNAVAILABLE')) {
      return 'El backend de análisis no está accesible. Ajusta VITE_ANALYSIS_API a una URL pública.'
    }
    return fallback
  }

  const toggleAll = () => {
    if (!news.length) return
    if (selected.size === news.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(news.map((_, idx) => idx)))
    }
  }

  const handleSearch = async () => {
    if (!term.trim()) {
      message.warning('Escribe un término para buscar noticias')
      return
    }
    try {
      setLoading(true)
      setHasSearched(true)
      const data = await searchNews(term.trim(), language.trim() || undefined, advanced.trim() || undefined)
      const articles = data?.articles ?? []
      setNews(articles)
      setSelected(new Set())
      setResults([])
      if (!articles.length) {
        message.info('No se encontraron noticias para este término')
      }
    } catch (error) {
      console.error(error)
      message.error(mapApiError(error, 'No se pudieron obtener las noticias'))
    } finally {
      setLoading(false)
    }
  }

  const toggleSelection = (index: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(index)
      } else {
        next.delete(index)
      }
      return next
    })
  }

  const handleClassify = async () => {
    if (!selected.size) {
      message.info('Selecciona al menos una noticia para clasificar')
      return
    }
    const indices = Array.from(selected)
    try {
      setClassifying(true)
      setProgress({ open: true, title: 'Clasificando noticias', current: 0, total: indices.length, message: 'Preparando lotes...' })
      const aggregated: Insight[] = []
      for (let i = 0; i < indices.length; i++) {
        const article = news[indices[i]]
        setProgress((prev) => ({ ...prev, current: i, message: `Clasificando noticia ${i + 1} de ${indices.length}` }))
        const response = await classifyArticles({ term: term || 'custom', articles: [article] })
        aggregated.push(...response.insights)
        setProgress((prev) => ({ ...prev, current: i + 1 }))
      }
      setResults(aggregated)
      message.success(`Se clasificaron ${aggregated.length} noticias`)
      setTimeout(() => {
        setProgress({ open: false, title: '', current: 0, total: 0, message: '' })
        navigate('/insights')
      }, 800)
    } catch (error) {
      console.error(error)
      message.error(mapApiError(error, 'No se pudieron clasificar las noticias seleccionadas'))
      setProgress({ open: false, title: '', current: 0, total: 0, message: '' })
    } finally {
      setClassifying(false)
    }
  }

  const insightColumns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Término', dataIndex: 'term' },
    {
      title: 'Sentimiento',
      dataIndex: 'sentimiento',
      render: (value: string) => (value ? <Tag color="blue">{value}</Tag> : '—'),
    },
    { title: 'Categoría', dataIndex: 'categoria' },
    { title: 'Resumen', dataIndex: 'resumen' },
    { title: 'Marca', dataIndex: 'marca' },
    { title: 'Entidad', dataIndex: 'entidad' },
    {
      title: 'Creado',
      dataIndex: 'created_at',
      width: 200,
      render: (value: string) => new Date(value).toLocaleString(),
    },
  ]

  const selectedCount = selected.size
  const languageValue = useMemo(() => languageOptions.find((option) => option.value === language)?.value ?? '', [language])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card className="card-accent-border" title="Buscador de noticias" bodyStyle={{ paddingBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <Input
              value={term}
              size="large"
              placeholder="Ej. findasense, donald trump, IA"
              onChange={(event) => setTerm(event.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              size="large"
              value={languageValue}
              onChange={(value) => setLanguage(value)}
              options={languageOptions}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} md={6}>
            <Button type="primary" onClick={handleSearch} loading={loading} block size="large">
              Buscar
            </Button>
          </Col>
        </Row>
        <Paragraph type="secondary" style={{ marginTop: 12 }}>
          Selecciona las notas relevantes para generar insights automáticos con Qwen y continuar el flujo estratégico.
        </Paragraph>
        <Collapse
          bordered={false}
          style={{ background: 'transparent', marginTop: 8 }}
          items={[
            {
              key: 'adv',
              label: 'Búsqueda avanzada (AND, OR, comillas, NOT)',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Input.TextArea
                    value={advanced}
                    onChange={(e) => setAdvanced(e.target.value)}
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    placeholder='Ej: ("inteligencia artificial" AND (colombia OR méxico)) NOT futbol'
                  />
                  <Space>
                    <Tooltip title='Comillas para frases exactas, AND/OR/NOT para combinar términos. Se enviará tal cual al backend.'>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Consejo: usa comillas para frases exactas, AND/OR/NOT para combinar, y paréntesis para agrupar.
                      </Text>
                    </Tooltip>
                    {advanced && (
                      <Button size="small" onClick={() => setAdvanced('')}>
                        Limpiar avanzada
                      </Button>
                    )}
                  </Space>
                </Space>
              ),
            },
          ]}
        />
        {news.length > 0 && (
          <Row gutter={16} style={{ marginTop: 8 }}>
            <Col xs={24} md={8}>
              <Card bordered={false} style={{ background: '#fff7ed' }}>
                <Statistic
                  title="Noticias encontradas"
                  value={news.length}
                  valueStyle={{ color: 'var(--accent-color)' }}
                />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card bordered={false} style={{ background: '#fef9c3' }}>
                <Statistic title="Seleccionadas" value={selectedCount} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card bordered={false} style={{ background: '#ecfccb' }}>
                <Statistic title="Clasificaciones recientes" value={results.length} />
              </Card>
            </Col>
          </Row>
        )}
      </Card>

      {news.length > 0 ? (
        <Card
          title={
            <Space>
              Resultados
              <Badge count={news.length} style={{ backgroundColor: 'var(--accent-color)' }} />
            </Space>
          }
          extra={
            <Space>
              <Text type="secondary">{selectedCount} seleccionadas</Text>
              <Button size="small" onClick={toggleAll} disabled={!news.length}>
                {selected.size === news.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </Button>
            </Space>
          }
        >
          <Row gutter={[16, 16]}>
            {news.map((article, index) => (
              <Col xs={24} md={12} lg={8} key={`${article.url}-${index}`}>
                <Card
                  hoverable
                  cover={
                    article.urlToImage ? (
                      <img
                        src={article.urlToImage}
                        alt={article.title ?? 'news'}
                        style={{ height: 170, objectFit: 'cover' }}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.src = FALLBACK_IMG
                        }}
                      />
                    ) : undefined
                  }
                  actions={[
                    <Checkbox
                      checked={selected.has(index)}
                      onChange={(event) => toggleSelection(index, event.target.checked)}
                >
                  Usar en insights
                </Checkbox>,
              ]}
            >
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Tag color="orange">{article.source?.name ?? 'Fuente desconocida'}</Tag>
                {article.category && <Tag color="blue">{article.category}</Tag>}
                <Title level={5} ellipsis={{ rows: 2 }}>
                  {article.title}
                </Title>
                    <Paragraph ellipsis={{ rows: 3 }} type="secondary">
                      {article.description}
                    </Paragraph>
                    <Text type="secondary">
                      {article.publishedAt ? new Date(article.publishedAt).toLocaleString() : 'Fecha no disponible'}
                    </Text>
                    {article.url && (
                      <a href={article.url} target="_blank" rel="noreferrer">
                        Ver artículo completo →
                      </a>
                    )}
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
          <Divider />
          <Space>
            <Button
              type="primary"
              onClick={handleClassify}
              disabled={!selectedCount}
              loading={classifying}
              style={{ color: '#fff' }}
            >
              Clasificar selección
            </Button>
            {results.length > 0 && (
              <Button onClick={() => navigate('/insights')}>Ir a Insights</Button>
            )}
          </Space>
        </Card>
      ) : (
        hasSearched && (
          <Card>
            <Empty description="No se encontraron noticias" />
          </Card>
        )
      )}

      {results.length > 0 && (
        <Card title="Resultados del clasificador">
          <Table
            rowKey="id"
            dataSource={results}
            columns={insightColumns}
            pagination={false}
            scroll={{ x: true }}
          />
        </Card>
      )}
      <ProgressModal
        open={progress.open}
        title={progress.title}
        current={progress.current}
        total={progress.total}
        message={progress.message}
      />
    </Space>
  )
}

export default SearchPage
