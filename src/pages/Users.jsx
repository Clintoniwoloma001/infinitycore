import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { logAction } from '../services/supabaseService'
import { StatusBadge } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import { ROLE_METADATA, ROLES } from '../constants/roles'

export default function Users() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const { name: userName } = useAuth()

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      setUsers(data || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const changeRole = async (u, role) => {
    await supabase.from('profiles').update({ role }).eq('id', u.id)
    await logAction({ action: 'user_role_changed', entityType: 'User', entityId: u.id, details: `${u.email} → ${role}`, userName, severity: 'critical' })
    load()
  }

  return (
    <div>
      <div className="mb-6"><h2 className="text-2xl font-semibold text-slate-900">User Management</h2><p className="text-sm text-slate-500 mt-1">Manage roles and access</p></div>
      {loading ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-[#009944] rounded-full animate-spin" /></div> : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-6 py-3 font-medium">Email</th><th className="px-6 py-3 font-medium">Role</th><th className="px-6 py-3 font-medium text-right">Change Role</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-800">{u.email || u.id}</td>
                  <td className="px-6 py-3"><StatusBadge label={ROLE_METADATA[u.role]?.label || u.role || 'Staff'} color={ROLE_METADATA[u.role]?.color || '#6b7280'} /></td>
                  <td className="px-6 py-3 text-right">
                    <select value={u.role || 'staff'} onChange={(e) => changeRole(u, e.target.value)} className="h-9 rounded-md border border-slate-300 px-2 text-sm">
                      {Object.values(ROLES).map((r) => (
                        <option key={r} value={r}>{ROLE_METADATA[r]?.label || r}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
