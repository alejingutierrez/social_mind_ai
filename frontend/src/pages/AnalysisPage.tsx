import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Collapse,
  Empty,
  message,
  Space,
  Tag,
  Typography,
  Divider,
  Row,
  Col,
  Alert,
} from 'antd'
import {
  BarChartOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  GlobalOutlined,
  TeamOutlined,
  FireOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { getAnalysisHistory } from '../api'
import type { AnalysisHistoryItem } from '../types'
import { motion } from 'framer-motion'

const { Title, Text, Paragraph } = Typography

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

  const renderInfoCard = (title: string, content: string | null | undefined, icon?: React.ReactNode) => {
    if (!content) return null
    return (
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Text strong>
            {icon} {title}
          </Text>
          <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-line' }}>{content}</Paragraph>
        </Space>
      </Card>
    )
  }

  const renderTagList = (title: string, content: string | null | undefined, color: string = 'blue') => {
    if (!content) return null
    const items = content.split(',').map((item) => item.trim()).filter((item) => item && item !== 'null')
    if (items.length === 0) return null

    return (
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>{title}</Text>
        <Space wrap>
          {items.map((item, idx) => (
            <Tag key={idx} color={color}>{item}</Tag>
          ))}
        </Space>
      </div>
    )
  }

  const renderQuotes = (quotes: string | null | undefined) => {
    if (!quotes) return null
    const quotesList = quotes.split('|').map((q) => q.trim()).filter((q) => q && q !== 'null')
    if (quotesList.length === 0) return null

    return (
      <Card size="small" style={{ marginBottom: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <Text strong style={{ display: 'block', marginBottom: 12 }}>💬 Citas Destacadas</Text>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {quotesList.map((quote, idx) => (
            <div key={idx} style={{ borderLeft: '3px solid var(--accent-color)', paddingLeft: 12 }}>
              <Text italic>"{quote}"</Text>
            </div>
          ))}
        </Space>
      </Card>
    )
  }

  const renderImpacts = (analysis: AnalysisHistoryItem) => {
    const hasImpacts = analysis.impacto_social_proyectado || analysis.impacto_economico_proyectado || analysis.impacto_politico_proyectado
    if (!hasImpacts) return null

    return (
      <Card size="small" title="🎯 Impactos Proyectados" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {analysis.impacto_social_proyectado && (
            <div>
              <Text strong style={{ color: '#7c3aed' }}>Social:</Text>
              <Paragraph style={{ marginTop: 4, marginBottom: 0 }}>{analysis.impacto_social_proyectado}</Paragraph>
            </div>
          )}
          {analysis.impacto_economico_proyectado && (
            <div>
              <Text strong style={{ color: '#059669' }}>Económico:</Text>
              <Paragraph style={{ marginTop: 4, marginBottom: 0 }}>{analysis.impacto_economico_proyectado}</Paragraph>
            </div>
          )}
          {analysis.impacto_politico_proyectado && (
            <div>
              <Text strong style={{ color: '#dc2626' }}>Político:</Text>
              <Paragraph style={{ marginTop: 4, marginBottom: 0 }}>{analysis.impacto_politico_proyectado}</Paragraph>
            </div>
          )}
        </Space>
      </Card>
    )
  }

  const renderScenarios = (scenarios: string | null | undefined) => {
    if (!scenarios) return null

    return (
      <Card size="small" title="🔮 Escenarios Posibles" style={{ marginBottom: 16 }}>
        <Paragraph style={{ whiteSpace: 'pre-line', marginBottom: 0 }}>{scenarios}</Paragraph>
      </Card>
    )
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0, color: '#1f2937' }}>
              📊 Análisis Periodístico
            </Title>
            <Text type="secondary">Análisis de cobertura mediática y narrativas emergentes</Text>
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
                      style={{ borderRadius: 16, border: '1px solid #f3f4f6' }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space>
                            <BarChartOutlined style={{ fontSize: 20, color: 'var(--accent-color)' }} />
                            <Title level={4} style={{ margin: 0 }}>Análisis #{analysis.id}</Title>
                          </Space>
                          <Text type="secondary">{new Date(analysis.created_at).toLocaleString()}</Text>
                        </div>

                        <Divider style={{ margin: '12px 0' }} />

                        {/* Síntesis General */}
                        {analysis.sintesis_general && (
                          <Alert
                            message="📰 Síntesis General"
                            description={<Paragraph style={{ marginTop: 8, marginBottom: 0 }}>{analysis.sintesis_general}</Paragraph>}
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                          />
                        )}

                        {/* Narrativas */}
                        <Row gutter={[16, 16]}>
                          <Col xs={24} lg={12}>
                            {renderInfoCard('📖 Narrativa Principal', analysis.narrativa_principal, <BulbOutlined />)}
                            {renderTagList('🎭 Framing', analysis.framing_predominante, 'purple')}
                            {renderTagList('📍 Narrativas Alternativas', analysis.narrativas_alternativas, 'geekblue')}
                          </Col>
                          <Col xs={24} lg={12}>
                            {renderInfoCard('⏱️ Línea Temporal', analysis.linea_temporal)}
                            {renderInfoCard('📚 Contexto Necesario', analysis.contexto_necesario)}
                          </Col>
                        </Row>

                        {/* Actores y Voces */}
                        <Card size="small" title={<><TeamOutlined /> Actores y Voces</>} style={{ background: '#fafafa' }}>
                          <Row gutter={[16, 16]}>
                            <Col xs={24} md={8}>
                              {renderTagList('Actores Principales', analysis.actores_principales, 'blue')}
                            </Col>
                            <Col xs={24} md={8}>
                              <div style={{ marginBottom: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                  <CheckCircleOutlined style={{ color: '#059669' }} /> Voces Presentes
                                </Text>
                                <Text>{analysis.voces_presentes || '—'}</Text>
                              </div>
                            </Col>
                            <Col xs={24} md={8}>
                              <div style={{ marginBottom: 16 }}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>
                                  <ExclamationCircleOutlined style={{ color: '#dc2626' }} /> Voces Ausentes
                                </Text>
                                <Text type="secondary">{analysis.voces_ausentes || 'Ninguna identificada'}</Text>
                              </div>
                            </Col>
                          </Row>
                        </Card>

                        {/* Posiciones */}
                        {analysis.posiciones_enfrentadas && (
                          <Card size="small" title="⚖️ Posiciones Enfrentadas" style={{ background: '#fef2f2' }}>
                            <Paragraph style={{ whiteSpace: 'pre-line', marginBottom: 0 }}>{analysis.posiciones_enfrentadas}</Paragraph>
                          </Card>
                        )}

                        {/* Datos y Citas */}
                        <Row gutter={[16, 16]}>
                          <Col xs={24} lg={12}>
                            {renderTagList('📊 Datos Clave', analysis.datos_clave, 'orange')}
                            {renderTagList('📄 Fuentes Primarias', analysis.fuentes_primarias, 'cyan')}
                          </Col>
                          <Col xs={24} lg={12}>
                            {renderQuotes(analysis.citas_destacadas)}
                          </Col>
                        </Row>

                        {/* Credibilidad y Calidad */}
                        <Card size="small" title={<><SafetyOutlined /> Credibilidad y Calidad</>}>
                          <Row gutter={[16, 16]}>
                            <Col xs={24} md={8}>
                              <Text strong>Credibilidad:</Text>
                              <Paragraph>{analysis.nivel_credibilidad || '—'}</Paragraph>
                            </Col>
                            <Col xs={24} md={8}>
                              <Text strong>Equilibrio:</Text>
                              <Paragraph>{analysis.equilibrio_cobertura || '—'}</Paragraph>
                            </Col>
                            <Col xs={24} md={8}>
                              <Text strong>Calidad Periodística:</Text>
                              <Paragraph>{analysis.calidad_periodistica || '—'}</Paragraph>
                            </Col>
                          </Row>
                          {analysis.verificacion_necesaria && (
                            <Alert
                              message="⚠️ Verificación Necesaria"
                              description={analysis.verificacion_necesaria}
                              type="warning"
                              showIcon
                              style={{ marginTop: 12 }}
                            />
                          )}
                        </Card>

                        {/* Sesgos */}
                        {analysis.sesgos_identificados && (
                          <Alert
                            message="🎭 Sesgos Identificados"
                            description={analysis.sesgos_identificados}
                            type="warning"
                            showIcon
                          />
                        )}

                        {/* Geografía */}
                        <Card size="small" title={<><GlobalOutlined /> Dimensión Geográfica</>}>
                          <Row gutter={[16, 16]}>
                            <Col xs={24} md={8}>
                              <Text strong>Epicentro:</Text>
                              <Paragraph>{analysis.epicentro_geografico || '—'}</Paragraph>
                            </Col>
                            <Col xs={24} md={8}>
                              <Text strong>Alcance:</Text>
                              <Tag color="blue">{analysis.alcance_geografico || 'No especificado'}</Tag>
                            </Col>
                            <Col xs={24} md={8}>
                              {renderTagList('Zonas Afectadas', analysis.zonas_afectadas, 'green')}
                            </Col>
                          </Row>
                        </Card>

                        {/* Temas y Tendencias */}
                        <Card size="small" title={<><FireOutlined /> Temas y Tendencias</>}>
                          {renderTagList('🔥 Temas Dominantes', analysis.temas_dominantes, 'red')}
                          {renderTagList('✨ Temas Emergentes', analysis.temas_emergentes, 'gold')}
                          {renderTagList('🔑 Palabras Clave', analysis.palabras_clave_frecuentes, 'purple')}
                          {renderTagList('#️⃣ Hashtags Tendencia', analysis.hashtags_tendencia, 'magenta')}
                        </Card>

                        {/* Impactos */}
                        {renderImpacts(analysis)}

                        {/* Escenarios */}
                        {renderScenarios(analysis.escenarios_posibles)}

                        {/* Eventos por Vigilar */}
                        {analysis.eventos_por_vigilar && renderInfoCard('📅 Eventos por Vigilar', analysis.eventos_por_vigilar)}

                        {/* Aspectos Ignorados */}
                        {analysis.aspectos_ignorados && (
                          <Alert
                            message="💡 Aspectos No Cubiertos"
                            description={analysis.aspectos_ignorados}
                            type="info"
                            showIcon
                          />
                        )}
                      </Space>
                    </Card>
                  ))}
                </Space>
              ),
              style: { background: '#fff', marginBottom: 12, borderRadius: 16, border: '1px solid #f3f4f6' },
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
