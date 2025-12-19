import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRenewalReminders, useBranches } from '../hooks/useApi'
import { crm, callTool } from '../services/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import {
  Bell,
  Calendar,
  Send,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Receipt,
  PenTool,
  ChevronDown,
  RefreshCw,
  Settings2,
  Edit3,
  Scale,
  Check,
  X,
  Loader2
} from 'lucide-react'

// ============================================================================
// Checklist 相關：Computed Flags 和 Display Status
// ============================================================================

// 從時間戳計算 flags
function computeFlags(contract) {
  return {
    is_notified: !!contract.renewal_notified_at,
    is_confirmed: !!contract.renewal_confirmed_at,
    is_paid: !!contract.renewal_paid_at,
    is_signed: !!contract.renewal_signed_at,
    is_invoiced: contract.invoice_status && contract.invoice_status !== 'pending_tax_id'
  }
}

// 根據 flags 計算顯示狀態
function getDisplayStatus(contract) {
  const flags = computeFlags(contract)

  // 檢查是否全部完成
  const allDone = flags.is_notified && flags.is_confirmed &&
    flags.is_paid && flags.is_invoiced && flags.is_signed
  if (allDone) return { label: '完成', stage: 'completed', progress: 5, issues: [] }

  // 檢查是否尚未開始
  const noneStarted = !flags.is_notified && !flags.is_confirmed &&
    !flags.is_paid && !flags.is_invoiced && !flags.is_signed
  if (noneStarted) return { label: '待處理', stage: 'pending', progress: 0, issues: ['全部待處理'] }

  // 收集缺漏項目
  const issues = []
  if (!flags.is_notified) issues.push('未通知')
  if (!flags.is_confirmed) issues.push('未確認')
  if (!flags.is_paid) issues.push('未收款')
  if (!flags.is_invoiced) issues.push('未開票')
  if (!flags.is_signed) issues.push('未簽約')

  return {
    label: '進行中',
    stage: 'in_progress',
    issues,
    progress: 5 - issues.length
  }
}

// 發票狀態定義
const INVOICE_STATUSES = {
  pending_tax_id: { label: '等待統編', color: 'yellow' },
  issued_personal: { label: '已開二聯', color: 'blue' },
  issued_business: { label: '已開三聯', color: 'green' }
}

// 可選欄位定義
const OPTIONAL_COLUMNS = {
  branch_name: { label: '分館', default: false },
  contract_number: { label: '合約', default: true },
  end_date: { label: '到期日', default: true },
  days_until_expiry: { label: '剩餘', default: true },
  renewal_progress: { label: '續約進度', default: true },
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
  annual: 12,
  biennial: 24
}
const CYCLE_LABEL = {
  monthly: '月繳',
  quarterly: '季繳',
  semi_annual: '半年繳',
  annual: '年繳',
  biennial: '兩年繳'
}

// 計算當期金額（支援階梯式收費）
const getPeriodAmount = (row) => {
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

  const multiplier = CYCLE_MULTIPLIER[row.payment_cycle] || 1
  return monthlyRent * multiplier
}

// ============================================================================
// Checklist Popover 元件
// ============================================================================

