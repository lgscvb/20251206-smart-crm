import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePaymentsDue, useOverdueDetails, usePaymentsHistory, useRecordPayment, useUndoPayment, useSendPaymentReminder } from '../hooks/useApi'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge, { StatusBadge } from '../components/Badge'
import {
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Send,
  DollarSign,
  Calendar,
  Phone,
  MessageSquare,
  Settings2,
  ChevronDown,
  Undo2,
  History,
  Scale,
  Plus,
  Loader2,
  Trash2,
  Gift
} from 'lucide-react'
import api from '../services/api'

// 應收款可選欄位
const DUE_COLUMNS = {
  branch_name: { label: '分館', default: false },
  payment_period: { label: '期別', default: true },
  amount: { label: '金額', default: true },
  due_date: { label: '到期日', default: true },
  payment_status: { label: '狀態', default: false },
  urgency: { label: '緊急度', default: true }
}

// 逾期款可選欄位
const OVERDUE_COLUMNS = {
  branch_name: { label: '分館', default: false },
  payment_period: { label: '期別', default: true },
  total_due: { label: '應繳', default: true },
  days_overdue: { label: '逾期天數', default: true },
  reminder_count: { label: '催繳次數', default: true },
  overdue_level: { label: '嚴重度', default: true },
  phone: { label: '聯絡', default: false }
}

// 已付款可選欄位
const PAID_COLUMNS = {
  branch_name: { label: '分館', default: false },
  payment_period: { label: '期別', default: true },
  amount: { label: '金額', default: true },
  paid_at: { label: '付款日', default: true },
  payment_method: { label: '付款方式', default: true }
}

