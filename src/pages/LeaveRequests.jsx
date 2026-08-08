import React, { useEffect, useState } from 'react'
import { Plus, Check, X } from 'lucide-react'
import { leaveRequests as svc, logAction, sendDecisionEmail } from '../services/supabaseService'
import { formatDate, StatusBadge } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'

const EMPTY = { leave_type: 'annual', start_date: '', end_date: '', reason: '' }
const daysBetween = (s, e) => (!s || !e) ? 0 : Math.max(Math.ceil((new Date(e) - new Date(s)) / 86400000) + 1, 0)

export default function LeaveRequests() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [rejecting, setRejecting] = useState(null)
  const [comment, setComment] = useState('')
  const { name: userName, user, canApprove, isAdmin } = useAuth()

  const load = async () => { setLoading(true); try { setItems(await svc.list()) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!form.start_date || !form.end_date) return alert('Dates required')
    const days = daysBetween(form.start_date, form.end_date)
    const level = days > 3 ? 2 : 1
    await svc.create({ employee_name: userName, leave_type: form.leave_type, start_date: form.start_date, end_date: form.end_date, days, reason: form.reason, status: 'pending', approval_level: level })
    await logAction({ action: 'leave_submitted', entityType: 'LeaveRequest', details: `${form.leave_type} ${days}d`, userName })
    setOpen(false); setForm(EMPTY); load()
  }

  const decide = async (r, decision) => {
    await svc.update(r.id, { status: decision, approved_by_name: userName, approved_date: new Date().toISOString(), approval_comments: comment })
    await logAction({ action: `leave_${decision}`, entityType: 'LeaveRequest', entityId: r.id, details: `${r.employee_name} ${decision}`, userName })
    try { await sendDecisionEmail({ recipientId: r.created_by, subject: `Leave ${decision}`, message: `Hello,\n\nYour ${r.leave_type} leave request (${r.days} day(s)) was ${decision} by ${userName}.${comment ? `\n\nComments: ${comment}` : ''}\n\n— Infinity Bank Operations` }) } catch { /* best-effort */ }
    setRejecting(null); setComment(''); load()
  }

  const canAct = (r) => r.status === 'pending' && r.created_by !== user?.id && (r.approval_level === 2 ? isAdmin : canApprove)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const sc = (s) => s === 'approved' ? 'emerald' : s === 'rejected' ? 'rose' : s === 'cancelled' ? 'slate' : 'amber'

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-semibold text-slate-900">Leave Requests</h2><p className="text-sm text-slate-500 mt-1">Multi-level approval workflow</p></div>
        <button onClick={() => setOpen(true)} className="bg-[#009944] hover:bg-[#007a35] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" /> Request Leave</button>
      </div>
      {loading ? <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-[#009944] rounded-full animate-spin" /></div> : items.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No leave requests.</div>
      ) : (
        <div className="space-y-4">
          {items.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{r.employee_name}</h3>
                    <StatusBadge label={r.leave_type} color="violet" />
                    <StatusBadge label={r.status} color={sc(r.status)} />
                    <span className="text-xs text-slate-400">Level {r.approval_level}</span>
                  </div>
                  <div className="text-sm text-slate-500 mt-1.5">{formatDate(r.start_date)} → {formatDate(r.end_date)} · <b className="text-slate-700">{r.days}d</b></div>
                  {r.reason && <p className="text-sm text-slate-400 mt-1">{r.reason}</p>}
                </div>
                {canAct(r) && <div className="flex gap-2">
                  <button onClick={() => { setRejecting(r); setComment('') }} className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-sm flex items-center gap-1"><X className="w-4 h-4" /> Reject</button>
                  <button onClick={() => decide(r, 'approved')} className="px-3 py-1.5 rounded-lg bg-[#009944] text-white text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Approve</button>
                </div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Request Leave</h3>
            <div className="space-y-4">
              <div><label className="text-sm font-medium text-slate-700">Leave Type</label><select value={form.leave_type} onChange={set('leave_type')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3"><option value="annual">Annual</option><option value="sick">Sick</option><option value="personal">Personal</option><option value="maternity">Maternity</option><option value="unpaid">Unpaid</option></select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-700">Start *</label><input type="date" value={form.start_date} onChange={set('start_date')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
                <div><label className="text-sm font-medium text-slate-700">End *</label><input type="date" value={form.end_date} onChange={set('end_date')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
              </div>
              {form.start_date && form.end_date && <p className="text-sm text-slate-500">{daysBetween(form.start_date, form.end_date)} day(s) — {daysBetween(form.start_date, form.end_date) > 3 ? 'senior (admin) approval' : 'manager approval'}</p>}
              <div><label className="text-sm font-medium text-slate-700">Reason</label><textarea value={form.reason} onChange={set('reason')} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">Cancel</button>
              <button onClick={submit} className="px-4 py-2 rounded-lg bg-[#009944] text-white hover:bg-[#007a35]">Submit</button>
            </div>
          </div>
        </div>
      )}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRejecting(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Reject Leave Request</h3>
            <label className="text-sm font-medium text-slate-700">Reason</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setRejecting(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">Cancel</button>
              <button onClick={() => decide(rejecting, 'rejected')} className="px-4 py-2 rounded-lg bg-rose-600 text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}