function ChecklistPopover({ contract, onUpdate, isUpdating }) {
  const flags = computeFlags(contract)

  const items = [
    { key: 'notified', label: '已通知', icon: Bell, checked: flags.is_notified, timestamp: contract.renewal_notified_at },
    { key: 'confirmed', label: '已確認', icon: CheckCircle, checked: flags.is_confirmed, timestamp: contract.renewal_confirmed_at },
    { key: 'paid', label: '已收款', icon: Receipt, checked: flags.is_paid, timestamp: contract.renewal_paid_at },
    { key: 'signed', label: '已簽約', icon: PenTool, checked: flags.is_signed, timestamp: contract.renewal_signed_at },
  ]

  const invoiceItem = {
    label: '已開票',
    icon: FileText,
    checked: flags.is_invoiced,
    isInvoice: true,
    status: contract.invoice_status
  }

  const formatTime = (ts) => {
    if (!ts) return null
    return new Date(ts).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-3 min-w-[240px]">
      <h4 className="font-medium text-gray-900 mb-3 pb-2 border-b">續約進度 Checklist</h4>
      <div className="space-y-2">
        {items.map(({ key, label, icon: Icon, checked, timestamp }) => (
          <div key={key} className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onUpdate(key, !checked)}
                disabled={isUpdating}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <Icon className={`w-4 h-4 ${checked ? 'text-green-500' : 'text-gray-400'}`} />
              <span className={`text-sm ${checked ? 'text-gray-900' : 'text-gray-500'}`}>
                {label}
              </span>
            </label>
            {timestamp && (
              <span className="text-xs text-gray-400">{formatTime(timestamp)}</span>
            )}
          </div>
        ))}

        {/* 發票狀態（獨立處理） */}
        <div className="pt-2 mt-2 border-t">
          <div className="flex items-center gap-2 mb-2">
            <FileText className={`w-4 h-4 ${invoiceItem.checked ? 'text-green-500' : 'text-gray-400'}`} />
            <span className={`text-sm ${invoiceItem.checked ? 'text-gray-900' : 'text-gray-500'}`}>
              發票狀態
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 ml-6">
            {Object.entries(INVOICE_STATUSES).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => onUpdate('invoice', key)}
                disabled={isUpdating}
                className={`text-xs px-2 py-1 rounded ${
                  contract.invoice_status === key
                    ? 'bg-green-100 text-green-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isUpdating && (
        <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          更新中...
        </div>
      )}
    </div>
  )
}

// ============================================================================
// 進度條元件
// ============================================================================

function ProgressBar({ progress, stage, onClick }) {
  const colors = {
    pending: 'bg-gray-200',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500'
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 group"
    >
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`w-2 h-4 rounded-sm transition-colors ${
              i < progress ? colors[stage] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-gray-500 group-hover:text-gray-700">
        {progress}/5
      </span>
      <ChevronDown className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
    </button>
  )
}

// ============================================================================
// 主元件
// ============================================================================

export default function Renewals() {
  const navigate = useNavigate()
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showChecklistModal, setShowChecklistModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('')
  const [pageSize, setPageSize] = useState(15)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [reminderText, setReminderText] = useState('')
  const [renewalNotes, setRenewalNotes] = useState('')
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

  // 設定 renewal flag
  const setRenewalFlag = useMutation({
    mutationFn: async ({ contractId, flag, value }) => {
      if (flag === 'invoice') {
        // 發票狀態使用獨立 API
        return crm.updateInvoiceStatus(contractId, value)
      }
      return crm.setRenewalFlag(contractId, flag, value)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renewal-reminders'] })
    }
  })

  // 發送 LINE 提醒
  const sendReminder = useMutation({
    mutationFn: async ({ contractId, daysRemaining }) => {
      return callTool('line_send_renewal_reminder', {
        contract_id: contractId,
        days_remaining: daysRemaining
      })
    },
    onSuccess: (_, variables) => {
      // 自動設定已通知
      setRenewalFlag.mutate({
        contractId: variables.contractId,
        flag: 'notified',
        value: true
      })
      setShowReminderModal(false)
      setSelectedContract(null)
    }
  })

  // 更新備註
  const updateNotes = useMutation({
    mutationFn: async ({ contractId, notes }) => {
      return crm.updateRenewalNotes(contractId, notes)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renewal-reminders'] })
    }
  })

  // 處理 Checklist 更新
  const handleChecklistUpdate = (flag, value) => {
    if (!selectedContract) return
    setRenewalFlag.mutate({
      contractId: selectedContract.id,
      flag,
      value
    })
  }

  // 根據篩選過濾資料
  const filteredRenewals = (renewals || []).filter((r) => {
    const status = getDisplayStatus(r)
    if (statusFilter !== 'all' && status.stage !== statusFilter) return false
    if (statusFilter === 'urgent' && r.days_until_expiry > 7) return false
    if (branchFilter && r.branch_id !== parseInt(branchFilter)) return false
    return true
  })

  // 統計各階段數量（4 階段）
  const stageCounts = (renewals || []).reduce((acc, r) => {
    const status = getDisplayStatus(r)
    acc[status.stage] = (acc[status.stage] || 0) + 1
    // 緊急件（7 天內且未完成）
    if (r.days_until_expiry <= 7 && status.stage !== 'completed') {
      acc.urgent = (acc.urgent || 0) + 1
    }
    return acc
  }, { pending: 0, in_progress: 0, completed: 0, urgent: 0 })

  // 緊急件列表
  const urgent = filteredRenewals.filter((r) => {
    const status = getDisplayStatus(r)
    return r.days_until_expiry <= 7 && status.stage !== 'completed'
  })

  // 欄位定義
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
      key: 'renewal_progress',
      header: '續約進度',
      accessor: 'renewal_progress',
      cell: (row) => {
        const status = getDisplayStatus(row)

        return (
          <div className="relative">
            <ProgressBar
              progress={status.progress}
              stage={status.stage}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedContract(row)
                setRenewalNotes(row.renewal_notes || '')
                setShowChecklistModal(true)
              }}
            />
          </div>
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
              setShowChecklistModal(true)
            }}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
            title="更新進度"
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
      {/* 4 階段狀態看板 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 待處理 */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          className={`p-4 rounded-xl border-2 transition-all ${
            statusFilter === 'pending'
              ? 'border-gray-500 bg-gray-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="w-5 h-5 text-gray-500" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-gray-700">{stageCounts.pending}</p>
              <p className="text-sm text-gray-500">待處理</p>
            </div>
          </div>
        </button>

        {/* 進行中 */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
          className={`p-4 rounded-xl border-2 transition-all ${
            statusFilter === 'in_progress'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <RefreshCw className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-blue-700">{stageCounts.in_progress}</p>
              <p className="text-sm text-gray-500">進行中</p>
            </div>
          </div>
        </button>

        {/* 已完成 */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
          className={`p-4 rounded-xl border-2 transition-all ${
            statusFilter === 'completed'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-green-700">{stageCounts.completed}</p>
              <p className="text-sm text-gray-500">已完成</p>
            </div>
          </div>
        </button>

        {/* 急件 */}
        <button
          onClick={() => setStatusFilter(statusFilter === 'urgent' ? 'all' : 'urgent')}
          className={`p-4 rounded-xl border-2 transition-all ${
            statusFilter === 'urgent'
              ? 'border-red-500 bg-red-50'
              : stageCounts.urgent > 0
                ? 'border-red-200 hover:border-red-300 bg-white'
                : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${stageCounts.urgent > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${stageCounts.urgent > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
            <div className="text-left">
              <p className={`text-2xl font-bold ${stageCounts.urgent > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                {stageCounts.urgent}
              </p>
              <p className="text-sm text-gray-500">急件 (7天內)</p>
            </div>
          </div>
        </button>
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
            <h3 className="font-semibold text-red-700">緊急：7天內到期或已過期（尚未完成）</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {urgent.slice(0, 6).map((item) => {
              const status = getDisplayStatus(item)
              return (
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
                      {item.days_until_expiry <= 0 ? `已過期` : `${item.days_until_expiry} 天`}
                    </Badge>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <ProgressBar
                        progress={status.progress}
                        stage={status.stage}
                        onClick={() => {
                          setSelectedContract(item)
                          setRenewalNotes(item.renewal_notes || '')
                          setShowChecklistModal(true)
                        }}
                      />
                      <span className="text-xs text-gray-500">
                        {status.issues.slice(0, 2).join('、')}
                        {status.issues.length > 2 && '...'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-blue-600">
                        ${getPeriodAmount(item).toLocaleString()}
                        <span className="text-gray-400 text-xs ml-1">
                          ({CYCLE_LABEL[item.payment_cycle] || '月繳'})
                        </span>
                      </p>
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
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
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
        onRowClick={(row) => navigate(`/contracts/${row.id}`)}
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
              onClick={() => {
                if (!selectedContract) return
                sendReminder.mutate({
                  contractId: selectedContract.id,
                  daysRemaining: selectedContract.days_until_expiry
                })
              }}
              disabled={sendReminder.isPending || !reminderText.trim()}
              className="btn-primary"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendReminder.isPending ? '發送中...' : '發送並標記已通知'}
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
            </div>

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
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">
                <Check className="w-4 h-4 inline mr-1 text-green-500" />
                發送後將自動勾選「已通知」
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Checklist Modal */}
      <Modal
        open={showChecklistModal}
        onClose={() => {
          setShowChecklistModal(false)
          setSelectedContract(null)
          setRenewalNotes('')
        }}
        title="續約進度管理"
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
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm font-medium text-blue-600">
                  當期金額：${getPeriodAmount(selectedContract).toLocaleString()}
                  <span className="text-gray-400 text-xs ml-1">
                    ({CYCLE_LABEL[selectedContract.payment_cycle] || '月繳'})
                  </span>
                </p>
              </div>
            </div>

            {/* Checklist */}
            <ChecklistPopover
              contract={selectedContract}
              onUpdate={handleChecklistUpdate}
              isUpdating={setRenewalFlag.isPending}
            />

            {/* 備註 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">備註</label>
              <textarea
                value={renewalNotes}
                onChange={(e) => setRenewalNotes(e.target.value)}
                placeholder="輸入備註..."
                className="input w-full h-20 resize-none"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => {
                    updateNotes.mutate({
                      contractId: selectedContract.id,
                      notes: renewalNotes
                    })
                  }}
                  disabled={updateNotes.isPending || renewalNotes === (selectedContract.renewal_notes || '')}
                  className="btn-secondary text-sm"
                >
                  {updateNotes.isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      儲存中...
                    </>
                  ) : '儲存備註'}
                </button>
              </div>
            </div>

            {/* 時間軸 */}
            {(selectedContract.renewal_notified_at ||
              selectedContract.renewal_confirmed_at ||
              selectedContract.renewal_paid_at ||
              selectedContract.renewal_signed_at) && (
              <div>
                <h4 className="font-medium mb-3">處理記錄</h4>
                <div className="space-y-2 text-sm">
                  {selectedContract.renewal_notified_at && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Bell className="w-4 h-4 text-blue-500" />
                      <span>通知：{new Date(selectedContract.renewal_notified_at).toLocaleString('zh-TW')}</span>
                    </div>
                  )}
                  {selectedContract.renewal_confirmed_at && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="w-4 h-4 text-purple-500" />
                      <span>確認：{new Date(selectedContract.renewal_confirmed_at).toLocaleString('zh-TW')}</span>
                    </div>
                  )}
                  {selectedContract.renewal_paid_at && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Receipt className="w-4 h-4 text-green-500" />
                      <span>收款：{new Date(selectedContract.renewal_paid_at).toLocaleString('zh-TW')}</span>
                    </div>
                  )}
                  {selectedContract.renewal_signed_at && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <PenTool className="w-4 h-4 text-orange-500" />
                      <span>簽約：{new Date(selectedContract.renewal_signed_at).toLocaleString('zh-TW')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
