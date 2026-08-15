import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Landmark, Wallet, CalendarDays, ScrollText, UserCog, Menu, X, LogOut,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import Logo from './Logo'

const NAV = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'branch_manager', 'operations_manager', 'loan_officer', 'relationship_manager', 'customer_service', 'hr_manager', 'hr_officer', 'staff'] },
  { label: 'Customers', path: '/customers', icon: Users, roles: ['super_admin', 'admin', 'branch_manager', 'operations_manager', 'loan_officer', 'relationship_manager', 'customer_service', 'staff'] },
  { label: 'Loans', path: '/loans', icon: Landmark, roles: ['super_admin', 'admin', 'branch_manager', 'operations_manager', 'loan_officer', 'relationship_manager', 'staff'] },
  { label: 'Repayments', path: '/repayments', icon: Wallet, roles: ['super_admin', 'admin', 'branch_manager', 'operations_manager', 'loan_officer', 'staff'] },
  { label: 'Leave Requests', path: '/leave-requests', icon: CalendarDays, roles: ['super_admin', 'admin', 'branch_manager', 'operations_manager', 'staff'] },
  { label: 'Audit Logs', path: '/audit-logs', icon: ScrollText, roles: ['super_admin', 'admin'] },
  { label: 'User Management', path: '/users', icon: UserCog, roles: ['super_admin', 'admin'] },
]

export default function Layout({ children }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { role, name, signOut } = useAuth()
  const items = NAV.filter((n) => n.roles.includes(role))

  const logout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-[#0a0b0d] text-white flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-6 h-20 border-b border-white/10">
          <Logo size={36} variant="light" />
          <button onClick={() => setOpen(false)} className="ml-auto lg:hidden text-white/60"><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => {
            const active = location.pathname === item.path
            const Icon = item.icon
            return (
              <Link key={item.path} to={item.path} onClick={() => setOpen(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${active ? 'bg-[#009944] text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`}>
                <Icon className="w-[18px] h-[18px]" /> {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-[#FF8C00] flex items-center justify-center text-black font-semibold text-sm">{name?.charAt(0)?.toUpperCase()}</div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{name}</div>
              <div className="text-[11px] text-white/50 capitalize">{role}</div>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:bg-white/5 hover:text-white">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center px-4 lg:px-8">
          <button onClick={() => setOpen(true)} className="lg:hidden text-slate-600 mr-3"><Menu className="w-6 h-6" /></button>
          <h1 className="font-semibold text-slate-800">Banking Operations</h1>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
