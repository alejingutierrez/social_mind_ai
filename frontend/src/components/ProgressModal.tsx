import { Modal, Progress, Typography } from 'antd'

const { Title, Text } = Typography

interface ProgressModalProps {
  open: boolean
  title: string
  current: number
  total: number
  message?: string
}

const ProgressModal = ({ open, title, current, total, message }: ProgressModalProps) => {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0

  return (
    <Modal
      open={open}
      footer={null}
      closable={false}
      centered
      width={520}
      maskClosable={false}
      styles={{ mask: { backgroundColor: 'rgba(18,18,18,0.85)' }, body: { padding: '32px' } }}
    >
      <Title level={4} style={{ marginBottom: 16 }}>
        {title}
      </Title>
      <Progress percent={percent} status={percent === 100 ? 'success' : 'active'} />
      {total > 0 && (
        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
          {message || `Procesando ${current} de ${total}`}
        </Text>
      )}
    </Modal>
  )
}

export default ProgressModal
