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
  Scale
} from 'lucide-react'

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
    </div>
  )
}
