import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Check, X, Sparkles, AlertTriangle, Clock } from 'lucide-react'
import { leaveRequests as svc, logAction, sendDecisionEmail } from '../services/supabaseService'
import { formatDate, StatusBadge } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import SignaturePad from '../components/SignaturePad'
import {
  LEAVE_ENTITLEMENTS,
  LEAVE_TYPE_LABELS,
  getEmployeeBalances,
  balanceFor,
  deductBalance,
  restoreBalance,
  currentYear,
} from '../services/leaveBalanceService'
import { computeLeaveInsights } from '../services/leaveInsightsService'

const EMPTY = { leave_type: 'annual', start_date: '', end_date: '', reason: '' }
const daysBetween = (s, e) => (!s || !e) ? 0 : Math.max(Math.ceil((new Date(e) - new Date(s)) / 86400000) + 1, 0)

// Aging / escalation policy — adjust freely, nothing else needs to change.
const WARN_HOURS = 24       // amber "aging" indicator
const ESCALATE_HOURS = 48   // auto-bump to senior (Level 2) approval

const pendingAgeHours = (r) => (Date.now() - new Date(r.created_at).getTime()) / 3600000
const formatAge = (h) => h < 1 ? '<1h' : h < 48 ? `${Math.floor(h)}h` : `${Math.floor(h / 24)}d`

