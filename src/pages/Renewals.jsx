import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRenewalReminders, useSendRenewalReminder, useBranches } from '../hooks/useApi'
import { callTool } from '../services/api'
import useStore from '../store/useStore'
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
  ChevronDown,
  RefreshCw,
  Settings2,
  Edit3,
  Scale
} from 'lucide-react'

// 續約狀態定義
const RENEWAL_STATUSES = {
  none: { label: '待處理', color: 'gray', icon: Clock },
  notified: { label: '已通知', color: 'blue', icon: Bell },
  confirmed: { label: '已確認', color: 'purple', icon: CheckCircle },
  paid: { label: '已收款', color: 'green', icon: Receipt, hint: '待簽約' },
  invoiced: { label: '已開票', color: 'teal', icon: FileText },
  signed: { label: '已簽約', color: 'orange', icon: PenTool },
  completed: { label: '完成', color: 'emerald', icon: CheckCircle }
}

// 發票狀態定義
const INVOICE_STATUSES = {
  pending_tax_id: { label: '等待統編', color: 'yellow' },
  issued_personal: { label: '已開二聯', color: 'blue' },
  issued_business: { label: '已開三聯', color: 'green' }
}

// 狀態轉換規則（定義合法的狀態轉換）
const VALID_TRANSITIONS = {
  none: ['notified'],                          // 待處理 → 已通知
  notified: ['confirmed', 'none'],             // 已通知 → 已確認 或 退回待處理
  confirmed: ['paid', 'notified'],             // 已確認 → 已收款 或 退回已通知
  paid: ['invoiced'],                          // 已收款 → 已開票
  invoiced: ['signed'],                        // 已開票 → 已簽約
  signed: ['completed'],                       // 已簽約 → 完成
  completed: []                                // 完成 → 不能變更
}

// 檢查狀態轉換是否合法
const canTransition = (fromStatus, toStatus) => {
  const validTargets = VALID_TRANSITIONS[fromStatus] || []
  return validTargets.includes(toStatus)
}

// 取得可轉換的目標狀態列表
const getValidTargetStatuses = (currentStatus) => {
  return VALID_TRANSITIONS[currentStatus] || []
}

// 可選欄位定義
const OPTIONAL_COLUMNS = {
  branch_name: { label: '分館', default: false },
  contract_number: { label: '合約', default: true },
  end_date: { label: '到期日', default: true },
  days_until_expiry: { label: '剩餘', default: true },
  renewal_status: { label: '續約狀態', default: true },
  invoice_status: { label: '發票', default: false },
  monthly_rent: { label: '月租', default: true },
  period_amount: { label: '當期金額', default: true },
  line_user_id: { label: 'LINE', default: true }
}

// 計算當期金額
const CYCLE_MULTIPLIER = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12
}
const CYCLE_LABEL = {
  monthly: '月繳',
  quarterly: '季繳',
  semi_annual: '半年繳',
  annual: '年繳'
}
// 計算當期金額（支援階梯式收費）
const getPeriodAmount = (row) => {
  let monthlyRent = row.monthly_rent || 0

  // 檢查是否有階梯式收費
  const tieredPricing = row.metadata?.tiered_pricing
  if (tieredPricing && Array.isArray(tieredPricing) && row.start_date) {
    // 計算合約開始至今的年數
    const startDate = new Date(row.start_date)
    const now = new Date()
    const yearsElapsed = Math.floor((now - startDate) / (365.25 * 24 * 60 * 60 * 1000)) + 1

    // 找到對應年份的價格
    const tierForYear = tieredPricing.find(t => t.year === yearsElapsed)
      || tieredPricing[tieredPricing.length - 1] // 超過最高年份用最後一個價格

    if (tierForYear) {
      monthlyRent = tierForYear.monthly_rent
    }
  }

  const multiplier = CYCLE_MULTIPLIER[row.payment_cycle] || 1
  return monthlyRent * multiplier
}

// 取得當前月租（支援階梯式收費）
const getCurrentMonthlyRent = (row) => {
  let monthlyRent = row.monthly_rent || 0

  const tieredPricing = row.metadata?.tiered_pricing
  if (tieredPricing && Array.isArray(tieredPricing) && row.start_date) {
    const startDate = new Date(row.start_date)
    const now = new Date()
    const yearsElapsed = Math.floor((now - startDate) / (365.25 * 24 * 60 * 60 * 1000)) + 1

    const tierForYear = tieredPricing.find(t => t.year === yearsElapsed)
      || tieredPricing[tieredPricing.length - 1]

    if (tierForYear) {
      monthlyRent = tierForYear.monthly_rent
    }
  }

  return monthlyRent
}

