import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { ROLES, ROLE_METADATA, ROLE_MODULES, ROLE_PERMISSIONS } from '../constants/roles'

/**
 * Enhanced Auth Hook with role switching for Super Admin
 * Provides authentication state, role information, and permissions
 */
export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [viewingAsRole, setViewingAsRole] = useState(null)

  const fetchProfile = async (sessionUser) => {
    if (!sessionUser) {
      setProfile(null)
      return null
    }
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).single()
      setProfile(data)
      return data
    } catch (e) {
      console.error('Error fetching profile:', e)
      return null
    }
  }

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user)
        }
      } catch (e) {
        if (mounted) setAuthError(true)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) {
        setUser(session?.user || null)
        if (session?.user) await fetchProfile(session.user)
        else setProfile(null)
      }
    })

    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setViewingAsRole(null)
  }

  // Get the effective role (actual or viewing-as)
  const actualRole = profile?.role || ROLES.STAFF
  const effectiveRole = viewingAsRole || actualRole

  // Check if user can switch views (Super Admin only)
  const canSwitchViews = actualRole === ROLES.SUPER_ADMIN

  // Get metadata for effective role
  const roleMetadata = ROLE_METADATA[effectiveRole] || ROLE_METADATA[ROLES.STAFF]

  // Get available modules for effective role
  const availableModules = ROLE_MODULES[effectiveRole] || []

  // Get permissions for effective role
  const userPermissions = ROLE_PERMISSIONS[effectiveRole] || []

  // Helper function to check single permission
  const hasPermission = (permissionKey) => userPermissions.includes(permissionKey)

  // Helper function to check multiple permissions (any)
  const hasAnyPermission = (permissions) => permissions.some((p) => userPermissions.includes(p))

  // Helper function to check multiple permissions (all)
  const hasAllPermissions = (permissions) => permissions.every((p) => userPermissions.includes(p))

  // Convenience checks for common permissions
  const permissions = {
    canReadCustomers: hasPermission('customers.read'),
    canCreateCustomers: hasPermission('customers.create'),
    canUpdateCustomers: hasPermission('customers.update'),
    canDeleteCustomers: hasPermission('customers.delete'),

    canReadLoans: hasPermission('loans.read'),
    canCreateLoans: hasPermission('loans.create'),
    canAssessLoans: hasPermission('loans.assess'),
    canApproveLow: hasPermission('loans.approve_low'),
    canApproveMedium: hasPermission('loans.approve_medium'),
    canApproveHigh: hasPermission('loans.approve_high'),
    canApproveLoan: hasPermission('loans.approve_low') || hasPermission('loans.approve_medium') || hasPermission('loans.approve_high'),
    canDisburse: hasPermission('loans.disburse'),

    canUploadDocuments: hasPermission('documents.upload'),
    canReadDocuments: hasPermission('documents.read'),
    canVerifyDocuments: hasPermission('documents.verify'),
    canDeleteDocuments: hasPermission('documents.delete'),

    canManageHR: hasPermission('hr.jobs.create') || hasPermission('hr.jobs.manage'),
    canScreenCandidates: hasPermission('hr.applications.screen'),
    canHire: hasPermission('hr.hire'),

    canCreateSupport: hasPermission('support.create'),
    canReadSupport: hasPermission('support.read'),
    canResolveSupport: hasPermission('support.resolve'),

    canManageUsers: hasPermission('admin.manage_users'),
    canViewAudit: hasPermission('admin.view_audit'),
    canManageConfig: hasPermission('admin.manage_config'),
  }

  return {
    // Auth state
    user,
    profile,
    loading,
    authError,
    signIn,
    signUp,
    signOut,

    // Role information
    actualRole,
    effectiveRole,
    role: effectiveRole, // Alias for backward compatibility
    roleMetadata,

    // Role switching (Super Admin feature)
    viewingAsRole,
    setViewingAsRole,
    canSwitchViews,

    // Modules and permissions
    availableModules,
    userPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    permissions,

    // User info
    name: profile?.full_name || user?.email || 'User',
    email: user?.email,
    isAdmin: actualRole === ROLES.ADMIN || actualRole === ROLES.SUPER_ADMIN,
    isManager: [ROLES.BRANCH_MANAGER, ROLES.OPERATIONS_MANAGER].includes(actualRole),
    isHR: [ROLES.HR_MANAGER, ROLES.HR_OFFICER].includes(actualRole),
    isCustomer: actualRole === ROLES.CUSTOMER,
    isStaff: actualRole === ROLES.STAFF,
  }
}
