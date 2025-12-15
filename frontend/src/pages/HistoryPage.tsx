import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  List,
  message,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import {
  FolderOpenOutlined,
  FileTextOutlined,
  RightOutlined
} from '@ant-design/icons'
import { getInsights } from '../api'
import type { Insight } from '../types'
import { motion } from 'framer-motion'

const { Title, Text } = Typography
const HistoryPage = () => {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(false)
  const [activeFolder, setActiveFolder] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const insightsData = await getInsights()
      setInsights(insightsData.items)
    } catch (error) {
      console.error(error)
      message.error('Error al cargar historial')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Group insights by term (simulating folders)
  const folders = useMemo(() => {
    const names = new Set<string>()
    insights.forEach((item) => item.term && names.add(item.term))
    return Array.from(names)
  }, [insights])

  const filteredInsights = activeFolder
    ? insights.filter(i => i.term === activeFolder)
    : insights

  const insightColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: 'Término', dataIndex: 'term' },
    {
      title: 'Sentimiento',
      dataIndex: 'sentimiento',
      render: (value: string) => {
        let color = 'default';
        if (value?.toLowerCase().includes('positivo')) color = 'success';
        if (value?.toLowerCase().includes('negativo')) color = 'error';
        if (value?.toLowerCase().includes('neutro')) color = 'warning';
        return value ? <Tag color={color} style={{ borderRadius: '12px' }}>{value}</Tag> : '—';
      },
    },
    { title: 'Categoría', dataIndex: 'categoria' },
    { title: 'Resumen', dataIndex: 'resumen', ellipsis: true },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      width: 180,
      render: (val: string) => <Text type="secondary" style={{ fontSize: '12px' }}>{new Date(val).toLocaleString()}</Text>
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Title level={2} style={{ margin: 0, color: '#1f2937' }}>Historial de Actividad</Title>
      </motion.div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Folders Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card
            title={<Space><FolderOpenOutlined style={{ color: 'var(--accent-color)' }} /> Carpetas</Space>}
            style={{ width: 250, minHeight: 400, boxShadow: 'var(--shadow-md)', borderRadius: '16px' }}
            bodyStyle={{ padding: '12px' }}
          >
            <List
              dataSource={['Todas', ...folders]}
              renderItem={(item) => (
                <motion.div whileHover={{ x: 4 }}>
                  <List.Item
                    onClick={() => setActiveFolder(item === 'Todas' ? null : item)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      background: (activeFolder === item) || (item === 'Todas' && !activeFolder) ? 'rgba(240, 65, 48, 0.08)' : 'transparent',
                      borderRadius: '8px',
                      marginBottom: '4px',
                      border: 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Space>
                      {activeFolder === item ? <FolderOpenOutlined style={{ color: 'var(--accent-color)' }} /> : <RightOutlined style={{ fontSize: '10px', color: '#9ca3af' }} />}
                      <Text strong={activeFolder === item} style={{ color: activeFolder === item ? 'var(--accent-color)' : 'inherit' }}>{item}</Text>
                    </Space>
                  </List.Item>
                </motion.div>
              )}
            />
          </Card>
        </motion.div>

        {/* Content Area */}
        <div style={{ flex: 1 }}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card bordered={false} style={{ boxShadow: 'var(--shadow-md)', borderRadius: '16px', minHeight: '500px' }}>
              <Tabs
                defaultActiveKey="insights"
                items={[
                  {
                    key: 'insights',
                    label: <Space><FileTextOutlined /> Insights ({filteredInsights.length})</Space>,
                    children: (
                      <motion.div
                        key="insights-tab"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Table
                          dataSource={filteredInsights}
                          columns={insightColumns}
                          rowKey="id"
                          loading={loading}
                          pagination={{ pageSize: 8 }}
                          scroll={{ x: true }}
                        />
                      </motion.div>
                    )
                  },
                ]}
              />
            </Card>
          </motion.div>
        </div>
      </div>
    </Space>
  )
}

export default HistoryPage
