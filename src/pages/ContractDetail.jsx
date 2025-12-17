import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useContractDetail, useRecordPayment, useSendPaymentReminder, useUpdateCustomer } from '../hooks/useApi'
import { crm } from '../services/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Modal from '../components/Modal'
import Badge, { StatusBadge } from '../components/Badge'
import {
  ArrowLeft,
  Edit2,
  User,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  FileText,
  CreditCard,
  Calendar,
  Building,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  Send,
  Loader2,
  Save,
  X,
  RefreshCw,
  Bell,
  Receipt,
  PenTool,
  ChevronDown,
  FileDown,
  ExternalLink
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

// ============================================================================
// Checklist Popover 元件
// ============================================================================

function ChecklistPopover({ contract, onUpdate, onSaveNotes, isUpdating, onClose }) {
  const flags = computeFlags(contract)
  const popoverRef = useRef(null)
  const [notes, setNotes] = useState(contract.renewal_notes || '')
  const [notesChanged, setNotesChanged] = useState(false)

  // 點擊外部關閉
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // 同步外部 notes 變更
  useEffect(() => {
    setNotes(contract.renewal_notes || '')
    setNotesChanged(false)
  }, [contract.renewal_notes])

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

  const handleNotesChange = (e) => {
    setNotes(e.target.value)
    setNotesChanged(e.target.value !== (contract.renewal_notes || ''))
  }

  const handleSaveNotes = () => {
    if (notesChanged) {
      onSaveNotes(notes)
      setNotesChanged(false)
    }
  }

  return (
    <div ref={popoverRef} className="absolute top-full left-0 mt-2 bg-white border rounded-lg shadow-lg z-50 p-3 min-w-[320px]">
      <h4 className="font-medium text-gray-900 mb-3 pb-2 border-b">續約進度 Checklist</h4>
      <div className="space-y-2">
        {items.map(({ key, label, icon: Icon, checked, timestamp }) => (
          <div key={key} className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  console.log('[Checkbox] clicked:', key, '→', !checked)
                  onUpdate(key, !checked)
                }}
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

        {/* 備註欄位 */}
        <div className="pt-2 mt-2 border-t">
          <label className="block text-sm text-gray-600 mb-1">
            備註（發票日期、統編等）
          </label>
          <textarea
            value={notes}
            onChange={handleNotesChange}
            placeholder="例：12/20 開立發票，統編 12345678"
            className="w-full text-sm border rounded p-2 h-16 resize-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
          {notesChanged && (
            <button
              onClick={handleSaveNotes}
              disabled={isUpdating}
              className="mt-1 w-full text-xs px-2 py-1.5 bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50"
            >
              儲存備註
            </button>
          )}
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

function ProgressBar({ progress, stage }) {
  const colors = {
    pending: 'bg-gray-200',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-5 rounded-sm transition-colors ${
              i < progress ? colors[stage] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <span className="text-sm text-gray-600">{progress}/5</span>
    </div>
  )
}

// 合約類型對照
const CONTRACT_TYPES = {
  virtual_office: '虛擬辦公室',
  shared_space: '共享空間',
  coworking_fixed: '固定座位',
  coworking_flexible: '自由座位',
  meeting_room: '會議室',
  mailbox: '郵件代收'
}

// 繳費週期對照
const PAYMENT_CYCLES = {
  monthly: '月繳',
  quarterly: '季繳',
  semi_annual: '半年繳',
  annual: '年繳'
}

// 繳費週期乘數
const CYCLE_MULTIPLIER = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12
}

export default function ContractDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: result, isLoading, refetch } = useContractDetail(id)
  const recordPayment = useRecordPayment()
  const sendReminder = useSendPaymentReminder()
  const updateCustomer = useUpdateCustomer()

  const [showPayModal, setShowPayModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false)
  const [showChecklistPopover, setShowChecklistPopover] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [pdfResult, setPdfResult] = useState(null)
  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'transfer',
    reference: ''
  })
  const [customerForm, setCustomerForm] = useState({})

  // 設定 renewal flag (Checklist)
  const setRenewalFlag = useMutation({
    mutationFn: async ({ contractId, flag, value }) => {
      console.log('[setRenewalFlag] mutationFn called:', { contractId, flag, value })
      if (flag === 'invoice') {
        // 發票狀態使用獨立 API
        return crm.updateInvoiceStatus(contractId, value)
      }
      return crm.setRenewalFlag(contractId, flag, value)
    },
    onSuccess: (data) => {
      console.log('[setRenewalFlag] onSuccess:', data)
      // 強制 refetch 而不只是 invalidate
      queryClient.refetchQueries({ queryKey: ['contract', id] })
      queryClient.refetchQueries({ queryKey: ['renewals'] })
    },
    onError: (error) => {
      console.error('[setRenewalFlag] onError:', error)
    }
  })

  // 處理 Checklist 更新
  const handleChecklistUpdate = (flag, value) => {
    if (!contract) return
    setRenewalFlag.mutate({
      contractId: contract.id,
      flag,
      value
    })
  }

  // 儲存續約備註
  const saveNotes = useMutation({
    mutationFn: async ({ contractId, notes }) => {
      return crm.updateRenewalNotes(contractId, notes)
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['contract', id] })
    }
  })

  const handleSaveNotes = (notes) => {
    if (!contract) return
    saveNotes.mutate({ contractId: contract.id, notes })
  }

  const contract = result?.data?.contract
  const customer = result?.data?.customer
  const branch = result?.data?.branch
  const payments = result?.data?.payments || []

  // 計算繳費統計
  const paymentStats = {
    total: payments.length,
    paid: payments.filter(p => p.payment_status === 'paid').length,
    pending: payments.filter(p => p.payment_status === 'pending').length,
    overdue: payments.filter(p => p.payment_status === 'overdue').length,
    totalPaid: payments.filter(p => p.payment_status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0),
    totalPending: payments.filter(p => p.payment_status === 'pending' || p.payment_status === 'overdue').reduce((sum, p) => sum + (p.amount || 0), 0)
  }

  // 記錄繳費
  const handleRecordPayment = async () => {
    await recordPayment.mutateAsync({
      paymentId: selectedPayment.id,
      paymentMethod: paymentForm.payment_method,
      reference: paymentForm.reference
    })
    setShowPayModal(false)
    setSelectedPayment(null)
    setPaymentForm({ payment_method: 'transfer', reference: '' })
    refetch()
  }

  // 發送催繳
  const handleSendReminder = async () => {
    await sendReminder.mutateAsync({
      customerId: customer.id,
      amount: selectedPayment.amount,
      dueDate: selectedPayment.due_date
    })
    setShowReminderModal(false)
    setSelectedPayment(null)
  }

  // 編輯客戶資料
  const startEditCustomer = () => {
    setCustomerForm({
      name: customer?.name || '',
      company_name: customer?.company_name || '',
      phone: customer?.phone || '',
      email: customer?.email || '',
      address: customer?.address || '',
      risk_level: customer?.risk_level || 'low'
    })
    setShowEditCustomerModal(true)
  }

  const handleSaveCustomer = async () => {
    await updateCustomer.mutateAsync({
      customerId: customer.id,
      data: customerForm
    })
    setShowEditCustomerModal(false)
    refetch()
  }

  // 生成合約 PDF
  const handleGeneratePdf = async () => {
    if (!contract?.id) return
    setGeneratingPdf(true)
    setPdfResult(null)
    try {
      const result = await crm.generateContractPdf(contract.id)
      const pdfUrl = result?.result?.pdf_url || result?.pdf_url
      const isSuccess = result?.result?.success || result?.success
      const expiresAt = result?.result?.expires_at || result?.expires_at
      const message = result?.result?.message || result?.message

      if (isSuccess && pdfUrl) {
        setPdfResult({
          url: pdfUrl,
          expiresAt,
          message
        })
        // 自動開啟下載連結
        window.open(pdfUrl, '_blank')
      } else {
        const errorMsg = result?.result?.error || message || '生成失敗'
        alert(errorMsg)
      }
    } catch (error) {
      console.error('生成合約 PDF 失敗:', error)
      alert('生成合約 PDF 失敗: ' + (error.message || '未知錯誤'))
    } finally {
      setGeneratingPdf(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">找不到合約資料</p>
        <button onClick={() => navigate('/contracts')} className="btn-primary mt-4">
          返回合約列表
        </button>
      </div>
    )
  }

  // 計算每期金額
  const periodAmount = (contract.monthly_rent || 0) * (CYCLE_MULTIPLIER[contract.payment_cycle] || 1)

  return (
    <div className="space-y-6">
      {/* 頂部導覽 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/contracts')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{contract.contract_number}</h1>
            <StatusBadge status={contract.status} />
          </div>
          <p className="text-gray-500">
            {CONTRACT_TYPES[contract.contract_type] || contract.contract_type}
            {contract.plan_name && ` - ${contract.plan_name}`}
          </p>
        </div>
        <button onClick={refetch} className="btn-secondary" title="重新整理">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={handleGeneratePdf}
          disabled={generatingPdf}
          className="btn-primary"
          title="下載合約 PDF"
        >
          {generatingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <FileDown className="w-4 h-4 mr-2" />
          )}
          {generatingPdf ? '生成中...' : '下載 PDF'}
        </button>
        {pdfResult?.url && (
          <a
            href={pdfResult.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            title="開啟 PDF"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* 主要內容 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：客戶資訊卡片 */}
        <div className="space-y-6">
          {/* 客戶資料卡 */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title flex items-center gap-2">
                <User className="w-5 h-5 text-primary-500" />
                客戶資訊
              </h3>
              <button onClick={startEditCustomer} className="text-gray-400 hover:text-gray-600">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center">
                <span className="text-xl font-bold text-white">
                  {customer?.name?.charAt(0) || '?'}
                </span>
              </div>
              <div>
                <p className="font-semibold text-lg">{customer?.name || '-'}</p>
                {customer?.company_name && (
                  <p className="text-sm text-gray-500">{customer.company_name}</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {customer?.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${customer.phone}`} className="text-primary-600 hover:underline">
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer?.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${customer.email}`} className="text-primary-600 hover:underline">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer?.address && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{customer.address}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                {customer?.line_user_id ? (
                  <Badge variant="success" dot>LINE 已綁定</Badge>
                ) : (
                  <Badge variant="gray">LINE 未綁定</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">風險等級：</span>
                <StatusBadge status={customer?.risk_level || 'low'} />
              </div>
            </div>
          </div>

          {/* 分館資訊 */}
          <div className="card">
            <h3 className="card-title flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-blue-500" />
              分館
            </h3>
            <p className="font-medium">{branch?.name || '-'}</p>
            {contract.rental_address && (
              <p className="text-sm text-gray-500 mt-1">{contract.rental_address}</p>
            )}
          </div>

          {/* 繳費統計 */}
          <div className="card">
            <h3 className="card-title flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-green-500" />
              繳費統計
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">已付總額</span>
                <span className="font-semibold text-green-600">
                  ${paymentStats.totalPaid.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">待繳金額</span>
                <span className="font-semibold text-blue-600">
                  ${paymentStats.totalPending.toLocaleString()}
                </span>
              </div>
              {paymentStats.overdue > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>逾期 ({paymentStats.overdue} 筆)</span>
                  <span className="font-semibold">
                    ${payments.filter(p => p.payment_status === 'overdue').reduce((sum, p) => sum + (p.amount || 0), 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右側：合約資訊和繳費記錄 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 合約資訊 */}
          <div className="card">
            <h3 className="card-title flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-primary-500" />
              合約資訊
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">合約期間</p>
                <p className="font-medium">{contract.start_date}</p>
                <p className="text-sm text-gray-500">至 {contract.end_date}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">月租金額</p>
                <p className="font-semibold text-lg text-green-600">
                  ${(contract.monthly_rent || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">繳費週期</p>
                <p className="font-medium">
                  {PAYMENT_CYCLES[contract.payment_cycle] || contract.payment_cycle}
                </p>
                <p className="text-sm text-gray-500">
                  ${periodAmount.toLocaleString()}/期
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">押金</p>
                <p className="font-medium">
                  ${(contract.deposit || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">
                  {contract.deposit_status === 'held' ? '持有中' :
                   contract.deposit_status === 'refunded' ? '已退還' : '已沒收'}
                </p>
              </div>
            </div>

            {/* 續約進度 Checklist */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">續約進度</span>
                </div>
                {(() => {
                  const status = getDisplayStatus(contract)
                  const stageColors = {
                    pending: 'bg-gray-100 text-gray-600',
                    in_progress: 'bg-blue-100 text-blue-700',
                    completed: 'bg-green-100 text-green-700'
                  }
                  return (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${stageColors[status.stage]}`}>
                      {status.label}
                    </span>
                  )
                })()}
              </div>

              {/* 進度條 + 展開按鈕 */}
              <div className="relative">
                <button
                  onClick={() => setShowChecklistPopover(!showChecklistPopover)}
                  className="flex items-center gap-3 w-full p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <ProgressBar
                    progress={getDisplayStatus(contract).progress}
                    stage={getDisplayStatus(contract).stage}
                  />
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showChecklistPopover ? 'rotate-180' : ''}`} />
                </button>

                {/* Checklist Popover */}
                {showChecklistPopover && (
                  <ChecklistPopover
                    contract={contract}
                    onUpdate={handleChecklistUpdate}
                    onSaveNotes={handleSaveNotes}
                    isUpdating={setRenewalFlag.isPending || saveNotes.isPending}
                    onClose={() => setShowChecklistPopover(false)}
                  />
                )}
              </div>

              {/* 備註 */}
              {contract.renewal_notes && (
                <p className="text-xs text-gray-500 mt-2">{contract.renewal_notes}</p>
              )}
            </div>
          </div>

          {/* 繳費記錄 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-500" />
                繳費記錄
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant="success">{paymentStats.paid} 已付</Badge>
                <Badge variant="info">{paymentStats.pending} 待繳</Badge>
                {paymentStats.overdue > 0 && (
                  <Badge variant="danger">{paymentStats.overdue} 逾期</Badge>
                )}
              </div>
            </div>

            {payments.length === 0 ? (
              <p className="text-center py-8 text-gray-500">尚無繳費記錄</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>期別</th>
                      <th>金額</th>
                      <th>到期日</th>
                      <th>狀態</th>
                      <th>付款日</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="font-medium">{payment.payment_period}</td>
                        <td>${(payment.amount || 0).toLocaleString()}</td>
                        <td>{payment.due_date}</td>
                        <td><StatusBadge status={payment.payment_status} /></td>
                        <td>{payment.paid_at || '-'}</td>
                        <td>
                          {payment.payment_status === 'pending' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setSelectedPayment(payment)
                                  setShowPayModal(true)
                                }}
                                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                              >
                                記錄繳費
                              </button>
                            </div>
                          )}
                          {payment.payment_status === 'overdue' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setSelectedPayment(payment)
                                  setShowPayModal(true)
                                }}
                                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                              >
                                記錄繳費
                              </button>
                              {customer?.line_user_id && (
                                <button
                                  onClick={() => {
                                    setSelectedPayment(payment)
                                    setShowReminderModal(true)
                                  }}
                                  className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                                >
                                  催繳
                                </button>
                              )}
                            </div>
                          )}
                          {payment.payment_status === 'paid' && (
                            <span className="text-xs text-gray-400">
                              {payment.payment_method === 'transfer' ? '轉帳' :
                               payment.payment_method === 'cash' ? '現金' :
                               payment.payment_method === 'card' ? '刷卡' : payment.payment_method}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 記錄繳費 Modal */}
      <Modal
        open={showPayModal}
        onClose={() => {
          setShowPayModal(false)
          setSelectedPayment(null)
        }}
        title="記錄繳費"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">期別</p>
              <p className="font-medium">{selectedPayment.payment_period}</p>
              <p className="text-sm text-gray-500 mt-2">金額</p>
              <p className="font-semibold text-lg text-green-600">
                ${(selectedPayment.amount || 0).toLocaleString()}
              </p>
            </div>

            <div>
              <label htmlFor="payment-method" className="label">付款方式</label>
              <select
                id="payment-method"
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                className="input"
              >
                <option value="transfer">銀行轉帳</option>
                <option value="cash">現金</option>
                <option value="card">信用卡</option>
              </select>
            </div>

            <div>
              <label htmlFor="payment-reference" className="label">參考編號（選填）</label>
              <input
                id="payment-reference"
                type="text"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                className="input"
                placeholder="轉帳帳號後五碼..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setShowPayModal(false)} className="btn-secondary">
                取消
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={recordPayment.isPending}
                className="btn-primary"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {recordPayment.isPending ? '處理中...' : '確認繳費'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 發送催繳 Modal */}
      <Modal
        open={showReminderModal}
        onClose={() => {
          setShowReminderModal(false)
          setSelectedPayment(null)
        }}
        title="發送 LINE 催繳通知"
      >
        {selectedPayment && (
          <div className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-orange-600">
                將發送催繳通知給 {customer?.name}
              </p>
              <p className="font-medium mt-2">
                {selectedPayment.payment_period} - ${(selectedPayment.amount || 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">
                到期日：{selectedPayment.due_date}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setShowReminderModal(false)} className="btn-secondary">
                取消
              </button>
              <button
                onClick={handleSendReminder}
                disabled={sendReminder.isPending}
                className="btn-primary bg-orange-500 hover:bg-orange-600"
              >
                <Send className="w-4 h-4 mr-2" />
                {sendReminder.isPending ? '發送中...' : '發送催繳'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 編輯客戶資料 Modal */}
      <Modal
        open={showEditCustomerModal}
        onClose={() => setShowEditCustomerModal(false)}
        title="編輯客戶資料"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="customer-name" className="label">姓名</label>
              <input
                id="customer-name"
                type="text"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="customer-company" className="label">公司名稱</label>
              <input
                id="customer-company"
                type="text"
                value={customerForm.company_name}
                onChange={(e) => setCustomerForm({ ...customerForm, company_name: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="customer-phone" className="label">電話</label>
              <input
                id="customer-phone"
                type="tel"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="customer-email" className="label">Email</label>
              <input
                id="customer-email"
                type="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="customer-address" className="label">地址</label>
            <input
              id="customer-address"
              type="text"
              value={customerForm.address}
              onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label htmlFor="customer-risk" className="label">風險等級</label>
            <select
              id="customer-risk"
              value={customerForm.risk_level}
              onChange={(e) => setCustomerForm({ ...customerForm, risk_level: e.target.value })}
              className="input"
            >
              <option value="low">低風險</option>
              <option value="normal">正常</option>
              <option value="medium">中風險</option>
              <option value="high">高風險</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button onClick={() => setShowEditCustomerModal(false)} className="btn-secondary">
              <X className="w-4 h-4 mr-2" />
              取消
            </button>
            <button
              onClick={handleSaveCustomer}
              disabled={updateCustomer.isPending}
              className="btn-primary"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateCustomer.isPending ? '儲存中...' : '儲存'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
