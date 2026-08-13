import React, { useEffect, useState } from 'react'
import { X, MapPin, Mail, Phone, TrendingUp } from 'lucide-react'
import { formatCurrency, StatusBadge } from '../lib/utils'
import DocumentList from './DocumentList'
import { documentService } from '../services/documentService'

/**
 * Customer360Modal Component - Comprehensive customer view for staff
 * Shows all relevant customer information, loans, documents, interactions
 * Core feature for staff-assisted customer service
 */
export default function Customer360Modal({ customer, onClose, onAction }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [documents, setDocuments] = useState([])
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      if (!customer?.id) return

      try {
        // Load customer documents
        const docs = await documentService.list('customer', customer.id)
        setDocuments(docs)
      } catch (e) {
        console.error('Failed to load documents:', e)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [customer?.id])

  if (!customer) return null

  const tabs = [
    { key: 'overview', label: 'Overview', icon: '👤' },
    { key: 'documents', label: 'Documents', icon: '📄' },
    { key: 'loans', label: 'Loans', icon: '💰' },
    { key: 'interactions', label: 'History', icon: '📋' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Customer 360</h2>
            <p className="text-xs text-slate-500 mt-0.5">Comprehensive customer profile</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Customer Header Card */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900">{customer.name}</h3>
              <div className="flex flex-wrap gap-4 mt-2 text-sm">
                <div className="flex items-center gap-1 text-slate-600">
                  <Mail className="w-4 h-4" />
                  {customer.email}
                </div>
                <div className="flex items-center gap-1 text-slate-600">
                  <Phone className="w-4 h-4" />
                  {customer.phone}
                </div>
                {customer.address && (
                  <div className="flex items-center gap-1 text-slate-600">
                    <MapPin className="w-4 h-4" />
                    {customer.address}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <StatusBadge label={customer.status || 'Active'} color="green" />
              {customer.credit_score && (
                <div className="mt-2 flex items-center gap-1 justify-end text-sm">
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                  <span className="font-semibold text-slate-900">Score: {customer.credit_score}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-slate-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-3 font-medium text-sm transition whitespace-nowrap border-b-2 ${
                activeTab === tab.key
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
              <p className="text-slate-500 mt-3">Loading customer data...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-4">Personal Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Date of Birth</p>
                        <p className="font-medium text-slate-900">
                          {customer.date_of_birth ? new Date(customer.date_of_birth).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">National ID</p>
                        <p className="font-medium text-slate-900">{customer.national_id || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Employment Status</p>
                        <p className="font-medium text-slate-900">{customer.employment_status || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Employer</p>
                        <p className="font-medium text-slate-900">{customer.employer || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Monthly Income</p>
                        <p className="font-medium text-slate-900">{formatCurrency(customer.monthly_income || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Account Number</p>
                        <p className="font-medium text-slate-900">{customer.account_number || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {customer.notes && (
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-2">Notes</h4>
                      <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded">{customer.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documents' && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-4">Uploaded Documents</h4>
                  <DocumentList documents={documents} entityType="customer" entityId={customer.id} />
                </div>
              )}

              {activeTab === 'loans' && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-4">Active Loans</h4>
                  <p className="text-sm text-slate-500">No active loans</p>
                </div>
              )}

              {activeTab === 'interactions' && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-4">Interaction History</h4>
                  <p className="text-sm text-slate-500">No interaction history</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
          <button
            onClick={() => onAction('createCase')}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
          >
            📧 Create Support Case
          </button>
          <button
            onClick={() => onAction('startLoan')}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition"
          >
            💰 Start Loan Application
          </button>
          <button onClick={onClose} className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
