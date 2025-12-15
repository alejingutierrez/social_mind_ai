import { useState } from 'react'
import type { PropsWithChildren } from 'react'
import { Layout, Menu, Typography, Button } from 'antd'
import {
  SearchOutlined,
  BulbOutlined,
  DashboardOutlined,
  HistoryOutlined,
  ReadOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/search', label: <Link to="/search">Buscador</Link>, icon: <SearchOutlined /> },
  { key: '/insights', label: <Link to="/insights">Insights</Link>, icon: <BulbOutlined /> },
  { key: '/analysis', label: <Link to="/analysis">Análisis</Link>, icon: <DashboardOutlined /> },
  { key: '/history', label: <Link to="/history">Histórico</Link>, icon: <HistoryOutlined /> },
  { key: '/archive', label: <Link to="/archive">Hemeroteca</Link>, icon: <ReadOutlined /> },
]

const AppLayout = ({ children }: PropsWithChildren) => {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const toggleCollapse = () => setCollapsed((prev) => !prev)

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--canvas-bg)' }}>
      <Header
        style={{
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '88px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <img
            src="https://findasense.com/wp-content/themes/findasense-theme/assets/dist/assets/images/logo-findasense.svg"
            alt="Findasense"
            style={{ height: '48px', objectFit: 'contain' }}
          />
          <div style={{ width: '1px', height: '40px', background: 'rgba(255,255,255,0.35)' }} />
          <div>
            <Typography.Title level={4} style={{ margin: 0, color: '#fff', fontWeight: 500, lineHeight: 1 }}>
              Intelligence Operations Hub
            </Typography.Title>
          </div>
        </div>
      </Header>

      <Layout>
        <Sider
          width={240}
          collapsedWidth={72}
          collapsible
          collapsed={collapsed}
          trigger={null}
          style={{
            background: 'var(--sidebar-bg)',
            borderRight: '1px solid rgba(0,0,0,0.05)',
            position: 'sticky',
            top: 88,
            height: 'calc(100vh - 88px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{
              borderRight: 'none',
              background: 'transparent',
              padding: '16px 0',
              flex: 1,
              overflowY: 'auto'
            }}
            items={menuItems}
            inlineCollapsed={collapsed}
          />
          <div
            style={{
              padding: '12px 0',
              borderTop: '1px solid rgba(0,0,0,0.05)',
              marginTop: 'auto',
              textAlign: 'center'
            }}
          >
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleCollapse}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                color: '#111827'
              }}
            />
          </div>
        </Sider>

        <Layout style={{ background: 'transparent' }}>
          <Content style={{ padding: '32px', minHeight: 'calc(100vh - 88px)' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
              initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -15, filter: 'blur(5px)' }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default AppLayout
