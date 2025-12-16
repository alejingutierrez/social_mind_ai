import { useState, useEffect, useMemo } from 'react'
import {
  Button,
  Card,
  Collapse,
  Empty,
  message,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { DashboardOutlined, FolderOpenOutlined, ReloadOutlined } from '@ant-design/icons'
import { getInsights, runAnalysis } from '../api'
import type { Insight } from '../types'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import ProgressModal from '../components/ProgressModal'
import { proxyImageUrl } from '../utils/imageProxy'

const { Title, Paragraph, Text } = Typography
const InsightsPage = () => {
  const navigate = useNavigate()
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [progress, setProgress] = useState({ open: false, title: '', current: 0, total: 0, message: '' })

  const isUnavailable = (error: unknown) => {
    const msg = error instanceof Error ? error.message : ''
    return msg.includes('INSIGHTS_API_UNAVAILABLE') || msg.includes('ANALYSIS_API_UNAVAILABLE') || msg.includes('NEWS_API_UNAVAILABLE')
  }

  const mapApiError = (error: unknown, fallback: string) => {
    const messageText = error instanceof Error ? error.message : ''
    if (messageText.includes('INSIGHTS_API_UNAVAILABLE')) {
      return 'El backend de insights no está accesible desde Vercel. Configura VITE_INSIGHTS_API con una URL pública.'
    }
    if (messageText.includes('ANALYSIS_API_UNAVAILABLE')) {
      return 'El backend de análisis no está accesible. Ajusta VITE_ANALYSIS_API a una URL pública.'
    }
    if (messageText.includes('NEWS_API_UNAVAILABLE')) {
      return 'El backend de noticias no está accesible. Ajusta VITE_NEWS_API a una URL pública.'
    }
    return fallback
  }

  const fetchInsights = async () => {
    try {
      setLoading(true)
      const data = await getInsights()
      setInsights(data.items)
    } catch (error) {
      if (!isUnavailable(error)) {
        console.error(error)
      } else {
        console.warn(error)
      }
      message.error(mapApiError(error, 'Error al cargar insights'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [])

  const handleAnalyze = async () => {
    if (!selectedRowKeys.length) {
      message.info('Selecciona insights para analizar')
      return
    }
    const total = selectedRowKeys.length
    let interval: number | undefined
    try {
      setAnalyzing(true)
      setProgress({ open: true, title: 'Generando análisis', current: 0, total, message: 'Enviando datos al modelo...' })
      interval = window.setInterval(() => {
        setProgress((prev) => {
          const next = Math.min(prev.total - 1, prev.current + 1)
          return { ...prev, current: next, message: `Procesando ${next} de ${prev.total}` }
        })
      }, 800)
      await runAnalysis({ insight_ids: selectedRowKeys as number[], limit: total })
      message.success('Análisis completado')
      setProgress((prev) => ({ ...prev, current: prev.total, message: 'Completado' }))
      navigate('/analysis')
    } catch (error) {
      if (!isUnavailable(error)) {
        console.error(error)
      } else {
        console.warn(error)
      }
      message.error(mapApiError(error, 'Error al generar el análisis'))
    } finally {
      if (interval) window.clearInterval(interval)
      setTimeout(() => setProgress({ open: false, title: '', current: 0, total: 0, message: '' }), 600)
      setAnalyzing(false)
    }
  }

const getUrgencyColor = (urgencia?: string | null) => {
    const u = urgencia?.toLowerCase()
    if (u === 'critica') return 'red'
    if (u === 'alta') return 'orange'
    if (u === 'media') return 'gold'
    return 'green'
  }

  const getCredibilityColor = (credibilidad?: number | null) => {
    if (!credibilidad) return 'default'
    if (credibilidad >= 0.8) return 'green'
    if (credibilidad >= 0.6) return 'blue'
    if (credibilidad >= 0.4) return 'orange'
    return 'red'
  }

  const columns = [
    {
      title: 'Artículo',
      dataIndex: 'article_title',
      width: 300,
      render: (_: string, record: Insight) => (
        <Space align="start">
          {record.article_image && (
            <img
              src={proxyImageUrl(record.article_image) ?? undefined}
              alt={record.article_title ?? ''}
              style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
            />
          )}
          <div style={{ maxWidth: 220 }}>
            <Text strong>{record.article_title ?? 'Sin título'}</Text>
            <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 4, fontSize: 12 }}>
              {record.resumen_ejecutivo || record.article_description}
            </Paragraph>
            {record.article_url && (
              <a href={record.article_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                Ver artículo →
              </a>
            )}
          </div>
        </Space>
      )
    },
    {
      title: 'Sentimiento',
      dataIndex: 'sentimiento',
      width: 120,
      render: (value: string) => {
        let color = 'default'
        if (value?.toLowerCase().includes('positivo')) color = 'success'
        if (value?.toLowerCase().includes('negativo')) color = 'error'
        if (value?.toLowerCase().includes('neutro')) color = 'warning'
        return <Tag color={color}>{value || '—'}</Tag>
      },
    },
    {
      title: 'Urgencia',
      dataIndex: 'urgencia',
      width: 100,
      render: (value: string) => value ? <Tag color={getUrgencyColor(value)}>{value}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Credibilidad',
      dataIndex: 'credibilidad_fuente',
      width: 120,
      render: (value: number) => value ? (
        <Tag color={getCredibilityColor(value)}>
          {(value * 100).toFixed(0)}%
        </Tag>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tono',
      dataIndex: 'tono',
      width: 110,
      render: (value: string) => value ? <Tag>{value}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Categoría',
      dataIndex: 'categoria',
      width: 120,
      render: (value: string) => value || '—',
    },
    {
      title: 'Marca / Entidad',
      dataIndex: 'marca',
      width: 160,
      render: (_: any, record: Insight) => (
        <Space direction="vertical" size={0}>
          {record.marca && <Tag color="geekblue">{record.marca}</Tag>}
          {record.entidad && <Tag color="purple">{record.entidad}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Impacto',
      width: 100,
      render: (_: any, record: Insight) => {
        const impacts = []
        if (record.impacto_social) impacts.push('Social')
        if (record.impacto_economico) impacts.push('Económico')
        if (record.impacto_politico) impacts.push('Político')
        return impacts.length ? (
          <Space direction="vertical" size={2}>
            {impacts.map((imp) => <Tag key={imp} color="cyan" style={{ fontSize: 10 }}>{imp}</Tag>)}
          </Space>
        ) : <Text type="secondary">—</Text>
      },
    },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      width: 160,
      render: (val: string) => <Text type="secondary" style={{ fontSize: '12px' }}>{new Date(val).toLocaleString()}</Text>
    },
  ]

  const groupedInsights = useMemo(() => {
    const map = new Map<string, Insight[]>()
    insights.forEach((item) => {
      const key = item.term || 'Sin término'
      const group = map.get(key) ?? []
      group.push(item)
      map.set(key, group)
    })
    return Array.from(map.entries())
  }, [insights])

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0, color: '#1f2937' }}>Insights organizados por carpeta</Title>
            <Paragraph type="secondary">Selecciona los insights más relevantes para generar un informe estratégico</Paragraph>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchInsights} loading={loading} style={{ borderRadius: '8px' }}>
              Recargar
            </Button>
            <Button
              type="primary"
              icon={<DashboardOutlined />}
              onClick={handleAnalyze}
              loading={analyzing}
              disabled={!selectedRowKeys.length}
              style={{
                borderRadius: '8px',
                boxShadow: 'var(--shadow-glow)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.4)'
              }}
            >
              Analizar Selección ({selectedRowKeys.length})
            </Button>
          </Space>
        </div>
        <ProgressModal
          open={progress.open}
          title={progress.title}
          current={progress.current}
          total={progress.total}
          message={progress.message}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
      >
        {groupedInsights.length ? (
          <Collapse
            bordered={false}
            defaultActiveKey={groupedInsights[0]?.[0]}
            expandIconPosition="end"
            items={groupedInsights.map(([term, items]) => ({
              key: term,
              label: (
                <Space>
                  <FolderOpenOutlined style={{ color: 'var(--accent-color)' }} />
                  <Text strong>{term}</Text>
                  <Tag color="volcano">{items.length}</Tag>
                </Space>
              ),
              children: (
                <Table
                  rowSelection={rowSelection}
                  columns={columns}
                  dataSource={items}
                  rowKey="id"
                  pagination={{ pageSize: 8 }}
                  scroll={{ x: 1500 }}
                  size="small"
                  expandable={{
                    expandedRowRender: (record) => (
                      <div style={{ padding: '16px', background: '#fafafa', borderRadius: 8 }}>
                        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                          {record.resumen_ejecutivo && (
                            <div>
                              <Text strong>Resumen Ejecutivo:</Text>
                              <Paragraph style={{ marginTop: 8 }}>{record.resumen_ejecutivo}</Paragraph>
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                            {record.temas_principales && (
                              <div>
                                <Text strong>Temas Principales:</Text>
                                <div style={{ marginTop: 8 }}>
                                  {record.temas_principales.split(',').map((tema, i) => (
                                    <Tag key={i} color="blue" style={{ marginBottom: 4 }}>{tema.trim()}</Tag>
                                  ))}
                                </div>
                              </div>
                            )}

                            {record.subtemas && (
                              <div>
                                <Text strong>Subtemas:</Text>
                                <div style={{ marginTop: 8 }}>
                                  {record.subtemas.split(',').map((subtema, i) => (
                                    <Tag key={i} color="cyan" style={{ marginBottom: 4 }}>{subtema.trim()}</Tag>
                                  ))}
                                </div>
                              </div>
                            )}

                            {record.stakeholders && (
                              <div>
                                <Text strong>Stakeholders:</Text>
                                <div style={{ marginTop: 8 }}>
                                  {record.stakeholders.split(',').map((sh, i) => (
                                    <Tag key={i} color="purple" style={{ marginBottom: 4 }}>{sh.trim()}</Tag>
                                  ))}
                                </div>
                              </div>
                            )}

                            {record.localizacion_geografica && (
                              <div>
                                <Text strong>Ubicación:</Text>
                                <div style={{ marginTop: 8 }}>
                                  {record.localizacion_geografica.split(',').map((loc, i) => (
                                    <Tag key={i} color="green" style={{ marginBottom: 4 }}>{loc.trim()}</Tag>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {record.impacto_social && (
                            <div>
                              <Text strong>Impacto Social:</Text>
                              <Paragraph style={{ marginTop: 8, marginLeft: 16 }}>{record.impacto_social}</Paragraph>
                            </div>
                          )}

                          {record.impacto_economico && (
                            <div>
                              <Text strong>Impacto Económico:</Text>
                              <Paragraph style={{ marginTop: 8, marginLeft: 16 }}>{record.impacto_economico}</Paragraph>
                            </div>
                          )}

                          {record.impacto_politico && (
                            <div>
                              <Text strong>Impacto Político:</Text>
                              <Paragraph style={{ marginTop: 8, marginLeft: 16 }}>{record.impacto_politico}</Paragraph>
                            </div>
                          )}

                          {record.analisis_competitivo && (
                            <div>
                              <Text strong>Análisis Competitivo:</Text>
                              <Paragraph style={{ marginTop: 8, marginLeft: 16 }}>{record.analisis_competitivo}</Paragraph>
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                            {record.palabras_clave_contextuales && (
                              <div>
                                <Text strong>Keywords:</Text>
                                <div style={{ marginTop: 8 }}>
                                  {record.palabras_clave_contextuales.split(',').map((kw, i) => (
                                    <Tag key={i} color="magenta" style={{ marginBottom: 4 }}>{kw.trim()}</Tag>
                                  ))}
                                </div>
                              </div>
                            )}

                            {record.trending_topics && (
                              <div>
                                <Text strong>Trending Topics:</Text>
                                <div style={{ marginTop: 8 }}>
                                  {record.trending_topics.split(',').map((tt, i) => (
                                    <Tag key={i} color="volcano" style={{ marginBottom: 4 }}>{tt.trim()}</Tag>
                                  ))}
                                </div>
                              </div>
                            )}

                            {record.etiquetas && (
                              <div>
                                <Text strong>Etiquetas:</Text>
                                <div style={{ marginTop: 8 }}>
                                  {record.etiquetas.split(',').map((tag, i) => (
                                    <Tag key={i} style={{ marginBottom: 4 }}>{tag.trim()}</Tag>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {record.cita_clave && (
                            <div style={{ background: '#fff', padding: 12, borderRadius: 8, borderLeft: '4px solid var(--accent-color)' }}>
                              <Text strong>Cita Clave:</Text>
                              <Paragraph italic style={{ marginTop: 8 }}>"{record.cita_clave}"</Paragraph>
                            </div>
                          )}

                          {record.accion_recomendada && (
                            <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 8, border: '1px solid #91d5ff' }}>
                              <Text strong>Acción Recomendada:</Text>
                              <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>{record.accion_recomendada}</Paragraph>
                            </div>
                          )}

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
                            {record.sesgo_detectado && (
                              <div>
                                <Text type="secondary">Sesgo:</Text>
                                <Tag color="orange" style={{ marginLeft: 8 }}>{record.sesgo_detectado}</Tag>
                              </div>
                            )}
                            {record.audiencia_objetivo && (
                              <div>
                                <Text type="secondary">Audiencia:</Text>
                                <Tag style={{ marginLeft: 8 }}>{record.audiencia_objetivo}</Tag>
                              </div>
                            )}
                            {record.relevancia && (
                              <div>
                                <Text type="secondary">Relevancia:</Text>
                                <Tag color="gold" style={{ marginLeft: 8 }}>{record.relevancia}/5</Tag>
                              </div>
                            )}
                            {record.confianza && (
                              <div>
                                <Text type="secondary">Confianza:</Text>
                                <Tag color="blue" style={{ marginLeft: 8 }}>{(record.confianza * 100).toFixed(0)}%</Tag>
                              </div>
                            )}
                          </div>

                          {record.fuentes_citadas && (
                            <div>
                              <Text strong>Fuentes Citadas:</Text>
                              <Paragraph style={{ marginTop: 8, marginLeft: 16 }}>{record.fuentes_citadas}</Paragraph>
                            </div>
                          )}

                          {record.datos_numericos && (
                            <div>
                              <Text strong>Datos Numéricos:</Text>
                              <Paragraph style={{ marginTop: 8, marginLeft: 16 }}>{record.datos_numericos}</Paragraph>
                            </div>
                          )}
                        </Space>
                      </div>
                    ),
                    rowExpandable: () => true,
                  }}
                />
              ),
              style: { background: '#fff', marginBottom: 12, borderRadius: 16, border: '1px solid #f3f4f6' }
            }))}
          />
        ) : (
          <Card>
            <Empty description="No hay insights disponibles" />
          </Card>
        )}
      </motion.div>
    </Space>
  )
}

export default InsightsPage
