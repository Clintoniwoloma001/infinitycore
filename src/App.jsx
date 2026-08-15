import React from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, AuthProvider } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Loans from './pages/Loans'
import Repayments from './pages/Repayments'
import LeaveRequests from './pages/LeaveRequests'
import AuditLogs from './pages/AuditLogs'
import Users from './pages/Users'

function Protected({ children }) {
  const { user, loading, authError } = useAuth()
  if (authError) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0b0d] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-white text-xl font-semibold mb-2">Authentication system not initialized</h1>
        <p className="text-white/60 text-sm">Please check configuration.</p>
      </div>
    </div>
  )
  if (loading) return <div className="flex justify-center items-center h-screen"><div className="w-8 h-8 border-4 border-slate-200 border-t-[#009944] rounded-full animate-spin" /></div>
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

function RoleRoute({ children, roles }) {
  const { role, loading } = useAuth()
  if (loading) return null
  if (!roles.includes(role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/customers" element={<Protected><Customers /></Protected>} />
          <Route path="/loans" element={<Protected><Loans /></Protected>} />
          <Route path="/repayments" element={<Protected><Repayments /></Protected>} />
          <Route path="/leave-requests" element={<Protected><LeaveRequests /></Protected>} />
          <Route path="/audit-logs" element={<Protected><RoleRoute roles={['super_admin', 'admin']}><AuditLogs /></RoleRoute></Protected>} />
          <Route path="/users" element={<Protected><RoleRoute roles={['super_admin', 'admin']}><Users /></RoleRoute></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
