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

const columns = [
  {
    title: 'Artículo',
    dataIndex: 'article_title',
    render: (_: string, record: Insight) => (
      <Space align="start">
        {record.article_image && (
          <img
            src={record.article_image}
            alt={record.article_title ?? ''}
            style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }}
          />
        )}
        <div>
          <Text strong>{record.article_title ?? 'Sin título'}</Text>
          <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 4 }}>
            {record.article_description}
          </Paragraph>
          {record.article_url && (
            <a href={record.article_url} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
              Ver artículo original →
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
    title: 'Categoría',
    dataIndex: 'categoria',
    width: 120,
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
    title: 'Contenido (extracto)',
    dataIndex: 'article_content',
    ellipsis: true,
    render: (value: string) => (value ? `${value.slice(0, 140)}...` : '—'),
  },
  {
    title: 'Fecha',
    dataIndex: 'created_at',
    width: 180,
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
                  scroll={{ x: 1200 }}
                  size="small"
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
