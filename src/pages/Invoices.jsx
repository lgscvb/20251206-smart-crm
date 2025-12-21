import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { callTool, db } from '../services/api'
import DataTable from '../components/DataTable'
import { StatusBadge } from '../components/Badge'
import useStore from '../store/useStore'
import {
  FileText,
  Plus,
  Search,
  XCircle,
  Percent,
  Calendar,
  Building2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'

// 發票狀態對應
const INVOICE_STATUS = {
  issued: { label: '已開立', color: 'green' },
  voided: { label: '已作廢', color: 'red' },
  allowance: { label: '已折讓', color: 'yellow' }
}

export default function Invoices() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)
  const [activeTab, setActiveTab] = useState('list') // list, pending, stats
  const [branchFilter, setBranchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [pageSize, setPageSize] = useState(20)

  // Modal 狀態
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showVoidModal, setShowVoidModal] = useState(false)
  const [showAllowanceModal, setShowAllowanceModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)

  // 處理 URL 參數（從收款頁面跳轉過來）
  const paymentIdFromUrl = searchParams.get('payment_id')

  // 取得分館列表
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => db.getBranches()
  })

  // 如果有 URL 參數 payment_id，查詢該筆 payment 資料
  const { data: paymentFromUrl } = useQuery({
    queryKey: ['payment-for-invoice', paymentIdFromUrl],
    queryFn: async () => {
      const response = await db.query('payments', {
        id: `eq.${paymentIdFromUrl}`,
        select: 'id,customer_id,branch_id,payment_period,amount,due_date,paid_at,payment_method,notes,invoice_number,invoice_date,invoice_status,customer:customers(name,company_name,company_tax_id),branch:branches(name)'
      })
      return response?.[0] || null
    },
    enabled: !!paymentIdFromUrl
  })

  // 當從 URL 載入的 payment 資料準備好，自動開啟開立發票 Modal
  useEffect(() => {
    if (paymentFromUrl && !paymentFromUrl.invoice_number) {
      setSelectedPayment(paymentFromUrl)
      setShowCreateModal(true)
      // 清除 URL 參數，避免重複開啟
      setSearchParams({})
    } else if (paymentFromUrl && paymentFromUrl.invoice_number) {
      // 已經開過發票了，顯示提示
      addNotification({ type: 'info', message: `此筆繳費已開立發票：${paymentFromUrl.invoice_number}` })
      setSearchParams({})
    }
  }, [paymentFromUrl, setSearchParams, addNotification])

  // 取得發票列表（已付款的繳費記錄）
  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['invoices', branchFilter, statusFilter, dateRange],
    queryFn: async () => {
      const params = {
        payment_status: 'eq.paid',
        order: 'paid_at.desc',
        limit: 500,
        select: 'id,customer_id,branch_id,payment_period,amount,due_date,paid_at,payment_method,notes,invoice_number,invoice_date,invoice_status,customer:customers(name,company_name,company_tax_id),branch:branches(name)'
      }

      if (branchFilter) params.branch_id = `eq.${branchFilter}`
      // 發票狀態篩選
      if (statusFilter === 'issued') params.invoice_number = 'not.is.null'
      if (statusFilter === 'pending') params.invoice_number = 'is.null'
      if (dateRange.start) params.paid_at = `gte.${dateRange.start}`
      if (dateRange.end) {
        if (params.paid_at) {
          params.paid_at = `${params.paid_at},lte.${dateRange.end}T23:59:59`
        } else {
          params.paid_at = `lte.${dateRange.end}T23:59:59`
        }
      }

      const response = await db.query('payments', params)
      return response
    }
  })

  // 開立發票
  const createInvoiceMutation = useMutation({
    mutationFn: async (data) => {
      return callTool('invoice_create', data)
    },
    onSuccess: (response) => {
      const result = response?.result || response
      if (result.success) {
        addNotification({ type: 'success', message: `發票開立成功！發票號碼：${result.invoice_number}` })
        queryClient.invalidateQueries(['invoices'])
        setShowCreateModal(false)
        setSelectedPayment(null)
      } else {
        addNotification({ type: 'error', message: `開立失敗：${result.message}` })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `開立失敗：${error.message}` })
    }
  })

  // 作廢發票
  const voidInvoiceMutation = useMutation({
    mutationFn: async (data) => {
      return callTool('invoice_void', data)
    },
    onSuccess: (response) => {
      const result = response?.result || response
      if (result.success) {
        addNotification({ type: 'success', message: `發票 ${result.invoice_number} 已作廢` })
        queryClient.invalidateQueries(['invoices'])
        setShowVoidModal(false)
        setSelectedPayment(null)
      } else {
        addNotification({ type: 'error', message: `作廢失敗：${result.message}` })
      }
    }
  })

  // 開立折讓
  const allowanceMutation = useMutation({
    mutationFn: async (data) => {
      return callTool('invoice_allowance', data)
    },
    onSuccess: (response) => {
      const result = response?.result || response
      if (result.success) {
        addNotification({ type: 'success', message: `折讓單開立成功！折讓單號：${result.allowance_number}` })
        queryClient.invalidateQueries(['invoices'])
        setShowAllowanceModal(false)
        setSelectedPayment(null)
      } else {
        addNotification({ type: 'error', message: `開立失敗：${result.message}` })
      }
    }
  })

  // 統計數據
  const stats = {
    total: invoices.length,
    issued: invoices.filter(i => i.invoice_number).length,
    pending: invoices.filter(i => !i.invoice_number).length,
    totalAmount: invoices.filter(i => i.invoice_number).reduce((sum, i) => sum + (i.amount || 0), 0)
  }

  // 表格欄位
  const columns = [
    {
      key: 'paid_at',
      header: '付款日期',
      accessor: 'paid_at',
      cell: (row) => (
        <span className="text-sm">
          {row.paid_at ? new Date(row.paid_at).toLocaleDateString('zh-TW') : '-'}
        </span>
      )
    },
    {
      key: 'customer',
      header: '客戶',
      accessor: 'customer',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.customer?.name || '-'}</p>
          {row.customer?.company_name && (
            <p className="text-xs text-gray-500">{row.customer.company_name}</p>
          )}
        </div>
      )
    },
    {
      key: 'branch',
      header: '分館',
      accessor: 'branch',
      cell: (row) => row.branch?.name || '-'
    },
    {
      key: 'amount',
      header: '金額',
      accessor: 'amount',
      cell: (row) => (
        <span className="font-medium text-green-600">
          ${(row.amount || 0).toLocaleString()}
        </span>
      )
    },
    {
      key: 'tax_id',
      header: '統編',
      accessor: 'customer',
      cell: (row) => row.customer?.company_tax_id || <span className="text-gray-400">無</span>
    },
    {
      key: 'invoice_number',
      header: '發票號碼',
      accessor: 'invoice_number',
      cell: (row) => row.invoice_number ? (
        <span className="font-mono text-primary-600">{row.invoice_number}</span>
      ) : (
        <span className="text-gray-400">未開立</span>
      )
    },
    {
      key: 'invoice_date',
      header: '開立日期',
      accessor: 'invoice_date',
      cell: (row) => (
        <span className="text-sm">
          {row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('zh-TW') : '-'}
        </span>
      )
    },
    {
      key: 'invoice_status',
      header: '狀態',
      accessor: 'invoice_status',
      cell: (row) => {
        if (!row.invoice_number) {
          return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">待開立</span>
        }
        const status = INVOICE_STATUS[row.invoice_status] || { label: row.invoice_status, color: 'gray' }
        return (
          <span className={`px-2 py-1 rounded-full text-xs bg-${status.color}-100 text-${status.color}-700`}>
            {status.label}
          </span>
        )
      }
    },
    {
      key: 'actions',
      header: '操作',
      accessor: 'id',
      cell: (row) => (
        <div className="flex items-center gap-1">
          {!row.invoice_number ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedPayment(row)
                setShowCreateModal(true)
              }}
              className="btn-primary text-xs py-1 px-2"
            >
              <Plus className="w-3 h-3 mr-1" />
              開立
            </button>
          ) : row.invoice_status !== 'voided' && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedPayment(row)
                  setShowVoidModal(true)
                }}
                className="btn-secondary text-xs py-1 px-2 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-3 h-3 mr-1" />
                作廢
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedPayment(row)
                  setShowAllowanceModal(true)
                }}
                className="btn-secondary text-xs py-1 px-2"
              >
                <Percent className="w-3 h-3 mr-1" />
                折讓
              </button>
            </>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-gray-500">總筆數</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-xl">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.issued}</p>
            <p className="text-sm text-gray-500">已開發票</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-yellow-100 rounded-xl">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.pending}</p>
            <p className="text-sm text-gray-500">待開發票</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-purple-100 rounded-xl">
            <FileText className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">${stats.totalAmount.toLocaleString()}</p>
            <p className="text-sm text-gray-500">發票總額</p>
          </div>
        </div>
      </div>

      {/* 篩選 */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="input w-36"
            >
              <option value="">全部分館</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-36"
            >
              <option value="">全部狀態</option>
              <option value="issued">已開發票</option>
              <option value="pending">待開發票</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="input w-36"
              placeholder="開始日期"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="input w-36"
              placeholder="結束日期"
            />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">每頁：</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="input w-20"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* 資料表 */}
      <DataTable
        columns={columns}
        data={invoices}
        loading={isLoading}
        onRefresh={refetch}
        pageSize={pageSize}
        emptyMessage="沒有發票資料"
      />

      {/* 開立發票 Modal */}
      {showCreateModal && selectedPayment && (
        <CreateInvoiceModal
          payment={selectedPayment}
          onClose={() => {
            setShowCreateModal(false)
            setSelectedPayment(null)
          }}
          onSubmit={(data) => createInvoiceMutation.mutate(data)}
          isLoading={createInvoiceMutation.isPending}
        />
      )}

      {/* 作廢發票 Modal */}
      {showVoidModal && selectedPayment && (
        <VoidInvoiceModal
          payment={selectedPayment}
          onClose={() => {
            setShowVoidModal(false)
            setSelectedPayment(null)
          }}
          onSubmit={(data) => voidInvoiceMutation.mutate(data)}
          isLoading={voidInvoiceMutation.isPending}
          addNotification={addNotification}
        />
      )}

      {/* 折讓單 Modal */}
      {showAllowanceModal && selectedPayment && (
        <AllowanceModal
          payment={selectedPayment}
          onClose={() => {
            setShowAllowanceModal(false)
            setSelectedPayment(null)
          }}
          onSubmit={(data) => allowanceMutation.mutate(data)}
          isLoading={allowanceMutation.isPending}
          addNotification={addNotification}
        />
      )}
    </div>
  )
}