export default function Renewals() {
  const navigate = useNavigate()
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('')
  const [renewalNotes, setRenewalNotes] = useState('')
  const [pageSize, setPageSize] = useState(15)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [reminderText, setReminderText] = useState('')
  const queryClient = useQueryClient()

  // 初始化欄位顯示狀態
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const initial = {}
    Object.entries(OPTIONAL_COLUMNS).forEach(([key, { default: def }]) => {
      initial[key] = def
    })
    return initial
  })

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

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

  // 所有欄位定義
  const allColumns = [
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
    {
      key: 'branch_name',
      header: '分館',
      accessor: 'branch_name'
    },
    {
      key: 'contract_number',
      header: '合約',
      accessor: 'contract_number',
      cell: (row) => (
        <p className="font-medium text-primary-600">{row.contract_number}</p>
      )
    },
    {
      key: 'end_date',
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
      key: 'days_until_expiry',
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
      key: 'renewal_status',
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
              setRenewalNotes(row.renewal_notes || '')
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
      key: 'invoice_status',
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
      key: 'monthly_rent',
      header: '月租',
      accessor: 'monthly_rent',
      cell: (row) => (
        <span className="font-medium">${(row.monthly_rent || 0).toLocaleString()}</span>
      )
    },
    {
      key: 'period_amount',
      header: '當期金額',
      accessor: 'period_amount',
      cell: (row) => {
        const periodAmount = getPeriodAmount(row)
        const cycleLabel = CYCLE_LABEL[row.payment_cycle] || row.payment_cycle
        return (
          <div className="text-sm">
            <span className="font-medium text-blue-600">
              ${periodAmount.toLocaleString()}
            </span>
            <span className="text-gray-400 text-xs ml-1">
              ({cycleLabel})
            </span>
          </div>
        )
      }
    },
    {
      key: 'line_user_id',
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
      key: 'actions',
      header: '操作',
      fixed: true,
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.line_user_id && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedContract(row)
                // 設定預設提醒文字
                const periodAmount = getPeriodAmount(row)
                const cycleLabel = CYCLE_LABEL[row.payment_cycle] || ''
                setReminderText(`您好，提醒您合約 ${row.contract_number} 將於 ${row.end_date} 到期，續約金額為 $${periodAmount.toLocaleString()}（${cycleLabel}），請問是否需要續約？`)
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
              setRenewalNotes(row.renewal_notes || '')
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

  // 根據顯示狀態過濾欄位
  const columns = allColumns.filter(col =>
    col.fixed || visibleColumns[col.key]
  )

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
          <label htmlFor="renewal-branch-filter" className="text-sm text-gray-600">分館：</label>
          <select
            id="renewal-branch-filter"
            name="branch-filter"
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
          <label htmlFor="renewal-status-filter" className="text-sm text-gray-600">狀態：</label>
          <select
            id="renewal-status-filter"
            name="status-filter"
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

        <div className="flex items-center gap-2">
          <label htmlFor="renewal-page-size" className="text-sm text-gray-600">每頁：</label>
          <select
            id="renewal-page-size"
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
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2 min-w-[140px]">
                {Object.entries(OPTIONAL_COLUMNS).map(([key, { label }]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
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

        <button
          onClick={() => navigate('/payments/legal-letters')}
          className="btn-secondary"
        >
          <Scale className="w-4 h-4 mr-2" />
          存證信函
        </button>
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
                    <p className="text-sm font-medium text-blue-600">
                      ${getPeriodAmount(item).toLocaleString()}
                      <span className="text-gray-400 text-xs ml-1">
                        ({CYCLE_LABEL[item.payment_cycle] || '月繳'})
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {item.line_user_id && (
                      <button
                        onClick={() => {
                          setSelectedContract(item)
                          const periodAmount = getPeriodAmount(item)
                          const cycleLabel = CYCLE_LABEL[item.payment_cycle] || ''
                          setReminderText(`您好，提醒您合約 ${item.contract_number} 將於 ${item.end_date} 到期，續約金額為 $${periodAmount.toLocaleString()}（${cycleLabel}），請問是否需要續約？`)
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
                        setRenewalNotes(item.renewal_notes || '')
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
        pageSize={pageSize}
        emptyMessage="沒有符合條件的續約提醒"
      />

      {/* 發送提醒 Modal */}
      <Modal
        open={showReminderModal}
        onClose={() => {
          setShowReminderModal(false)
          setSelectedContract(null)
          setReminderText('')
        }}
        title="發送 LINE 續約提醒"
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowReminderModal(false)
                setReminderText('')
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleSendReminder}
              disabled={sendReminder.isPending || !reminderText.trim()}
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
                  {selectedContract.days_until_expiry <= 0
                    ? `已過期 ${Math.abs(selectedContract.days_until_expiry)} 天`
                    : `剩餘 ${selectedContract.days_until_expiry} 天`}
                </Badge>
                <span className="text-sm text-gray-500">
                  到期日：{selectedContract.end_date}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-blue-200">
                <p className="text-sm text-blue-700 font-medium">
                  當期金額：${getPeriodAmount(selectedContract).toLocaleString()}
                  <span className="text-blue-500 text-xs ml-1">
                    ({CYCLE_LABEL[selectedContract.payment_cycle] || '月繳'})
                  </span>
                </p>
              </div>
            </div>

            {/* 提醒文字編輯區 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Edit3 className="w-4 h-4" />
                  提醒訊息內容
                </label>
                <button
                  onClick={() => {
                    const periodAmount = getPeriodAmount(selectedContract)
                    const cycleLabel = CYCLE_LABEL[selectedContract.payment_cycle] || ''
                    setReminderText(`您好，提醒您合約 ${selectedContract.contract_number} 將於 ${selectedContract.end_date} 到期，續約金額為 $${periodAmount.toLocaleString()}（${cycleLabel}），請問是否需要續約？`)
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  重置為預設
                </button>
              </div>
              <textarea
                id="reminder-text"
                name="reminder_text"
                value={reminderText}
                onChange={(e) => setReminderText(e.target.value)}
                placeholder="輸入要發送的提醒訊息..."
                className="input w-full h-32 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                字數：{reminderText.length}
              </p>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
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
              {/* 當前狀態 */}
              {(() => {
                const currentStatus = selectedContract.renewal_status || 'none'
                const currentConfig = RENEWAL_STATUSES[currentStatus]
                const CurrentIcon = currentConfig?.icon || Clock
                return (
                  <div className={`p-3 rounded-lg border-2 border-${currentConfig?.color || 'gray'}-500 bg-${currentConfig?.color || 'gray'}-50 mb-4`}>
                    <div className="flex items-center gap-2">
                      <CurrentIcon className={`w-5 h-5 text-${currentConfig?.color || 'gray'}-500`} />
                      <span className="font-medium">目前狀態：{currentConfig?.label || '待處理'}</span>
                    </div>
                  </div>
                )
              })()}

              {/* 可轉換的狀態按鈕 */}
              {(() => {
                const currentStatus = selectedContract.renewal_status || 'none'
                const validTargets = getValidTargetStatuses(currentStatus)

                if (validTargets.length === 0) {
                  return (
                    <p className="text-sm text-gray-500 text-center py-4">
                      此狀態已是最終狀態，無法變更
                    </p>
                  )
                }

                return (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 mb-2">可變更為：</p>
                    <div className="grid grid-cols-2 gap-2">
                      {validTargets.map((key) => {
                        const { label, color, icon: Icon } = RENEWAL_STATUSES[key]
                        const isBackward = ['none', 'notified'].includes(key) &&
                          ['confirmed', 'paid', 'invoiced', 'signed'].includes(currentStatus)

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
                            className={`p-3 rounded-lg border-2 transition-all hover:border-${color}-400 ${
                              isBackward
                                ? 'border-orange-300 bg-orange-50 hover:bg-orange-100'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 justify-center">
                              <Icon className={`w-5 h-5 text-${color}-500`} />
                              <span className="text-sm font-medium">{label}</span>
                              {isBackward && (
                                <span className="text-xs text-orange-600">(退回)</span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
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

            {/* 備註編輯 */}
            <div>
              <label htmlFor="renewal-notes" className="font-medium mb-2 block">備註（如：新合約金額、特殊條件）</label>
              <textarea
                id="renewal-notes"
                name="renewal_notes"
                value={renewalNotes}
                onChange={(e) => setRenewalNotes(e.target.value)}
                placeholder="例：新合約 $1,800/月 年繳，已匯款，待回傳簽約"
                className="input w-full h-20 resize-none"
              />
              <button
                onClick={() => {
                  updateStatus.mutate({
                    contractId: selectedContract.id,
                    status: selectedContract.renewal_status || 'none',
                    notes: renewalNotes
                  })
                }}
                disabled={updateStatus.isPending || renewalNotes === (selectedContract.renewal_notes || '')}
                className="btn-secondary text-sm mt-2"
              >
                儲存備註
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