export default function LeaveRequests() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [formError, setFormError] = useState(null)
  const [deciding, setDeciding] = useState(null) // { request, decision }
  const [comment, setComment] = useState('')
  const [signature, setSignature] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [myBalances, setMyBalances] = useState([])
  const [balancesLoading, setBalancesLoading] = useState(true)

  const { name: userName, user, canApprove, isAdmin, canManageLeave } = useAuth()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await svc.list()
      setItems(data)
      await escalateStaleRequests(data)
    } catch (e) {
      setError(e?.message || 'Failed to load leave requests')
    } finally {
      setLoading(false)
    }
  }

  // Any pending, Level-1 request older than ESCALATE_HOURS gets bumped to
  // Level 2 automatically — this is what actually keeps things from
  // silently sitting forever, instead of just looking digital.
  const escalateStaleRequests = async (data) => {
    const isApprover = isAdmin || canApprove || canManageLeave
    if (!isApprover) return
    const stale = data.filter((r) => r.status === 'pending' && r.approval_level === 1 && pendingAgeHours(r) >= ESCALATE_HOURS)
    if (stale.length === 0) return
    for (const r of stale) {
      try {
        await svc.update(r.id, { approval_level: 2 })
        await logAction({ action: 'leave_escalated', entityType: 'LeaveRequest', entityId: r.id, details: `${r.employee_name} — no action after ${ESCALATE_HOURS}h, escalated to senior approval`, userName })
      } catch { /* best-effort, don't block the page on this */ }
    }
    setItems(await svc.list())
  }

  const loadMyBalances = async () => {
    if (!user) return
    setBalancesLoading(true)
    try {
      setMyBalances(await getEmployeeBalances(user.id, userName))
    } catch {
      setMyBalances([])
    } finally {
      setBalancesLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { loadMyBalances() }, [user])

  const days = daysBetween(form.start_date, form.end_date)
  const liveBalance = useMemo(() => balanceFor(myBalances, form.leave_type), [myBalances, form.leave_type])
  const insights = useMemo(() => {
    if (!deciding) return null
    return computeLeaveInsights(items, deciding.request)
  }, [deciding, items])

  const submit = async () => {
    setFormError(null)
    if (!form.start_date || !form.end_date) return setFormError('Start and end dates are required.')
    if (days <= 0) return setFormError('End date must be on or after the start date.')
    if (form.leave_type !== 'unpaid' && days > liveBalance.remaining) {
      return setFormError(`You only have ${liveBalance.remaining} day(s) of ${LEAVE_TYPE_LABELS[form.leave_type].toLowerCase()} leave remaining this year.`)
    }
    setSubmitting(true)
    try {
      const level = days > 3 ? 2 : 1
      await svc.create({
        employee_name: userName,
        leave_type: form.leave_type,
        start_date: form.start_date,
        end_date: form.end_date,
        days,
        reason: form.reason,
        status: 'pending',
        approval_level: level,
        created_by: user?.id,
      })
      await logAction({ action: 'leave_submitted', entityType: 'LeaveRequest', details: `${form.leave_type} ${days}d`, userName })
      setOpen(false)
      setForm(EMPTY)
      load()
    } catch (e) {
      setFormError(e?.message || 'Failed to submit request.')
    } finally {
      setSubmitting(false)
    }
  }

  const openDecision = (request, decision) => {
    setDeciding({ request, decision })
    setComment('')
    setSignature(null)
  }

  const confirmDecision = async () => {
    if (!deciding || !signature) return
    const { request, decision } = deciding
    setSubmitting(true)
    try {
      await svc.update(request.id, {
        status: decision,
        approved_by_name: userName,
        approved_date: new Date().toISOString(),
        approval_comments: comment,
        approver_signature: signature,
      })

      if (decision === 'approved' && request.leave_type !== 'unpaid') {
        await deductBalance(request.created_by, request.leave_type, request.days, currentYear())
      }

      await logAction({ action: `leave_${decision}`, entityType: 'LeaveRequest', entityId: request.id, details: `${request.employee_name} ${decision}`, userName })

      try {
        await sendDecisionEmail({
          recipientId: request.created_by,
          subject: `Leave ${decision}`,
          message: `Hello,\n\nYour ${request.leave_type} leave request (${request.days} day(s)) was ${decision} by ${userName}.${comment ? `\n\nComments: ${comment}` : ''}\n\n— Infinity Bank Operations`,
        })
      } catch { /* best-effort */ }

      setDeciding(null)
      setComment('')
      setSignature(null)
      load()
      loadMyBalances()
    } catch (e) {
      setFormError(e?.message || 'Failed to record decision.')
    } finally {
      setSubmitting(false)
    }
  }

  // Restore balance if a previously-approved request is later cancelled.
  const cancelApproved = async (r) => {
    if (!window.confirm('Cancel this approved leave and restore the balance?')) return
    try {
      await svc.update(r.id, { status: 'cancelled' })
      if (r.leave_type !== 'unpaid') await restoreBalance(r.created_by, r.leave_type, r.days, currentYear())
      await logAction({ action: 'leave_cancelled', entityType: 'LeaveRequest', entityId: r.id, details: `${r.employee_name} cancelled`, userName })
      load()
      loadMyBalances()
    } catch (e) {
      alert(e?.message || 'Failed to cancel.')
    }
  }

  const canAct = (r) => r.status === 'pending' && r.created_by !== user?.id && (r.approval_level === 2 ? isAdmin : canApprove)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const sc = (s) => s === 'approved' ? 'emerald' : s === 'rejected' ? 'rose' : s === 'cancelled' ? 'slate' : 'amber'

  const myQueue = useMemo(() => items.filter((r) => canAct(r)), [items, user, isAdmin, canApprove])
  const oldestPendingHours = myQueue.length ? Math.max(...myQueue.map(pendingAgeHours)) : 0
  const agingCount = myQueue.filter((r) => pendingAgeHours(r) >= WARN_HOURS).length

  return (
    <div>
      <div className="flex justify-between items-end mb-6">
        <div><h2 className="text-2xl font-semibold text-slate-900">Leave Requests</h2><p className="text-sm text-slate-500 mt-1">Multi-level approval workflow with automated balance tracking</p></div>
        <button onClick={() => { setOpen(true); setFormError(null) }} className="bg-[#009944] hover:bg-[#007a35] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1.5"><Plus className="w-4 h-4" /> Request Leave</button>
      </div>

      {/* My Leave Balance widget */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
        <h3 className="font-semibold text-slate-800 mb-3 text-sm">My Leave Balance · {currentYear()}</h3>
        {balancesLoading ? (
          <div className="text-sm text-slate-400">Loading balances…</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.keys(LEAVE_ENTITLEMENTS).filter((t) => t !== 'unpaid').map((t) => {
              const b = balanceFor(myBalances, t)
              return (
                <div key={t} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs text-slate-500">{LEAVE_TYPE_LABELS[t]}</div>
                  <div className="text-lg font-semibold text-slate-900 mt-0.5">{b.remaining}<span className="text-xs text-slate-400 font-normal"> / {b.entitled_days}d</span></div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Approver urgency banner — the "keeps this fast" signal */}
      {myQueue.length > 0 && (
        <div className={`mb-6 rounded-2xl border p-4 flex items-center gap-3 ${agingCount > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <Clock className={`w-5 h-5 shrink-0 ${agingCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          <p className="text-sm text-slate-700">
            <b>{myQueue.length}</b> request{myQueue.length === 1 ? '' : 's'} awaiting your approval
            {oldestPendingHours >= 1 && <> · oldest pending <b>{formatAge(oldestPendingHours)}</b></>}
            {agingCount > 0 && <span className="text-amber-700"> · {agingCount} aging past {WARN_HOURS}h</span>}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm p-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {error}</div>
      )}

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
                    <StatusBadge label={LEAVE_TYPE_LABELS[r.leave_type] || r.leave_type} color="violet" />
                    <StatusBadge label={r.status} color={sc(r.status)} />
                    <span className="text-xs text-slate-400">Level {r.approval_level}</span>
                    {r.status === 'pending' && (
                      <span className={`text-xs flex items-center gap-1 ${pendingAgeHours(r) >= ESCALATE_HOURS ? 'text-rose-600 font-medium' : pendingAgeHours(r) >= WARN_HOURS ? 'text-amber-600' : 'text-slate-400'}`}>
                        <Clock className="w-3 h-3" /> Pending {formatAge(pendingAgeHours(r))}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mt-1.5">{formatDate(r.start_date)} → {formatDate(r.end_date)} · <b className="text-slate-700">{r.days}d</b></div>
                  {r.reason && <p className="text-sm text-slate-400 mt-1">{r.reason}</p>}
                </div>
                <div className="flex gap-2">
                  {canAct(r) && <>
                    <button onClick={() => openDecision(r, 'rejected')} className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-sm flex items-center gap-1"><X className="w-4 h-4" /> Reject</button>
                    <button onClick={() => openDecision(r, 'approved')} className="px-3 py-1.5 rounded-lg bg-[#009944] text-white text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Approve</button>
                  </>}
                  {r.status === 'approved' && r.created_by === user?.id && (
                    <button onClick={() => cancelApproved(r)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-500 text-sm">Cancel</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Request Leave modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Request Leave</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Leave Type</label>
                <select value={form.leave_type} onChange={set('leave_type')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3">
                  {Object.keys(LEAVE_ENTITLEMENTS).map((t) => <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>)}
                </select>
                <p className="text-xs text-slate-500 mt-1.5">
                  {form.leave_type === 'unpaid' ? 'No cap — always available.' : balancesLoading ? 'Checking balance…' : `You have ${liveBalance.remaining} of ${liveBalance.entitled_days} day(s) remaining this year.`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium text-slate-700">Start *</label><input type="date" value={form.start_date} onChange={set('start_date')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
                <div><label className="text-sm font-medium text-slate-700">End *</label><input type="date" value={form.end_date} onChange={set('end_date')} className="mt-1 w-full h-10 rounded-md border border-slate-300 px-3" /></div>
              </div>
              {form.start_date && form.end_date && <p className="text-sm text-slate-500">{days} day(s) — {days > 3 ? 'senior (admin) approval' : 'manager approval'}</p>}
              <div><label className="text-sm font-medium text-slate-700">Reason</label><textarea value={form.reason} onChange={set('reason')} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></div>
              {formError && <p className="text-sm text-rose-600">{formError}</p>}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">Cancel</button>
              <button onClick={submit} disabled={submitting} className="px-4 py-2 rounded-lg bg-[#009944] text-white hover:bg-[#007a35] disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Approve/Reject decision modal — insights + signature */}
      {deciding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && setDeciding(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-slate-900 mb-1">{deciding.decision === 'approved' ? 'Approve' : 'Reject'} Leave Request</h3>
            <p className="text-sm text-slate-500 mb-4">{deciding.request.employee_name} · {LEAVE_TYPE_LABELS[deciding.request.leave_type]}</p>

            {insights && (
              <div className={`rounded-xl border p-4 mb-4 ${insights.suggestion.level === 'flag' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1.5 text-slate-600">
                  <Sparkles className="w-3.5 h-3.5" /> Insights
                </div>
                <p className="text-sm text-slate-700">{insights.summary}</p>
                <p className={`text-sm font-medium mt-2 ${insights.suggestion.level === 'flag' ? 'text-amber-700' : 'text-emerald-700'}`}>{insights.suggestion.text}</p>
              </div>
            )}

            <label className="text-sm font-medium text-slate-700">Comments {deciding.decision === 'rejected' ? '*' : '(optional)'}</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 mb-4" />

            <label className="text-sm font-medium text-slate-700">Sign to confirm *</label>
            <div className="mt-1">
              <SignaturePad onChange={setSignature} />
            </div>

            {formError && <p className="text-sm text-rose-600 mt-3">{formError}</p>}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setDeciding(null)} disabled={submitting} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600">Cancel</button>
              <button
                onClick={confirmDecision}
                disabled={submitting || !signature || (deciding.decision === 'rejected' && !comment.trim())}
                className={`px-4 py-2 rounded-lg text-white disabled:opacity-40 ${deciding.decision === 'approved' ? 'bg-[#009944] hover:bg-[#007a35]' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {submitting ? 'Saving…' : `Confirm ${deciding.decision === 'approved' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