// 開立發票 Modal
function CreateInvoiceModal({ payment, onClose, onSubmit, isLoading }) {
  const taxId = payment.customer?.company_tax_id
  const [invoiceType, setInvoiceType] = useState(taxId ? 'business' : 'personal')
  const [carrierType, setCarrierType] = useState('')
  const [carrierNumber, setCarrierNumber] = useState('')
  const [donateCode, setDonateCode] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      payment_id: payment.id,
      invoice_type: invoiceType,
      buyer_name: payment.customer?.company_name || payment.customer?.name,
      buyer_tax_id: invoiceType === 'business' ? taxId : null,
      carrier_type: carrierType || null,
      carrier_number: carrierNumber || null,
      donate_code: donateCode || null
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-bold mb-4">開立發票</h2>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">客戶：{payment.customer?.name}</p>
          <p className="text-sm text-gray-600">金額：${(payment.amount || 0).toLocaleString()}</p>
          {taxId && (
            <p className="text-sm text-gray-600">統編：{taxId}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">發票類型</label>
            <select
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value)}
              className="input w-full"
            >
              <option value="personal">二聯式（個人）</option>
              <option value="business" disabled={!taxId}>
                三聯式（公司）{!taxId && '- 無統編'}
              </option>
            </select>
          </div>

          {invoiceType === 'personal' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">載具類型</label>
                <select
                  value={carrierType}
                  onChange={(e) => setCarrierType(e.target.value)}
                  className="input w-full"
                >
                  <option value="">無載具（紙本）</option>
                  <option value="mobile">手機條碼</option>
                  <option value="natural_person">自然人憑證</option>
                  <option value="donate">捐贈</option>
                </select>
              </div>

              {carrierType === 'mobile' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">手機條碼</label>
                  <input
                    type="text"
                    value={carrierNumber}
                    onChange={(e) => setCarrierNumber(e.target.value.toUpperCase())}
                    className="input w-full"
                    placeholder="/XXXXXXX"
                    pattern="^\/[A-Z0-9+\-.]{7}$"
                  />
                </div>
              )}

              {carrierType === 'donate' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">愛心碼</label>
                  <input
                    type="text"
                    value={donateCode}
                    onChange={(e) => setDonateCode(e.target.value)}
                    className="input w-full"
                    placeholder="愛心碼"
                  />
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  開立中...
                </>
              ) : (
                '確認開立'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 作廢發票 Modal
function VoidInvoiceModal({ payment, onClose, onSubmit, isLoading, addNotification }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('請輸入作廢原因')
      addNotification?.({ type: 'error', message: '請輸入作廢原因' })
      return
    }
    setError('')
    onSubmit({
      payment_id: payment.id,
      reason
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-bold mb-4 text-red-600">作廢發票</h2>

        <div className="mb-4 p-3 bg-red-50 rounded-lg">
          <p className="text-sm text-red-700">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            確定要作廢此發票嗎？此操作無法復原。
          </p>
          <p className="text-sm text-gray-600 mt-2">發票號碼：{payment.invoice_number}</p>
          <p className="text-sm text-gray-600">金額：${(payment.amount || 0).toLocaleString()}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">作廢原因 *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input w-full"
              rows={3}
              placeholder="請輸入作廢原因"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button
              type="submit"
              className="btn-primary bg-red-600 hover:bg-red-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : (
                '確認作廢'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 折讓單 Modal
function AllowanceModal({ payment, onClose, onSubmit, isLoading, addNotification }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      setError('請輸入有效的折讓金額')
      addNotification?.({ type: 'error', message: '請輸入有效的折讓金額' })
      return
    }
    if (Number(amount) > payment.amount) {
      setError('折讓金額不可大於發票金額')
      addNotification?.({ type: 'error', message: '折讓金額不可大於發票金額' })
      return
    }
    if (!reason.trim()) {
      setError('請輸入折讓原因')
      addNotification?.({ type: 'error', message: '請輸入折讓原因' })
      return
    }
    setError('')
    onSubmit({
      payment_id: payment.id,
      allowance_amount: Number(amount),
      reason
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-bold mb-4">開立折讓單</h2>

        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">發票號碼：{payment.invoice_number}</p>
          <p className="text-sm text-gray-600">原始金額：${(payment.amount || 0).toLocaleString()}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">折讓金額 *</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input w-full"
              placeholder="輸入折讓金額"
              min="1"
              max={payment.amount}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">折讓原因 *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input w-full"
              rows={3}
              placeholder="請輸入折讓原因"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  開立中...
                </>
              ) : (
                '確認開立'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
