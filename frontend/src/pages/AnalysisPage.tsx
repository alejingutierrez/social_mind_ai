import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Collapse,
  Empty,
  List,
  message,
  Space,
  Tag,
  Typography,
} from 'antd'
import { BarChartOutlined, FolderOpenOutlined, ReloadOutlined } from '@ant-design/icons'
import { getAnalysisHistory } from '../api'
import type { AnalysisHistoryItem } from '../types'
import { motion } from 'framer-motion'

const { Title, Text } = Typography

const AnalysisPage = () => {
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchHistory = async () => {
    try {
      setLoading(true)
      const data = await getAnalysisHistory(20)
      setHistory(data)
    } catch (error) {
      console.error(error)
      message.error('Error al cargar los análisis')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const groupedAnalyses = useMemo(() => {
    const map = new Map<string, AnalysisHistoryItem[]>()
    history.forEach((item) => {
      const key = item.term || 'Multiples términos'
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    })
    return Array.from(map.entries())
  }, [history])

  const renderSummaryList = (items: AnalysisHistoryItem['insights'], color: string) => (
    <List
      size="small"
      dataSource={items}
      renderItem={(entry) => (
        <List.Item style={{ border: 'none', padding: '4px 0' }}>
          <Text strong style={{ color }}>{entry.titulo ?? '—'}:</Text> {entry.descripcion ?? '—'}
        </List.Item>
      )}
    />
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0, color: '#1f2937' }}>Panel de Análisis</Title>
            <Text type="secondary">Explora cada análisis agrupado por carpeta/termino estratégico</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={fetchHistory} loading={loading}>
            Actualizar
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {groupedAnalyses.length ? (
          <Collapse
            bordered={false}
            defaultActiveKey={groupedAnalyses[0]?.[0]}
            expandIconPosition="end"
            items={groupedAnalyses.map(([term, analyses]) => ({
              key: term,
              label: (
                <Space>
                  <FolderOpenOutlined style={{ color: 'var(--accent-color)' }} />
                  <Text strong>{term}</Text>
                  <Tag color="volcano">{analyses.length}</Tag>
                </Space>
              ),
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {analyses.map((analysis) => (
                    <Card
                      key={analysis.id}
                      title={<Space><BarChartOutlined /> Informe #{analysis.id}</Space>}
                      extra={<Text type="secondary">{new Date(analysis.created_at).toLocaleString()}</Text>}
                      style={{ borderRadius: 16, border: '1px solid #f3f4f6' }}
                    >
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 4 }}>Insights clave</Text>
                          {renderSummaryList(analysis.insights, '#0f172a')}
                        </div>
                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 4, color: '#15803d' }}>Oportunidades</Text>
                          {renderSummaryList(analysis.oportunidades_negocio, '#15803d')}
                        </div>
                        <div>
                          <Text strong style={{ display: 'block', marginBottom: 4, color: '#b91c1c' }}>Riesgos</Text>
                          {renderSummaryList(analysis.riesgos_reputacionales, '#b91c1c')}
                        </div>
                      </Space>
                    </Card>
                  ))}
                </Space>
              ),
              style: { background: '#fff', marginBottom: 12, borderRadius: 16, border: '1px solid #f3f4f6' }
            }))}
          />
        ) : (
          <Card>
            <Empty description="Aún no hay análisis guardados" />
          </Card>
        )}
      </motion.div>
    </Space>
  )
}

export default AnalysisPage
