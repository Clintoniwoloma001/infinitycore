// Supabase Edge Function: escalate-leave-requests
//
// Runs on a schedule (see the pg_cron setup in the accompanying SQL file,
// not on page load). Finds every pending, Level-1 leave request older than
// ESCALATE_HOURS and bumps it to Level 2, logs an audit entry, and writes
// an in-app notification to every admin/super_admin/hr_manager.
//
// This is the real "server always watching" version — it fires whether
// or not anyone has the app open.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ESCALATE_HOURS = 48

Deno.serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const cutoff = new Date(Date.now() - ESCALATE_HOURS * 3600000).toISOString()

  const { data: stale, error: fetchError } = await supabase
    .from('leave_requests')
    .select('id, employee_name, created_at')
    .eq('status', 'pending')
    .eq('approval_level', 1)
    .lt('created_at', cutoff)

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })
  }

  if (!stale || stale.length === 0) {
    return new Response(JSON.stringify({ escalated: 0 }), { status: 200 })
  }

  const { data: approvers } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'super_admin', 'hr_manager'])

  for (const r of stale) {
    await supabase.from('leave_requests').update({ approval_level: 2 }).eq('id', r.id)

    await supabase.from('audit_logs').insert({
      action: 'leave_escalated',
      entity_type: 'LeaveRequest',
      entity_id: r.id,
      details: `${r.employee_name} — no action after ${ESCALATE_HOURS}h, auto-escalated to senior approval`,
      user_name: 'System (scheduled)',
      severity: 'warning',
    })

    if (approvers) {
      const notifications = approvers.map((a) => ({
        user_id: a.id,
        title: 'Leave request escalated',
        message: `${r.employee_name}'s leave request has been pending ${ESCALATE_HOURS}h+ and now needs senior approval.`,
        type: 'leave_escalation',
        link: '/leave-requests',
      }))
      await supabase.from('notifications').insert(notifications)
    }
  }

  return new Response(JSON.stringify({ escalated: stale.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
