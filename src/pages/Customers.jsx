import React, { useEffect, useState } from 'react'
import { Users, Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { customers as svc, logAction } from '../services/supabaseService'
import { formatCurrency, StatusBadge } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'

const EMPTY = { name: '', email: '', phone: '', address: '', national_id: '', employment_status: 'employed', employer: '', monthly_income: '', credit_score: '', status: 'pending' }

export default function Customers() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const { name: userName, isAdmin } = useAuth()

  const load = async () => {
    setLoading(true)
    try { setItems(await svc.list()) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name) return alert('Name is required')
    setSaving(true)
    try {
      const payload = { ...form, monthly_income: Number(form.monthly_income) || 0, credit_score: Number(form.credit_score) || 0 }
      if (editing) { await svc.update(editing.id, payload); await logAction({ action: 'customer_edited', entityType: 'Customer', entityId: editing.id, details: `Edited ${form.name}`, userName }) }
      else { const c = await svc.create(payload); await logAction({ action: 'customer_created', entityType: 'Customer', entityId: c.id, details: `Created ${form.name}`, userName }) }
      setOpen(false); load()
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const remove = async (c) => {
    if (!confirm(`Delete ${c.name}?`)) return
    await svc.remove(c.id); await logAction({ action: 'customer_deleted', entityType: 'Customer', entityId: c.id, details: `Deleted ${c.name}`, userName, severity: 'warning' }); load()
  }

  const filtered = items.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-semibold text-slate-900">Customers</h2><p className="text-sm text-slate-500 mt-1">KYC-ready customer records</p></div>
        <button onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true) }} className="bg-[#009944] hover:bg-[#007a35] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" /> New Customer</button>
      </div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#009944]" />
      </div>
      {loading ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-[#009944] rounded-full animate-spin" /></div> : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-6 py-3 font-medium">Name</th><th className="px-6 py-3 font-medium">Contact</th><th className="px-6 py-3 font-medium">National ID</th><th className="px-6 py-3 font-medium">Income</th><th className="px-6 py-3 font-medium">Status</th><th className="px-6 py-3 font-medium text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3"><div className="font-medium text-slate-800">{c.name}</div><div className="text-xs text-slate-400 capitalize">{c.employment_status?.replace('_', ' ')}</div></td>
                  <td className="px-6 py-3 text-slate-600">{c.email || '—'}</td>
                  <td className="px-6 py-3 text-slate-600">{c.national_id || '—'}</td>
                  <td className="px-6 py-3 text-slate-600">{formatCurrency(c.monthly_income)}</td>
                  <td className="px-6 py-3"><StatusBadge label={c.status} color={c.status === 'active' ? 'emerald' : c.status === 'pending' ? 'amber' : 'slate'} /></td>
                  <td className="px-6 py-3"><div className="flex justify-end gap-1">
                    <button onClick={() => { setEditing(c); setForm({ ...EMPTY, ...c }); setOpen(true) }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="w-4 h-4" /></button>
                    {isAdmin && <button onClick={() => remove(c)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 className="w-4 h-4" /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h3 className="font-semibold text-slate-900 mb-4">{editing ? 'Edit Customer' : 'New Customer'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Full Name *</label><input value={form.name} onChange={set('name')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
              <div><label className="text-sm font-medium text-slate-700">Email</label><input value={form.email} onChange={set('email')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
              <div><label className="text-sm font-medium text-slate-700">Phone</label><input value={form.phone} onChange={set('phone')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
              <div className="sm:col-span-2"><label className="text-sm font-medium text-slate-700">Address</label><input value={form.address} onChange={set('address')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
              <div><label className="text-sm font-medium text-slate-700">National ID (KYC)</label><input value={form.national_id} onChange={set('national_id')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
              <div><label className="text-sm font-medium text-slate-700">Employment Status</label><select value={form.employment_status} onChange={set('employment_status')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3"><option value="employed">Employed</option><option value="self_employed">Self Employed</option><option value="unemployed">Unemployed</option><option value="retired">Retired</option></select></div>
              <div><label className="text-sm font-medium text-slate-700">Monthly Income</label><input type="number" value={form.monthly_income} onChange={set('monthly_income')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
              <div><label className="text-sm font-medium text-slate-700">Credit Score</label><input type="number" value={form.credit_score} onChange={set('credit_score')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
              <div><label className="text-sm font-medium text-slate-700">Status</label><select value={form.status} onChange={set('status')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3"><option value="pending">Pending</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-[#009944] text-white hover:bg-[#007a35] disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}