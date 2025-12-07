import { useState } from 'react'
import { usePaymentsDue, useOverdueDetails, useRecordPayment, useSendPaymentReminder } from '../hooks/useApi'
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
  MessageSquare
} from 'lucide-react'

export default function Payments() {
  const [activeTab, setActiveTab] = useState('due')
  const [showPayModal, setShowPayModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'transfer',
    reference: ''
  })

  const { data: paymentsDue, isLoading: dueLoading, refetch: refetchDue } = usePaymentsDue()
  const { data: overdueList, isLoading: overdueLoading, refetch: refetchOverdue } = useOverdueDetails()
  const recordPayment = useRecordPayment()
  const sendReminder = useSendPaymentReminder()

  const handleRecordPayment = async () => {
    if (!selectedPayment) return
    await recordPayment.mutateAsync({
      paymentId: selectedPayment.id,
      paymentMethod: paymentForm.payment_method,
      reference: paymentForm.reference || null
    })
    setShowPayModal(false)
    setSelectedPayment(null)
    setPaymentForm({ payment_method: 'transfer', reference: '' })
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

  // 應收款表格欄位
  const dueColumns = [
    {
      header: '客戶',
      accessor: 'customer_name',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.customer_name}</p>
          {row.company_name && (
            <p className="text-xs text-gray-500">{row.company_name}</p>
          )}
        </div>
      )
    },
    { header: '分館', accessor: 'branch_name' },
    { header: '期別', accessor: 'payment_period' },
    {
      header: '金額',
      accessor: 'amount',
      cell: (row) => (
        <span className="font-semibold">${(row.amount || 0).toLocaleString()}</span>
      )
    },
    {
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
      header: '狀態',
      accessor: 'payment_status',
      cell: (row) => <StatusBadge status={row.payment_status} />
    },
    {
      header: '緊急度',
      accessor: 'urgency',
      cell: (row) => <StatusBadge status={row.urgency} />
    },
    {
      header: '操作',
      sortable: false,
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

  // 逾期表格欄位
  const overdueColumns = [
    {
      header: '客戶',
      accessor: 'customer_name',
      cell: (row) => (
        <div>
          <p className="font-medium text-red-700">{row.customer_name}</p>
          {row.company_name && (
            <p className="text-xs text-gray-500">{row.company_name}</p>
          )}
        </div>
      )
    },
    { header: '分館', accessor: 'branch_name' },
    { header: '期別', accessor: 'payment_period' },
    {
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
      header: '逾期天數',
      accessor: 'days_overdue',
      cell: (row) => (
        <Badge variant={row.days_overdue > 30 ? 'danger' : 'warning'}>
          {row.days_overdue} 天
        </Badge>
      )
    },
    {
      header: '嚴重度',
      accessor: 'overdue_level',
      cell: (row) => <StatusBadge status={row.overdue_level} />
    },
    {
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
      header: '操作',
      sortable: false,
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

  // 統計
  const pendingCount = paymentsDue?.filter((p) => p.payment_status === 'pending').length || 0
  const overdueCount = overdueList?.length || 0
  const totalOverdue = overdueList?.reduce((sum, p) => sum + (p.total_due || 0), 0) || 0

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

      {/* Tab 切換 */}
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
            📋 應收款列表
          </button>
          <button
            onClick={() => setActiveTab('overdue')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'overdue'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            ⚠️ 逾期款項
            {overdueCount > 0 && (
              <Badge variant="danger">{overdueCount}</Badge>
            )}
          </button>
        </nav>
      </div>

      {/* 資料表 */}
      {activeTab === 'due' ? (
        <DataTable
          columns={dueColumns}
          data={paymentsDue || []}
          loading={dueLoading}
          onRefresh={refetchDue}
          pageSize={15}
          emptyMessage="沒有待收款項"
        />
      ) : (
        <DataTable
          columns={overdueColumns}
          data={overdueList || []}
          loading={overdueLoading}
          onRefresh={refetchOverdue}
          pageSize={15}
          emptyMessage="✅ 沒有逾期款項"
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

            <div>
              <label className="label">付款方式</label>
              <select
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

            <div>
              <label className="label">備註 / 匯款帳號後五碼</label>
              <input
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

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">提醒內容預覽：</p>
              <p className="mt-2 text-sm">
                您好，提醒您 {selectedPayment.payment_period} 的租金{' '}
                <span className="font-semibold">
                  ${(selectedPayment.total_due || selectedPayment.amount || 0).toLocaleString()}
                </span>{' '}
                已到期，請儘速繳納。如有疑問請與我們聯繫。
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
