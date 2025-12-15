import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, Col, Empty, Row, Space, Tag, Typography, Button, Skeleton, Input, Radio, Select } from 'antd'
import { fetchNewsArchive, fetchNewsArchiveMeta } from '../api'
import type { ArchiveArticle, ArchiveMeta } from '../types'
import { proxyImageUrl } from '../utils/imageProxy'

const PAGE_SIZE = 12
const { Title, Paragraph, Text } = Typography
const FALLBACK_IMG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI1MCIgZmlsbD0iI2U1ZTVlNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAiIGR5PSIuMzVlbSIgZm9udC1zaXplPSIxNnB4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij5JbWFnZW4gZGVzb24gZGlzcG9uaWJsZTwvdGV4dD48L3N2Zz4='

const ArchivePage = () => {
  const [articles, setArticles] = useState<ArchiveArticle[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [meta, setMeta] = useState<ArchiveMeta>({ sources: [], categories: [] })
  const [filters, setFilters] = useState({ term: '', source: '', category: '', order: 'desc' as 'asc' | 'desc' })
  const [appliedFilters, setAppliedFilters] = useState(filters)

  const loadArchive = async (pageNumber: number, activeFilters = appliedFilters) => {
    try {
      setLoading(true)
      const offset = (pageNumber - 1) * PAGE_SIZE
      const data = await fetchNewsArchive({
        limit: PAGE_SIZE,
        offset,
        term: activeFilters.term || undefined,
        source: activeFilters.source || undefined,
        category: activeFilters.category || undefined,
        order: activeFilters.order,
      })
      setArticles(data.articles)
      setTotal(data.total)
    } catch (error) {
      console.error('Error fetching archive', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadArchive(page, appliedFilters)
  }, [page, appliedFilters])

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const data = await fetchNewsArchiveMeta()
        setMeta(data)
      } catch (error) {
        console.error('Error fetching archive meta', error)
      }
    }
    loadMeta()
  }, [])

  const [hero, ...rest] = useMemo(() => articles, [articles])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            Hemeroteca
            <Badge count={total} style={{ background: 'var(--accent-color)' }} />
          </Space>
        }
        extra={
          <Button type="link" onClick={() => setPage(1)} disabled={loading || page === 1}>
            Volver al inicio
          </Button>
        }
        className="card-accent-border"
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={10}>
                <Input
                  placeholder="Busca texto en título y contenido"
                  value={filters.term}
                  allowClear
                  onChange={(e) => setFilters((prev) => ({ ...prev, term: e.target.value }))}
                />
              </Col>
              <Col xs={24} md={7}>
                <Select
                  allowClear
                  placeholder="Fuente"
                  value={filters.source || undefined}
                  onChange={(value) => setFilters((prev) => ({ ...prev, source: value || '' }))}
                  options={meta.sources.map((item) => ({ label: `${item.value} (${item.count})`, value: item.value }))}
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                />
              </Col>
              <Col xs={24} md={7}>
                <Select
                  allowClear
                  placeholder="Categoría"
                  value={filters.category || undefined}
                  onChange={(value) => setFilters((prev) => ({ ...prev, category: value || '' }))}
                  options={meta.categories.map((item) => ({ label: `${item.value} (${item.count})`, value: item.value }))}
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                />
              </Col>
            </Row>
            <Row gutter={[16, 16]} align="middle" justify="space-between">
              <Col>
                <Radio.Group
                  value={filters.order}
                  onChange={(e) => setFilters((prev) => ({ ...prev, order: e.target.value }))}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="desc">Más recientes</Radio.Button>
                  <Radio.Button value="asc">Más antiguas</Radio.Button>
                </Radio.Group>
              </Col>
              <Col>
                <Space>
                  <Button
                    onClick={() => {
                      const base = { term: '', source: '', category: '', order: 'desc' as 'asc' | 'desc' }
                      setFilters(base)
                      setAppliedFilters(base)
                      setPage(1)
                    }}
                    disabled={loading}
                  >
                    Limpiar
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => {
                      setAppliedFilters(filters)
                      setPage(1)
                    }}
                    loading={loading}
                    style={{ color: '#fff' }}
                  >
                    Aplicar filtros
                  </Button>
                </Space>
              </Col>
            </Row>
          </Space>
        </div>

        {loading && (
          <Row gutter={[16, 16]}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <Col xs={24} md={12} lg={8} key={idx}>
                <Card>
                  <Skeleton active avatar paragraph={{ rows: 3 }} />
                </Card>
              </Col>
            ))}
          </Row>
        )}

        {!loading && !articles.length && <Empty description="Aún no hay noticias guardadas" />}

        {!loading && articles.length > 0 && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {hero && (
              <Card
                hoverable
                cover={
                  hero.urlToImage ? (
                    <img
                      src={proxyImageUrl(hero.urlToImage) ?? FALLBACK_IMG}
                      alt={hero.title ?? 'news'}
                      style={{ maxHeight: 340, objectFit: 'cover' }}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.src = FALLBACK_IMG
                      }}
                    />
                  ) : undefined
                }
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color="orange">{hero.source?.name ?? 'Fuente desconocida'}</Tag>
                    {hero.category && <Tag color="blue">{hero.category}</Tag>}
                    {hero.term && <Tag>{hero.term}</Tag>}
                  </Space>
                  <Title level={3} style={{ marginBottom: 8 }}>
                    {hero.title}
                  </Title>
                  <Paragraph type="secondary" ellipsis={{ rows: 4 }}>
                    {hero.description || hero.content}
                  </Paragraph>
                  <Text type="secondary">
                    {hero.publishedAt
                      ? new Date(hero.publishedAt).toLocaleString()
                      : new Date(hero.saved_at).toLocaleString()}
                  </Text>
                  {hero.url && (
                    <a href={hero.url} target="_blank" rel="noreferrer">
                      Ver artículo completo →
                    </a>
                  )}
                </Space>
              </Card>
            )}

            <Row gutter={[16, 16]}>
              {rest.map((article, idx) => (
                <Col xs={24} md={12} lg={8} key={`${article.url}-${idx}`}>
                  <Card
                    hoverable
                    cover={
                      article.urlToImage ? (
                        <img
                          src={proxyImageUrl(article.urlToImage) ?? FALLBACK_IMG}
                          alt={article.title ?? 'news'}
                          style={{ height: 180, objectFit: 'cover' }}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = FALLBACK_IMG
                          }}
                        />
                      ) : undefined
                    }
                  >
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Space wrap>
                        <Tag color="orange">{article.source?.name ?? 'Fuente desconocida'}</Tag>
                        {article.category && <Tag color="blue">{article.category}</Tag>}
                      </Space>
                      <Title level={5} ellipsis={{ rows: 2 }}>
                        {article.title}
                      </Title>
                      <Paragraph ellipsis={{ rows: 3 }} type="secondary">
                        {article.description || article.content}
                      </Paragraph>
                      <Text type="secondary">
                        {article.publishedAt
                          ? new Date(article.publishedAt).toLocaleString()
                          : new Date(article.saved_at).toLocaleString()}
                      </Text>
                      {article.url && (
                        <a href={article.url} target="_blank" rel="noreferrer">
                          Ver artículo →
                        </a>
                      )}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <Text type="secondary">
                Página {page} de {totalPages}
              </Text>
              <Button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          </Space>
        )}
      </Card>
    </Space>
  )
}

export default ArchivePage