export default function Payments() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('due')
  const [showPayModal, setShowPayModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showUndoModal, setShowUndoModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'transfer',
    reference: '',
    paid_at: new Date().toISOString().split('T')[0]
  })
  const [undoReason, setUndoReason] = useState('')
  const [reminderMessage, setReminderMessage] = useState('')
  const [pageSize, setPageSize] = useState(15)
  const [showColumnPicker, setShowColumnPicker] = useState(false)

  // 刪除相關狀態
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingPayment, setDeletingPayment] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // 免收相關狀態
  const [showWaiveModal, setShowWaiveModal] = useState(false)
  const [waivingPayment, setWaivingPayment] = useState(null)
  const [waiveLoading, setWaiveLoading] = useState(false)
  const [waiveNotes, setWaiveNotes] = useState('')

  // 生成待繳記錄相關狀態
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generatePeriod, setGeneratePeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState(null)

  // 應收款欄位狀態
  const [dueVisibleColumns, setDueVisibleColumns] = useState(() => {
    const initial = {}
    Object.entries(DUE_COLUMNS).forEach(([key, { default: def }]) => {
      initial[key] = def
    })
    return initial
  })

  // 逾期款欄位狀態
  const [overdueVisibleColumns, setOverdueVisibleColumns] = useState(() => {
    const initial = {}
    Object.entries(OVERDUE_COLUMNS).forEach(([key, { default: def }]) => {
      initial[key] = def
    })
    return initial
  })

  // 已付款欄位狀態
  const [paidVisibleColumns, setPaidVisibleColumns] = useState(() => {
    const initial = {}
    Object.entries(PAID_COLUMNS).forEach(([key, { default: def }]) => {
      initial[key] = def
    })
    return initial
  })

  const { data: paymentsDue, isLoading: dueLoading, refetch: refetchDue } = usePaymentsDue()
  const { data: overdueList, isLoading: overdueLoading, refetch: refetchOverdue } = useOverdueDetails()
  const { data: paidList, isLoading: paidLoading, refetch: refetchPaid } = usePaymentsHistory()
  const recordPayment = useRecordPayment()
  const undoPayment = useUndoPayment()
  const sendReminder = useSendPaymentReminder()

  const handleRecordPayment = async () => {
    if (!selectedPayment) return
    await recordPayment.mutateAsync({
      paymentId: selectedPayment.id,
      paymentMethod: paymentForm.payment_method,
      reference: paymentForm.reference || null,
      paidAt: paymentForm.paid_at
    })
    setShowPayModal(false)
    setSelectedPayment(null)
    setPaymentForm({
      payment_method: 'transfer',
      reference: '',
      paid_at: new Date().toISOString().split('T')[0]
    })
    refetchDue()
    refetchOverdue()
  }

  const handleSendReminder = async () => {
    if (!selectedPayment) return
    await sendReminder.mutateAsync({
      customerId: selectedPayment.customer_id,
      amount: selectedPayment.total_due || selectedPayment.amount,
      dueDate: selectedPayment.due_date
    })
    setShowReminderModal(false)
    setSelectedPayment(null)
  }

  const handleUndoPayment = async () => {
    if (!selectedPayment || !undoReason.trim()) return
    await undoPayment.mutateAsync({
      paymentId: selectedPayment.id,
      reason: undoReason.trim()
    })
    setShowUndoModal(false)
    setSelectedPayment(null)
    setUndoReason('')
    refetchPaid()
    refetchDue()
  }

  // 刪除繳費記錄
  const handleDeletePayment = async () => {
    if (!deletingPayment) return
    setDeleteLoading(true)
    try {
      await api.delete(`/api/db/payments?id=eq.${deletingPayment.id}`)
      setShowDeleteModal(false)
      setDeletingPayment(null)
      // 重新整理所有列表
      refetchDue()
      refetchOverdue()
      refetchPaid()
    } catch (error) {
      console.error('刪除失敗:', error)
      alert('刪除失敗：' + (error.response?.data?.message || error.message))
    } finally {
      setDeleteLoading(false)
    }
  }

  // 標記為免收
  const handleWaivePayment = async () => {
    if (!waivingPayment) return
    setWaiveLoading(true)
    try {
      await api.patch(`/api/db/payments?id=eq.${waivingPayment.id}`, {
        payment_status: 'waived',
        notes: waiveNotes || '免收'
      })
      setShowWaiveModal(false)
      setWaivingPayment(null)
      setWaiveNotes('')
      // 重新整理所有列表
      refetchDue()
      refetchOverdue()
      refetchPaid()
    } catch (error) {
      console.error('免收標記失敗:', error)
      alert('免收標記失敗：' + (error.response?.data?.message || error.message))
    } finally {
      setWaiveLoading(false)
    }
  }

  // 生成待繳記錄
  const handleGeneratePayments = async () => {
    setGenerating(true)
    setGenerateResult(null)
    try {
      const data = await api.post('/api/db/rpc/generate_monthly_payments', {
        target_period: generatePeriod
      })
      // PostgREST 函數會回傳陣列，取第一筆
      // 注意：axios interceptor 已經返回 response.data，所以 data 本身就是資料
      const result = Array.isArray(data) ? data[0] : data
      setGenerateResult(result)
      // 重新整理列表
      refetchDue()
      refetchOverdue()
    } catch (error) {
      console.error('生成待繳記錄失敗:', error)
      setGenerateResult({ error: error.response?.data?.message || error.message || '生成失敗' })
    } finally {
      setGenerating(false)
    }
  }

  // 應收款所有欄位定義
  const allDueColumns = [
    {
      key: '_index',
      header: '#',
      accessor: '_index',
      fixed: true,
      cell: (row, index) => (
        <span className="text-gray-500 font-mono text-sm">{index + 1}</span>
      )
    },
    {
      key: 'customer_name',
      header: '客戶',
      accessor: 'customer_name',
      fixed: true,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.customer_name}</p>
          {row.company_name && (
            <p className="text-xs text-gray-500">{row.company_name}</p>
          )}
        </div>
      )
    },
    { key: 'branch_name', header: '分館', accessor: 'branch_name' },
    { key: 'payment_period', header: '期別', accessor: 'payment_period' },
    {
      key: 'amount',
      header: '金額',
      accessor: 'amount',
      cell: (row) => (
        <span className="font-semibold">${(row.amount || 0).toLocaleString()}</span>
      )
    },
    {
      key: 'due_date',
      header: '到期日',
      accessor: 'due_date',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          {row.due_date}
        </div>
      )
    },
    {
      key: 'payment_status',
      header: '狀態',
      accessor: 'payment_status',
      cell: (row) => <StatusBadge status={row.payment_status} />
    },
    {
      key: 'urgency',
      header: '緊急度',
      accessor: 'urgency',
      cell: (row) => <StatusBadge status={row.urgency} />
    },
    {
      key: 'actions',
      header: '操作',
      sortable: false,
      fixed: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedPayment(row)
              setShowPayModal(true)
            }}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="記錄繳費"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          {row.line_user_id && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedPayment(row)
                const defaultMsg = `您好，提醒您 ${row.payment_period} 的租金 $${(row.total_due || row.amount || 0).toLocaleString()} 已到期，請儘速繳納。如有疑問請與我們聯繫。`
                setReminderMessage(defaultMsg)
                setShowReminderModal(true)
              }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="發送 LINE 提醒"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setWaivingPayment(row)
              setShowWaiveModal(true)
            }}
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="免收"
          >
            <Gift className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeletingPayment(row)
              setShowDeleteModal(true)
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  // 逾期款所有欄位定義
  const allOverdueColumns = [
    {
      key: '_index',
      header: '#',
      accessor: '_index',
      fixed: true,
      cell: (row, index) => (
        <span className="text-gray-500 font-mono text-sm">{index + 1}</span>
      )
    },
    {
      key: 'customer_name',
      header: '客戶',
      accessor: 'customer_name',
      fixed: true,
      cell: (row) => (
        <div>
          <p className="font-medium text-red-700">{row.customer_name}</p>
          {row.company_name && (
            <p className="text-xs text-gray-500">{row.company_name}</p>
          )}
        </div>
      )
    },
    { key: 'branch_name', header: '分館', accessor: 'branch_name' },
    { key: 'payment_period', header: '期別', accessor: 'payment_period' },
    {
      key: 'total_due',
      header: '應繳',
      accessor: 'total_due',
      cell: (row) => (
        <div>
          <span className="font-semibold text-red-600">
            ${(row.total_due || 0).toLocaleString()}
          </span>
          {row.late_fee > 0 && (
            <p className="text-xs text-gray-500">含滯納金 ${row.late_fee}</p>
          )}
        </div>
      )
    },
    {
      key: 'days_overdue',
      header: '逾期天數',
      accessor: 'days_overdue',
      cell: (row) => (
        <Badge variant={row.days_overdue > 30 ? 'danger' : 'warning'}>
          {row.days_overdue} 天
        </Badge>
      )
    },
    {
      key: 'reminder_count',
      header: '催繳次數',
      accessor: 'reminder_count',
      cell: (row) => (
        <Badge variant={row.reminder_count >= 5 ? 'danger' : row.reminder_count >= 3 ? 'warning' : 'info'}>
          {row.reminder_count || 0} 次
        </Badge>
      )
    },
    {
      key: 'overdue_level',
      header: '嚴重度',
      accessor: 'overdue_level',
      cell: (row) => <StatusBadge status={row.overdue_level} />
    },
    {
      key: 'phone',
      header: '聯絡',
      accessor: 'phone',
      cell: (row) => (
        <div className="space-y-1">
          {row.phone && (
            <div className="flex items-center gap-1 text-sm">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              {row.phone}
            </div>
          )}
          {row.line_user_id && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs text-green-600">LINE</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      header: '操作',
      sortable: false,
      fixed: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedPayment(row)
              setShowPayModal(true)
            }}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="記錄繳費"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          {row.line_user_id && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedPayment(row)
                const defaultMsg = `您好，提醒您 ${row.payment_period} 的租金 $${(row.total_due || row.amount || 0).toLocaleString()} 已逾期 ${row.days_overdue} 天，請儘速繳納。如有任何問題請與我們聯繫。`
                setReminderMessage(defaultMsg)
                setShowReminderModal(true)
              }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="發送催繳"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setWaivingPayment(row)
              setShowWaiveModal(true)
            }}
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="免收"
          >
            <Gift className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeletingPayment(row)
              setShowDeleteModal(true)
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  // 已付款所有欄位定義
  const allPaidColumns = [
    {
      key: '_index',
      header: '#',
      accessor: '_index',
      fixed: true,
      cell: (row, index) => (
        <span className="text-gray-500 font-mono text-sm">{index + 1}</span>
      )
    },
    {
      key: 'customer_name',
      header: '客戶',
      accessor: 'customer_name',
      fixed: true,
      cell: (row) => (
        <div>
          <p className="font-medium">{row.customer?.name || '-'}</p>
          {row.customer?.company_name && (
            <p className="text-xs text-gray-500">{row.customer.company_name}</p>
          )}
        </div>
      )
    },
    { key: 'branch_name', header: '分館', accessor: 'branch_name', cell: (row) => row.branch?.name || '-' },
    { key: 'payment_period', header: '期別', accessor: 'payment_period' },
    {
      key: 'amount',
      header: '金額',
      accessor: 'amount',
      cell: (row) => (
        <span className="font-semibold text-green-600">${(row.amount || 0).toLocaleString()}</span>
      )
    },
    {
      key: 'paid_at',
      header: '付款日',
      accessor: 'paid_at',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          {row.paid_at ? row.paid_at.split('T')[0] : '-'}
        </div>
      )
    },
    {
      key: 'payment_method',
      header: '付款方式',
      accessor: 'payment_method',
      cell: (row) => {
        const methods = {
          transfer: '銀行轉帳',
          cash: '現金',
          check: '支票',
          credit_card: '信用卡',
          line_pay: 'LINE Pay'
        }
        return methods[row.payment_method] || row.payment_method || '-'
      }
    },
    {
      key: 'actions',
      header: '操作',
      sortable: false,
      fixed: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedPayment(row)
              setShowUndoModal(true)
            }}
            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
            title="撤銷繳費"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDeletingPayment(row)
              setShowDeleteModal(true)
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  // 根據顯示狀態過濾欄位
  const dueColumns = allDueColumns.filter(col =>
    col.fixed || dueVisibleColumns[col.key]
  )

  const overdueColumns = allOverdueColumns.filter(col =>
    col.fixed || overdueVisibleColumns[col.key]
  )

  const paidColumns = allPaidColumns.filter(col =>
    col.fixed || paidVisibleColumns[col.key]
  )

  const toggleDueColumn = (key) => {
    setDueVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const toggleOverdueColumn = (key) => {
    setOverdueVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const togglePaidColumn = (key) => {
    setPaidVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // 統計
  const paymentsDueArr = Array.isArray(paymentsDue) ? paymentsDue : []
  const overdueListArr = Array.isArray(overdueList) ? overdueList : []
  const paidListArr = Array.isArray(paidList) ? paidList : []
  const pendingCount = paymentsDueArr.filter((p) => p.payment_status === 'pending').length
  const overdueCount = overdueListArr.length
  const totalOverdue = overdueListArr.reduce((sum, p) => sum + (p.total_due || 0), 0)
  const paidCount = paidListArr.length
  const totalPaid = paidListArr.reduce((sum, p) => sum + (p.amount || 0), 0)

  // 當前使用的欄位配置
  const currentOptionalColumns = activeTab === 'due' ? DUE_COLUMNS : activeTab === 'overdue' ? OVERDUE_COLUMNS : PAID_COLUMNS
  const currentVisibleColumns = activeTab === 'due' ? dueVisibleColumns : activeTab === 'overdue' ? overdueVisibleColumns : paidVisibleColumns
  const toggleColumn = activeTab === 'due' ? toggleDueColumn : activeTab === 'overdue' ? toggleOverdueColumn : togglePaidColumn

  return (
    <div className="space-y-6">
      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <CreditCard className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-sm text-gray-500">待收款項</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{overdueCount}</p>
            <p className="text-sm text-gray-500">逾期筆數</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-xl">
            <DollarSign className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              ${totalOverdue.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">逾期總額</p>
          </div>
        </div>
      </div>

      {/* Tab 切換與篩選 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('due')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'due'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              應收款列表
            </button>
            <button
              onClick={() => setActiveTab('overdue')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'overdue'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              逾期款項
              {overdueCount > 0 && (
                <Badge variant="danger">{overdueCount}</Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab('paid')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'paid'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <History className="w-4 h-4" />
              已付款記錄
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="payment-page-size" className="text-sm text-gray-600">每頁：</label>
            <select
              id="payment-page-size"
              name="page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="input w-20"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* 欄位選擇器 */}
          <div className="relative">
            <button
              onClick={() => setShowColumnPicker(!showColumnPicker)}
              className="btn-secondary text-sm"
            >
              <Settings2 className="w-4 h-4 mr-1" />
              欄位
              <ChevronDown className="w-4 h-4 ml-1" />
            </button>

            {showColumnPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowColumnPicker(false)}
                />
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2 min-w-[120px]">
                  {Object.entries(currentOptionalColumns).map(([key, { label }]) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={currentVisibleColumns[key]}
                        onChange={() => toggleColumn(key)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => {
              setGenerateResult(null)
              setShowGenerateModal(true)
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            生成待繳
          </button>
          <button
            onClick={() => navigate('/payments/legal-letters')}
            className="btn-secondary"
          >
            <Scale className="w-4 h-4 mr-2" />
            存證信函
          </button>
        </div>
      </div>

      {/* 資料表 */}
      {activeTab === 'due' && (
        <DataTable
          columns={dueColumns}
          data={paymentsDue || []}
          loading={dueLoading}
          onRefresh={refetchDue}
          pageSize={pageSize}
          emptyMessage="沒有待收款項"
          onRowClick={(row) => row.contract_id && navigate(`/contracts/${row.contract_id}`)}
        />
      )}
      {activeTab === 'overdue' && (
        <DataTable
          columns={overdueColumns}
          data={overdueList || []}
          loading={overdueLoading}
          onRefresh={refetchOverdue}
          pageSize={pageSize}
          emptyMessage="沒有逾期款項"
          onRowClick={(row) => row.contract_id && navigate(`/contracts/${row.contract_id}`)}
        />
      )}
      {activeTab === 'paid' && (
        <DataTable
          columns={paidColumns}
          data={paidList || []}
          loading={paidLoading}
          onRefresh={refetchPaid}
          pageSize={pageSize}
          emptyMessage="沒有已付款記錄"
          onRowClick={(row) => row.contract_id && navigate(`/contracts/${row.contract_id}`)}
        />
      )}

      {/* 記錄繳費 Modal */}
      <Modal
        open={showPayModal}
        onClose={() => {
          setShowPayModal(false)
          setSelectedPayment(null)
        }}
        title="記錄繳費"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowPayModal(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleRecordPayment}
              disabled={recordPayment.isPending}
              className="btn-success"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {recordPayment.isPending ? '處理中...' : '確認收款'}
            </button>
          </>
        }
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">{selectedPayment.customer_name}</p>
              <p className="text-sm text-gray-500">
                {selectedPayment.payment_period} · {selectedPayment.branch_name}
              </p>
              <p className="text-xl font-bold text-green-600 mt-2">
                ${(selectedPayment.total_due || selectedPayment.amount || 0).toLocaleString()}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="payment-date" className="label">繳費日期</label>
                <input
                  id="payment-date"
                  name="paid_at"
                  type="date"
                  value={paymentForm.paid_at}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, paid_at: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="payment-method" className="label">付款方式</label>
                <select
                  id="payment-method"
                  name="payment_method"
                  value={paymentForm.payment_method}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, payment_method: e.target.value })
                  }
                  className="input"
                >
                  <option value="transfer">銀行轉帳</option>
                  <option value="cash">現金</option>
                  <option value="check">支票</option>
                  <option value="other">其他</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="payment-reference" className="label">備註 / 匯款帳號後五碼</label>
              <input
                id="payment-reference"
                name="reference"
                type="text"
                value={paymentForm.reference}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, reference: e.target.value })
                }
                placeholder="選填"
                className="input"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 發送提醒 Modal */}
      <Modal
        open={showReminderModal}
        onClose={() => {
          setShowReminderModal(false)
          setSelectedPayment(null)
        }}
        title="發送 LINE 催繳通知"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowReminderModal(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleSendReminder}
              disabled={sendReminder.isPending}
              className="btn-primary"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendReminder.isPending ? '發送中...' : '發送通知'}
            </button>
          </>
        }
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="font-medium">{selectedPayment.customer_name}</p>
              <p className="text-sm text-gray-600 mt-1">
                將發送繳費提醒至客戶的 LINE
              </p>
            </div>

            <div>
              <label htmlFor="reminder-message" className="label">訊息內容</label>
              <textarea
                id="reminder-message"
                name="reminder_message"
                value={reminderMessage}
                onChange={(e) => setReminderMessage(e.target.value)}
                rows={4}
                className="input resize-none"
                placeholder="輸入要發送的訊息..."
              />
              <p className="text-xs text-gray-400 mt-1">可編輯訊息內容後再發送</p>
            </div>
          </div>
        )}
      </Modal>

      {/* 撤銷繳費 Modal */}
      <Modal
        open={showUndoModal}
        onClose={() => {
          setShowUndoModal(false)
          setSelectedPayment(null)
          setUndoReason('')
        }}
        title="撤銷繳費記錄"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setShowUndoModal(false)
                setSelectedPayment(null)
                setUndoReason('')
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleUndoPayment}
              disabled={undoPayment.isPending || !undoReason.trim()}
              className="btn-danger"
            >
              <Undo2 className="w-4 h-4 mr-2" />
              {undoPayment.isPending ? '處理中...' : '確認撤銷'}
            </button>
          </>
        }
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <p className="font-medium">{selectedPayment.customer?.name || '-'}</p>
              <p className="text-sm text-gray-500">
                {selectedPayment.payment_period} · {selectedPayment.branch?.name || '-'}
              </p>
              <p className="text-xl font-bold text-green-600 mt-2">
                ${(selectedPayment.amount || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                付款日期：{selectedPayment.paid_at ? selectedPayment.paid_at.split('T')[0] : '-'}
              </p>
            </div>

            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-700">
                <strong>警告：</strong>撤銷後此筆繳費將回到「待收款」狀態，原付款資訊將被記錄在備註中。
              </p>
            </div>

            <div>
              <label htmlFor="undo-reason" className="label">
                撤銷原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                id="undo-reason"
                name="undo_reason"
                value={undoReason}
                onChange={(e) => setUndoReason(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder="請說明撤銷繳費的原因..."
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 生成待繳記錄 Modal */}
      <Modal
        open={showGenerateModal}
        onClose={() => {
          if (!generating) {
            setShowGenerateModal(false)
            setGenerateResult(null)
          }
        }}
        title="生成待繳記錄"
        size="sm"
        footer={
          generateResult && !generateResult.error ? (
            <button
              onClick={() => {
                setShowGenerateModal(false)
                setGenerateResult(null)
              }}
              className="btn-primary"
            >
              完成
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowGenerateModal(false)
                  setGenerateResult(null)
                }}
                disabled={generating}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleGeneratePayments}
                disabled={generating}
                className="btn-primary"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    處理中...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    生成記錄
                  </>
                )}
              </button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {/* 說明 */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-700">
              為所有活躍合約自動生成指定月份的待繳記錄。已存在的記錄會自動跳過。
            </p>
          </div>

          {/* 月份選擇 */}
          <div>
            <label htmlFor="generate-period" className="label">目標月份</label>
            <input
              id="generate-period"
              type="month"
              value={generatePeriod}
              onChange={(e) => setGeneratePeriod(e.target.value)}
              disabled={generating || (generateResult && !generateResult.error)}
              className="input"
            />
          </div>

          {/* 結果顯示 */}
          {generateResult && (
            <div className={`p-4 rounded-lg border ${
              generateResult.error
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'
            }`}>
              {generateResult.error ? (
                <div className="text-red-700">
                  <p className="font-medium">生成失敗</p>
                  <p className="text-sm mt-1">{generateResult.error}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium text-green-700">生成完成</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">處理合約：</span>
                      <span className="font-medium">{generateResult.contracts_processed} 筆</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">新建記錄：</span>
                      <span className="font-medium text-green-600">{generateResult.payments_created} 筆</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">總金額：</span>
                      <span className="font-medium text-green-600">${Number(generateResult.total_amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">已存在跳過：</span>
                      <span className="font-medium text-gray-500">{generateResult.skipped_existing} 筆</span>
                    </div>
                    <div className="flex justify-between col-span-2">
                      <span className="text-gray-600">本月無需繳費：</span>
                      <span className="font-medium text-gray-500">{generateResult.skipped_no_payment} 筆</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* 刪除確認 Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => {
          if (!deleteLoading) {
            setShowDeleteModal(false)
            setDeletingPayment(null)
          }
        }}
        title="確認刪除"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setShowDeleteModal(false)
                setDeletingPayment(null)
              }}
              disabled={deleteLoading}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleDeletePayment}
              disabled={deleteLoading}
              className="btn-danger"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleteLoading ? '刪除中...' : '確認刪除'}
            </button>
          </>
        }
      >
        {deletingPayment && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700">警告：此操作無法復原</p>
                  <p className="text-sm text-red-600 mt-1">
                    刪除後資料將永久消失，請確認是否要刪除此繳費記錄。
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">
                {deletingPayment.customer_name || deletingPayment.customer?.name || '未知客戶'}
              </p>
              <p className="text-sm text-gray-500">
                {deletingPayment.payment_period} · {deletingPayment.branch_name || deletingPayment.branch?.name || '-'}
              </p>
              <p className="text-xl font-bold text-gray-700 mt-2">
                ${(deletingPayment.total_due || deletingPayment.amount || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                狀態：{deletingPayment.payment_status === 'paid' ? '已付款' :
                      deletingPayment.payment_status === 'overdue' ? '逾期' : '待繳'}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* 免收確認 Modal */}
      <Modal
        open={showWaiveModal}
        onClose={() => {
          if (!waiveLoading) {
            setShowWaiveModal(false)
            setWaivingPayment(null)
            setWaiveNotes('')
          }
        }}
        title="標記為免收"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setShowWaiveModal(false)
                setWaivingPayment(null)
                setWaiveNotes('')
              }}
              disabled={waiveLoading}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleWaivePayment}
              disabled={waiveLoading}
              className="btn-primary bg-purple-600 hover:bg-purple-700"
            >
              <Gift className="w-4 h-4 mr-2" />
              {waiveLoading ? '處理中...' : '確認免收'}
            </button>
          </>
        }
      >
        {waivingPayment && (
          <div className="space-y-4">
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-start gap-3">
                <Gift className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-purple-700">此筆繳費將標記為免收</p>
                  <p className="text-sm text-purple-600 mt-1">
                    免收記錄不計入營收統計，但會保留歷史記錄。
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">
                {waivingPayment.customer_name || waivingPayment.customer?.name || '未知客戶'}
              </p>
              <p className="text-sm text-gray-500">
                {waivingPayment.payment_period} · {waivingPayment.branch_name || waivingPayment.branch?.name || '-'}
              </p>
              <p className="text-xl font-bold text-gray-700 mt-2">
                ${(waivingPayment.total_due || waivingPayment.amount || 0).toLocaleString()}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                備註（可選）
              </label>
              <input
                type="text"
                value={waiveNotes}
                onChange={(e) => setWaiveNotes(e.target.value)}
                placeholder="例：10月免收、減免優惠"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
