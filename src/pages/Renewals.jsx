import { useState } from 'react'
import { useRenewalReminders, useSendRenewalReminder, useBranches } from '../hooks/useApi'
import { callTool } from '../services/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import {
  Bell,
  Calendar,
  Send,
  Phone,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Receipt,
  PenTool,
  ChevronRight,
  RefreshCw
} from 'lucide-react'

// 續約狀態定義
const RENEWAL_STATUSES = {
  none: { label: '待處理', color: 'gray', icon: Clock },
  notified: { label: '已通知', color: 'blue', icon: Bell },
  confirmed: { label: '已確認', color: 'purple', icon: CheckCircle },
  paid: { label: '已收款', color: 'green', icon: Receipt },
  invoiced: { label: '已開票', color: 'teal', icon: FileText },
  signed: { label: '待簽約', color: 'orange', icon: PenTool },
  completed: { label: '完成', color: 'emerald', icon: CheckCircle }
}

// 發票狀態定義
const INVOICE_STATUSES = {
  pending_tax_id: { label: '等待統編', color: 'yellow' },
  issued_personal: { label: '已開二聯', color: 'blue' },
  issued_business: { label: '已開三聯', color: 'green' }
}

export default function Renewals() {
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('')
  const queryClient = useQueryClient()

  const { data: renewals, isLoading, refetch } = useRenewalReminders()
  const { data: branches } = useBranches()
  const sendReminder = useSendRenewalReminder()

  // 更新續約狀態
  const updateStatus = useMutation({
    mutationFn: async ({ contractId, status, notes }) => {
      return callTool('renewal_update_status', {
        contract_id: contractId,
        renewal_status: status,
        notes
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renewal-reminders'] })
      setShowStatusModal(false)
      setSelectedContract(null)
    }
  })

  // 更新發票狀態
  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ contractId, invoiceStatus, notes }) => {
      return callTool('renewal_update_invoice_status', {
        contract_id: contractId,
        invoice_status: invoiceStatus,
        notes
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renewal-reminders'] })
    }
  })

  const handleSendReminder = async () => {
    if (!selectedContract) return
    await sendReminder.mutateAsync({
      contractId: selectedContract.id,
      daysRemaining: selectedContract.days_until_expiry
    })
    // 自動更新狀態為已通知
    await updateStatus.mutateAsync({
      contractId: selectedContract.id,
      status: 'notified',
      notes: 'LINE 提醒已發送'
    })
    setShowReminderModal(false)
    setSelectedContract(null)
  }

  // 根據篩選過濾資料
  const filteredRenewals = (renewals || []).filter((r) => {
    if (statusFilter !== 'all' && r.renewal_status !== statusFilter) return false
    if (branchFilter && r.branch_id !== parseInt(branchFilter)) return false
    return true
  })

  // 統計各狀態數量
  const statusCounts = (renewals || []).reduce((acc, r) => {
    const status = r.renewal_status || 'none'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})

  // 緊急程度分組
  const urgent = filteredRenewals.filter((r) => r.days_until_expiry <= 7)
  const warning = filteredRenewals.filter(
    (r) => r.days_until_expiry > 7 && r.days_until_expiry <= 30
  )

  const columns = [
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
    {
      header: '分館',
      accessor: 'branch_name'
    },
    {
      header: '合約',
      accessor: 'contract_number',
      cell: (row) => (
        <p className="font-medium text-primary-600">{row.contract_number}</p>
      )
    },
    {
      header: '到期日',
      accessor: 'end_date',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          {row.end_date}
        </div>
      )
    },
    {
      header: '剩餘',
      accessor: 'days_until_expiry',
      cell: (row) => {
        const days = row.days_until_expiry
        let variant = 'gray'
        if (days <= 0) variant = 'danger'
        else if (days <= 7) variant = 'danger'
        else if (days <= 30) variant = 'warning'
        else if (days <= 60) variant = 'info'

        return (
          <Badge variant={variant}>
            {days <= 0 ? `已過期 ${Math.abs(days)} 天` : `${days} 天`}
          </Badge>
        )
      }
    },
    {
      header: '續約狀態',
      accessor: 'renewal_status',
      cell: (row) => {
        const status = row.renewal_status || 'none'
        const statusInfo = RENEWAL_STATUSES[status]
        const Icon = statusInfo?.icon || Clock

        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedContract(row)
              setShowStatusModal(true)
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:opacity-80 bg-${statusInfo?.color}-100 text-${statusInfo?.color}-700`}
          >
            <Icon className="w-3.5 h-3.5" />
            {statusInfo?.label}
            <ChevronRight className="w-3 h-3" />
          </button>
        )
      }
    },
    {
      header: '發票',
      accessor: 'invoice_status',
      cell: (row) => {
        if (!row.invoice_status) return <span className="text-gray-400">-</span>
        const statusInfo = INVOICE_STATUSES[row.invoice_status]
        return (
          <Badge variant={statusInfo?.color}>
            {statusInfo?.label}
          </Badge>
        )
      }
    },
    {
      header: '月租',
      accessor: 'monthly_rent',
      cell: (row) => (
        <span className="font-medium">${(row.monthly_rent || 0).toLocaleString()}</span>
      )
    },
    {
      header: 'LINE',
      accessor: 'line_user_id',
      cell: (row) =>
        row.line_user_id ? (
          <MessageSquare className="w-4 h-4 text-green-500" />
        ) : (
          <span className="text-gray-300">-</span>
        )
    },
    {
      header: '操作',
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.line_user_id && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedContract(row)
                setShowReminderModal(true)
              }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
              title="發送 LINE 提醒"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedContract(row)
              setShowStatusModal(true)
            }}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="更新狀態"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* 狀態統計看板 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Object.entries(RENEWAL_STATUSES).map(([key, { label, color, icon: Icon }]) => {
          const count = statusCounts[key] || 0
          const isActive = statusFilter === key

          return (
            <button
              key={key}
              onClick={() => setStatusFilter(isActive ? 'all' : key)}
              className={`p-3 rounded-lg border-2 transition-all ${
                isActive
                  ? `border-${color}-500 bg-${color}-50`
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 text-${color}-500`} />
                <span className={`text-lg font-bold text-${color}-600`}>{count}</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">{label}</p>
            </button>
          )
        })}
      </div>

      {/* 篩選器 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">分館：</label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="input w-32"
          >
            <option value="">全部</option>
            {branches?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">狀態：</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-32"
          >
            <option value="all">全部</option>
            {Object.entries(RENEWAL_STATUSES).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {statusFilter !== 'all' && (
          <button
            onClick={() => setStatusFilter('all')}
            className="text-sm text-blue-600 hover:underline"
          >
            清除篩選
          </button>
        )}

        <div className="flex-1" />

        <div className="text-sm text-gray-500">
          共 {filteredRenewals.length} 筆
          {urgent.length > 0 && (
            <span className="ml-2 text-red-600 font-medium">
              （{urgent.length} 筆緊急）
            </span>
          )}
        </div>
      </div>

      {/* 緊急提醒區塊 */}
      {urgent.length > 0 && statusFilter === 'all' && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-700">緊急：7天內到期或已過期</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {urgent.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="p-4 bg-white rounded-lg border border-red-200 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{item.customer_name}</p>
                    <p className="text-sm text-gray-500">{item.branch_name}</p>
                  </div>
                  <Badge variant="danger">
                    {item.days_until_expiry <= 0
                      ? `已過期`
                      : `${item.days_until_expiry} 天`}
                  </Badge>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500">到期日：{item.end_date}</p>
                    <p className="text-sm font-medium">${(item.monthly_rent || 0).toLocaleString()}/月</p>
                  </div>
                  <div className="flex gap-2">
                    {item.line_user_id && (
                      <button
                        onClick={() => {
                          setSelectedContract(item)
                          setShowReminderModal(true)
                        }}
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                        title="發送 LINE"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedContract(item)
                        setShowStatusModal(true)
                      }}
                      className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                      title="更新狀態"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 全部列表 */}
      <DataTable
        columns={columns}
        data={filteredRenewals}
        loading={isLoading}
        onRefresh={refetch}
        pageSize={15}
        emptyMessage="🎉 沒有符合條件的續約提醒"
      />

      {/* 發送提醒 Modal */}
      <Modal
        open={showReminderModal}
        onClose={() => {
          setShowReminderModal(false)
          setSelectedContract(null)
        }}
        title="發送 LINE 續約提醒"
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
              {sendReminder.isPending ? '發送中...' : '發送並更新狀態'}
            </button>
          </>
        }
      >
        {selectedContract && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="font-medium">{selectedContract.customer_name}</p>
              <p className="text-sm text-gray-600">
                合約 {selectedContract.contract_number}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant={selectedContract.days_until_expiry <= 7 ? 'danger' : 'warning'}>
                  剩餘 {selectedContract.days_until_expiry} 天
                </Badge>
                <span className="text-sm text-gray-500">
                  到期日：{selectedContract.end_date}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">發送後將自動更新狀態為「已通知」</p>
            </div>
          </div>
        )}
      </Modal>

      {/* 更新狀態 Modal */}
      <Modal
        open={showStatusModal}
        onClose={() => {
          setShowStatusModal(false)
          setSelectedContract(null)
        }}
        title="更新續約狀態"
        size="md"
      >
        {selectedContract && (
          <div className="space-y-6">
            {/* 客戶資訊 */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-lg">{selectedContract.customer_name}</p>
                  <p className="text-sm text-gray-500">{selectedContract.company_name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    合約 {selectedContract.contract_number} | {selectedContract.branch_name}
                  </p>
                </div>
                <Badge variant={selectedContract.days_until_expiry <= 7 ? 'danger' : 'warning'}>
                  {selectedContract.days_until_expiry <= 0
                    ? `已過期 ${Math.abs(selectedContract.days_until_expiry)} 天`
                    : `剩餘 ${selectedContract.days_until_expiry} 天`}
                </Badge>
              </div>
            </div>

            {/* 續約狀態選擇 */}
            <div>
              <h4 className="font-medium mb-3">續約狀態</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(RENEWAL_STATUSES).map(([key, { label, color, icon: Icon }]) => {
                  const isSelected = selectedContract.renewal_status === key ||
                    (!selectedContract.renewal_status && key === 'none')

                  return (
                    <button
                      key={key}
                      onClick={() =>
                        updateStatus.mutate({
                          contractId: selectedContract.id,
                          status: key
                        })
                      }
                      disabled={updateStatus.isPending}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? `border-${color}-500 bg-${color}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 text-${color}-500 mx-auto mb-1`} />
                      <p className="text-xs font-medium">{label}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 發票狀態 */}
            <div>
              <h4 className="font-medium mb-3">發票狀態</h4>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(INVOICE_STATUSES).map(([key, { label, color }]) => {
                  const isSelected = selectedContract.invoice_status === key

                  return (
                    <button
                      key={key}
                      onClick={() =>
                        updateInvoiceStatus.mutate({
                          contractId: selectedContract.id,
                          invoiceStatus: key
                        })
                      }
                      disabled={updateInvoiceStatus.isPending}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? `border-${color}-500 bg-${color}-50`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-sm font-medium">{label}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 時間軸 */}
            {(selectedContract.renewal_notified_at ||
              selectedContract.renewal_confirmed_at ||
              selectedContract.renewal_paid_at) && (
              <div>
                <h4 className="font-medium mb-3">處理記錄</h4>
                <div className="space-y-2 text-sm">
                  {selectedContract.renewal_notified_at && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Bell className="w-4 h-4 text-blue-500" />
                      <span>通知時間：{new Date(selectedContract.renewal_notified_at).toLocaleString('zh-TW')}</span>
                    </div>
                  )}
                  {selectedContract.renewal_confirmed_at && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="w-4 h-4 text-purple-500" />
                      <span>確認時間：{new Date(selectedContract.renewal_confirmed_at).toLocaleString('zh-TW')}</span>
                    </div>
                  )}
                  {selectedContract.renewal_paid_at && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Receipt className="w-4 h-4 text-green-500" />
                      <span>收款時間：{new Date(selectedContract.renewal_paid_at).toLocaleString('zh-TW')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 備註 */}
            {selectedContract.renewal_notes && (
              <div>
                <h4 className="font-medium mb-2">備註</h4>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                  {selectedContract.renewal_notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
