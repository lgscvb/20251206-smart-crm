import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { callTool, db, crm } from '../services/api'
import useStore from '../store/useStore'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge, { StatusBadge } from '../components/Badge'
import { pdf } from '@react-pdf/renderer'
import QuotePDF from '../components/pdf/QuotePDF'
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  User,
  Calendar,
  DollarSign,
  Eye,
  Copy,
  Loader2,
  ArrowRightCircle,
  FileDown
} from 'lucide-react'

// 狀態中文對照
const STATUS_LABELS = {
  draft: '草稿',
  sent: '已發送',
  viewed: '已檢視',
  accepted: '已接受',
  rejected: '已拒絕',
  expired: '已過期',
  converted: '已轉換'
}

// 狀態顏色
const STATUS_VARIANTS = {
  draft: 'gray',
  sent: 'info',
  viewed: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'gray',
  converted: 'success'
}

// 合約類型
const CONTRACT_TYPES = {
  virtual_office: '營業登記',
  office: '辦公室',
  hot_desk: '共享辦公位',
  meeting_room: '會議室',
  custom: '自訂'
}

// 營業登記方案選項
const VIRTUAL_OFFICE_OPTIONS = {
  original_price: 3000, // 原價
  prices: [1490, 1690, 1800, 2000], // 折扣價選項
  cycles: [
    { label: '年繳', months: 12 },
    { label: '半年繳', months: 6 }
  ]
}

// 服務類型預設值（簡化版，無階梯式定價）
const SERVICE_PRESETS = {
  virtual_office: {
    label: '營業登記',
    description: '商業登記地址服務',
    plan_name: '營業登記方案',
    contract_months: 12,
    deposit_amount: 6000,
    original_price: 3000, // 原價（用於合約）
    hasSubOptions: true, // 標記有子選項
    items: [
      { name: '商登月租費', quantity: 12, unit: '月', unit_price: 1490, amount: 17880 }
    ]
  },
  office: {
    label: '辦公室',
    description: '獨立辦公室租賃',
    plan_name: '辦公室租賃',
    contract_months: 12,
    deposit_amount: 0, // 依辦公室定
    items: [
      { name: '辦公室月租', quantity: 1, unit: '月', unit_price: 0, amount: 0 }
    ],
    // 辦公室子選項（價格需手動調整）
    subOptions: [
      { label: 'A 室', price: 0 },
      { label: 'B 室', price: 0 },
      { label: 'C 室', price: 0 },
      { label: 'D 室', price: 13500 }
    ]
  },
  hot_desk: {
    label: '共享辦公位',
    description: 'Hot Desking 彈性座位',
    plan_name: '共享辦公位方案',
    contract_months: 1,
    deposit_amount: 0,
    items: [
      { name: '共享辦公位月租', quantity: 1, unit: '月', unit_price: 3000, amount: 3000 }
    ]
  },
  meeting_room: {
    label: '會議室',
    description: '會議室租用',
    plan_name: '會議室租用',
    contract_months: 1,
    deposit_amount: 0,
    items: [
      { name: '會議室租用', quantity: 1, unit: '小時', unit_price: 2000, amount: 2000 }
    ]
  },
  custom: {
    label: '自訂',
    description: '自訂方案內容',
    plan_name: '',
    contract_months: 12,
    deposit_amount: 0,
    items: [
      { name: '', quantity: 1, unit: '', unit_price: 0, amount: 0 }
    ]
  }
}

export default function Quotes() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false) // 轉合約 Modal
  const [selectedQuote, setSelectedQuote] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(null) // 正在生成 PDF 的報價單 ID

  // 轉合約表單狀態（承租人資訊）
  const [contractForm, setContractForm] = useState({
    company_name: '',
    representative_name: '',
    representative_address: '',
    id_number: '',
    company_tax_id: '',
    phone: '',
    email: '',
    start_date: '',
    end_date: '',
    original_price: '',
    monthly_rent: '',
    deposit_amount: '',
    payment_cycle: 'monthly',
    payment_day: new Date().getDate()  // 預設為當日
  })

  // 表單狀態
  const [form, setForm] = useState({
    branch_id: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    company_name: '',
    contract_type: 'virtual_office',
    plan_name: '',
    contract_months: 12,
    original_price: 3000, // 原價（營業登記預設 3000）
    items: [{ name: '商登月租費', quantity: 12, unit: '月', unit_price: 1490, amount: 17880 }],
    discount_amount: 0,
    discount_note: '',
    deposit_amount: 6000,
    valid_days: 30,
    internal_notes: '',
    customer_notes: ''
  })

  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)
  const selectedBranch = useStore((state) => state.selectedBranch)

  // 取得分館列表
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => db.getBranches()
  })

  // 取得報價單列表
  const { data: quotesData, isLoading, refetch } = useQuery({
    queryKey: ['quotes', statusFilter, selectedBranch],
    queryFn: async () => {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (selectedBranch) params.branch_id = selectedBranch
      return callTool('quote_list', params)
    }
  })

  // 建立報價單
  const createQuote = useMutation({
    mutationFn: (data) => callTool('quote_create', data),
    onSuccess: (response) => {
      const data = response?.result || response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['quotes'] })
        addNotification({ type: 'success', message: '報價單建立成功' })
        setShowCreateModal(false)
        resetForm()
      } else {
        addNotification({ type: 'error', message: data.message || '建立失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `建立失敗: ${error.message}` })
    }
  })

  // 更新報價單狀態
  const updateStatus = useMutation({
    mutationFn: ({ quoteId, status }) => callTool('quote_update_status', { quote_id: quoteId, status }),
    onSuccess: (response) => {
      const data = response?.result || response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['quotes'] })
        addNotification({ type: 'success', message: '狀態更新成功' })
      } else {
        addNotification({ type: 'error', message: data.message || '更新失敗' })
      }
    }
  })

  // 刪除報價單
  const deleteQuote = useMutation({
    mutationFn: (quoteId) => callTool('quote_delete', { quote_id: quoteId }),
    onSuccess: (response) => {
      const data = response?.result || response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['quotes'] })
        addNotification({ type: 'success', message: '報價單已刪除' })
        setShowDetailModal(false)
      } else {
        addNotification({ type: 'error', message: data.message || '刪除失敗' })
      }
    }
  })

  // 轉換為合約（帶完整客戶資訊）
  const convertToContract = useMutation({
    mutationFn: (data) => callTool('quote_convert_to_contract', data),
    onSuccess: (response) => {
      const data = response?.result || response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['quotes'] })
        queryClient.invalidateQueries({ queryKey: ['contracts'] })
        addNotification({
          type: 'success',
          message: `已成功轉換為合約 ${data.contract?.contract_number || ''}`
        })
        setShowDetailModal(false)
        setShowConvertModal(false)
        resetContractForm()
        // 跳轉到合約管理頁面
        navigate('/contracts')
      } else {
        addNotification({ type: 'error', message: data.message || '轉換失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `轉換失敗: ${error.message}` })
    }
  })

  // 重設轉合約表單
  const resetContractForm = () => {
    setContractForm({
      company_name: '',
      representative_name: '',
      representative_address: '',
      id_number: '',
      company_tax_id: '',
      phone: '',
      email: '',
      start_date: '',
      end_date: '',
      original_price: '',
      monthly_rent: '',
      deposit_amount: '',
      payment_cycle: 'monthly',
      payment_day: new Date().getDate()  // 預設為當日
    })
  }

  // 開啟轉合約 Modal
  const openConvertModal = (quote) => {
    // 預填部分資料
    const today = new Date()
    const startDate = quote.proposed_start_date || today.toISOString().split('T')[0]
    const months = quote.contract_months || 12
    const endDate = new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + months))

    // 計算月租（折扣價）= 總金額 / 月數
    const monthlyRent = quote.total_amount ? Math.round(quote.total_amount / months) : ''

    setContractForm({
      company_name: quote.company_name || '',
      representative_name: quote.customer_name || '',
      representative_address: '',
      id_number: '',
      company_tax_id: '',
      phone: quote.customer_phone || '',
      email: quote.customer_email || '',
      start_date: startDate,
      end_date: endDate.toISOString().split('T')[0],
      original_price: quote.original_price || '', // 自動帶入報價單的原價
      monthly_rent: monthlyRent,
      deposit_amount: quote.deposit_amount || '',
      payment_cycle: 'monthly',
      payment_day: new Date().getDate()  // 預設為當日
    })
    setSelectedQuote(quote)
    setShowDetailModal(false)
    setShowConvertModal(true)
  }

  // 執行轉換為合約
  const handleConvertToContract = () => {
    if (!contractForm.representative_name) {
      addNotification({ type: 'error', message: '請填寫負責人姓名' })
      return
    }
    if (!contractForm.phone) {
      addNotification({ type: 'error', message: '請填寫聯絡電話' })
      return
    }
    if (!contractForm.start_date || !contractForm.end_date) {
      addNotification({ type: 'error', message: '請填寫合約起訖日期' })
      return
    }

    convertToContract.mutate({
      quote_id: selectedQuote.id,
      company_name: contractForm.company_name || null,
      representative_name: contractForm.representative_name,
      representative_address: contractForm.representative_address || null,
      id_number: contractForm.id_number || null,
      company_tax_id: contractForm.company_tax_id || null,
      phone: contractForm.phone,
      email: contractForm.email || null,
      start_date: contractForm.start_date,
      end_date: contractForm.end_date,
      original_price: contractForm.original_price ? parseFloat(contractForm.original_price) : null,
      monthly_rent: contractForm.monthly_rent ? parseFloat(contractForm.monthly_rent) : null,
      deposit_amount: contractForm.deposit_amount ? parseFloat(contractForm.deposit_amount) : null,
      payment_cycle: contractForm.payment_cycle,
      payment_day: contractForm.payment_day
    })
  }

  // 生成報價單 PDF (前端生成)
  const handleGeneratePdf = async (quote) => {
    setGeneratingPdf(quote.id)
    try {
      // 準備 PDF 資料
      const pdfData = {
        quote_number: quote.quote_number,
        valid_from: quote.valid_from,
        valid_until: quote.valid_until,
        branch_name: quote.branch_name || '台中館',
        plan_name: quote.plan_name,
        items: typeof quote.items === 'string' ? JSON.parse(quote.items) : (quote.items || []),
        deposit_amount: quote.deposit_amount ?? 6000,
        total_amount: quote.total_amount || 0,
        // 根據分館設定銀行資訊
        bank_account_name: '你的空間有限公司',
        bank_name: '永豐商業銀行(南台中分行)',
        bank_code: '807',
        bank_account_number: '03801800183399',
        contact_email: 'wtxg@hourjungle.com',
        contact_phone: '04-23760282'
      }

      // 前端生成 PDF
      const blob = await pdf(<QuotePDF data={pdfData} />).toBlob()
      const url = URL.createObjectURL(blob)

      // 開啟新視窗顯示 PDF
      window.open(url, '_blank')
      addNotification({ type: 'success', message: '報價單 PDF 生成成功' })
    } catch (error) {
      console.error('生成報價單 PDF 失敗:', error)
      addNotification({ type: 'error', message: '生成報價單 PDF 失敗: ' + (error.message || '未知錯誤') })
    } finally {
      setGeneratingPdf(null)
    }
  }

  const resetForm = () => {
    setForm({
      branch_id: selectedBranch || '',
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      company_name: '',
      contract_type: 'virtual_office',
      plan_name: '營業登記方案',
      contract_months: 12,
      original_price: 3000, // 營業登記原價
      items: [{ name: '商登月租費', quantity: 12, unit: '月', unit_price: 1490, amount: 17880 }],
      discount_amount: 0,
      discount_note: '',
      deposit_amount: 6000,
      valid_days: 30,
      internal_notes: '',
      customer_notes: ''
    })
    setIsEditing(false)
  }

  const handleCreateQuote = () => {
    if (!form.branch_id) {
      addNotification({ type: 'error', message: '請選擇場館' })
      return
    }
    // 姓名改為非必填

    createQuote.mutate({
      branch_id: parseInt(form.branch_id),
      customer_name: form.customer_name || null,
      customer_phone: form.customer_phone || null,
      customer_email: form.customer_email || null,
      company_name: form.company_name || null,
      contract_type: form.contract_type,
      plan_name: form.plan_name || null,
      contract_months: form.contract_months,
      original_price: parseFloat(form.original_price) || null, // 原價
      items: form.items,
      discount_amount: parseFloat(form.discount_amount) || 0,
      discount_note: form.discount_note || null,
      deposit_amount: parseFloat(form.deposit_amount) || 0,
      valid_days: form.valid_days,
      internal_notes: form.internal_notes || null,
      customer_notes: form.customer_notes || null
    })
  }

  // 更新項目金額
  const updateItemAmount = (index) => {
    const newItems = [...form.items]
    newItems[index].amount = newItems[index].quantity * newItems[index].unit_price
    setForm({ ...form, items: newItems })
  }

  // 新增項目
  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { name: '', quantity: 1, unit: '月', unit_price: 0, amount: 0 }]
    })
  }

  // 套用服務類型預設值
  const applyServicePreset = (serviceType) => {
    const preset = SERVICE_PRESETS[serviceType]
    if (!preset) return

    setForm({
      ...form,
      contract_type: serviceType,
      plan_name: preset.plan_name,
      contract_months: preset.contract_months,
      deposit_amount: preset.deposit_amount,
      original_price: preset.original_price || 0, // 原價（營業登記用）
      items: preset.items.map(item => ({ ...item })) // 深拷貝避免修改原始資料
    })
  }

  // 移除項目
  const removeItem = (index) => {
    const newItems = form.items.filter((_, i) => i !== index)
    setForm({ ...form, items: newItems })
  }

  // 計算總金額
  const subtotal = form.items.reduce((sum, item) => sum + (item.amount || 0), 0)
  const total = subtotal - (parseFloat(form.discount_amount) || 0)

  const quotes = quotesData?.result?.quotes || quotesData?.quotes || []
  const stats = quotesData?.result?.stats || quotesData?.stats || {}

  const columns = [
    {
      header: '報價單號',
      accessor: 'quote_number',
      cell: (row) => (
        <button
          onClick={() => {
            setSelectedQuote(row)
            setShowDetailModal(true)
          }}
          className="text-primary-600 font-medium hover:underline"
        >
          {row.quote_number}
        </button>
      )
    },
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
      header: '場館',
      accessor: 'branch_name'
    },
    {
      header: '方案',
      accessor: 'plan_name',
      cell: (row) => (
        <div>
          <p className="text-sm">{row.plan_name || CONTRACT_TYPES[row.contract_type]}</p>
          <p className="text-xs text-gray-500">{row.contract_months} 個月</p>
        </div>
      )
    },
    {
      header: '金額',
      accessor: 'total_amount',
      cell: (row) => (
        <span className="font-semibold text-green-600">
          ${(row.total_amount || 0).toLocaleString()}
        </span>
      )
    },
    {
      header: '有效期',
      accessor: 'valid_until',
      cell: (row) => (
        <div className="text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {row.valid_until}
          </div>
          {row.is_expired && row.status !== 'accepted' && row.status !== 'converted' && (
            <Badge variant="danger" className="mt-1">已過期</Badge>
          )}
        </div>
      )
    },
    {
      header: '狀態',
      accessor: 'status',
      cell: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] || 'gray'}>
          {STATUS_LABELS[row.status] || row.status}
        </Badge>
      )
    },
    {
      header: '操作',
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setSelectedQuote(row)
              setShowDetailModal(true)
            }}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="檢視"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleGeneratePdf(row)
            }}
            disabled={generatingPdf === row.id}
            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
            title="下載 PDF"
          >
            {generatingPdf === row.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
          </button>
          {row.status === 'draft' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                updateStatus.mutate({ quoteId: row.id, status: 'sent' })
              }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
              title="標記為已發送"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          {/* 所有狀態都可以刪除 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('確定要刪除此報價單？')) {
                deleteQuote.mutate(row.id)
              }
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {row.status === 'sent' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                updateStatus.mutate({ quoteId: row.id, status: 'accepted' })
              }}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
              title="標記為已接受"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
          {row.status === 'accepted' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openConvertModal(row)
              }}
              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg"
              title="轉換為合約"
            >
              <ArrowRightCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card border-l-4 border-gray-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">草稿</p>
              <p className="text-2xl font-bold">{stats.draft || 0}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-xl">
              <FileText className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已發送</p>
              <p className="text-2xl font-bold text-blue-600">{stats.sent || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已接受</p>
              <p className="text-2xl font-bold text-green-600">{stats.accepted || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-red-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已過期</p>
              <p className="text-2xl font-bold text-red-600">{stats.expired || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-xl">
              <Clock className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 工具列 */}
      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label htmlFor="quote-status-filter" className="text-sm text-gray-600">狀態：</label>
            <select
              id="quote-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-32"
            >
              <option value="">全部</option>
              <option value="draft">草稿</option>
              <option value="sent">已發送</option>
              <option value="viewed">已檢視</option>
              <option value="accepted">已接受</option>
              <option value="rejected">已拒絕</option>
              <option value="expired">已過期</option>
            </select>
          </div>
          <button
            onClick={() => navigate('/quotes/new')}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            新增報價單
          </button>
        </div>
      </div>

      {/* 資料表 */}
      <DataTable
        columns={columns}
        data={quotes}
        loading={isLoading}
        onRefresh={refetch}
        pageSize={15}
        emptyMessage="沒有報價單"
      />

      {/* 新增報價單 Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          resetForm()
        }}
        title="新增報價單"
        size="lg"
        footer={
          <>
            <button
              onClick={() => {
                setShowCreateModal(false)
                resetForm()
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleCreateQuote}
              disabled={createQuote.isPending}
              className="btn-primary"
            >
              {createQuote.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  建立報價單
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {/* 場館選擇 */}
          <div>
            <label htmlFor="quote-branch" className="label">
              場館 <span className="text-red-500">*</span>
            </label>
            <select
              id="quote-branch"
              value={form.branch_id}
              onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
              className="input"
            >
              <option value="">選擇場館</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* 服務類型快速選擇 */}
          <div>
            <label className="label">服務類型（點擊自動帶入預設值）</label>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(SERVICE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyServicePreset(key)}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                    form.contract_type === key
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-sm">{preset.label}</div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-1">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 營業登記子選項：月租金額 + 繳費週期 */}
          {form.contract_type === 'virtual_office' && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-2 gap-4">
                {/* 月租金額選擇 */}
                <div>
                  <label className="label text-blue-900">月租金額</label>
                  <div className="flex flex-wrap gap-2">
                    {VIRTUAL_OFFICE_OPTIONS.prices.map((price) => (
                      <button
                        key={price}
                        type="button"
                        onClick={() => {
                          const newItems = [...form.items]
                          if (newItems[0]) {
                            newItems[0].unit_price = price
                            newItems[0].amount = price * newItems[0].quantity
                          }
                          setForm({ ...form, items: newItems })
                        }}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                          form.items[0]?.unit_price === price
                            ? 'border-blue-500 bg-blue-100 text-blue-700'
                            : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        ${price.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 繳費週期選擇 */}
                <div>
                  <label className="label text-blue-900">繳費週期</label>
                  <div className="flex gap-2">
                    {VIRTUAL_OFFICE_OPTIONS.cycles.map((cycle) => (
                      <button
                        key={cycle.months}
                        type="button"
                        onClick={() => {
                          const newItems = [...form.items]
                          if (newItems[0]) {
                            newItems[0].quantity = cycle.months
                            newItems[0].amount = newItems[0].unit_price * cycle.months
                          }
                          setForm({ ...form, contract_months: cycle.months, items: newItems })
                        }}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          form.contract_months === cycle.months
                            ? 'border-blue-500 bg-blue-100 text-blue-700'
                            : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        {cycle.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {/* 即時計算預覽 */}
              <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-blue-800">
                <span className="font-medium">
                  ${form.items[0]?.unit_price?.toLocaleString() || 0}/月 × {form.contract_months} 個月 =
                  <span className="text-lg ml-1">${(form.items[0]?.amount || 0).toLocaleString()}</span>
                </span>
              </div>
            </div>
          )}

          {/* 客戶資訊 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-3">客戶資訊</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="quote-customer-name" className="label">
                  姓名
                </label>
                <input
                  id="quote-customer-name"
                  type="text"
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  className="input"
                  placeholder="客戶姓名"
                />
              </div>
              <div>
                <label htmlFor="quote-customer-phone" className="label">電話</label>
                <input
                  id="quote-customer-phone"
                  type="text"
                  value={form.customer_phone}
                  onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                  className="input"
                  placeholder="電話"
                />
              </div>
              <div>
                <label htmlFor="quote-customer-email" className="label">Email</label>
                <input
                  id="quote-customer-email"
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  className="input"
                  placeholder="Email"
                />
              </div>
              <div>
                <label htmlFor="quote-company-name" className="label">公司名稱</label>
                <input
                  id="quote-company-name"
                  type="text"
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  className="input"
                  placeholder="公司名稱"
                />
              </div>
            </div>
          </div>

          {/* 方案設定 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quote-plan-name" className="label">方案名稱</label>
              <input
                id="quote-plan-name"
                type="text"
                value={form.plan_name}
                onChange={(e) => setForm({ ...form, plan_name: e.target.value })}
                className="input"
                placeholder="例：商登基本方案"
              />
            </div>
            <div>
              <label htmlFor="quote-contract-months" className="label">合約月數</label>
              <input
                id="quote-contract-months"
                type="number"
                value={form.contract_months}
                onChange={(e) => setForm({ ...form, contract_months: parseInt(e.target.value) || 12 })}
                className="input"
                min="1"
              />
            </div>
          </div>

          {/* 費用項目 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">費用項目</h3>
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + 新增項目
              </button>
            </div>
            {/* 欄位標題 */}
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 font-medium">
              <span className="flex-1">項目名稱</span>
              <span className="w-16 text-center">數量</span>
              <span className="w-16 text-center">單位</span>
              <span className="w-28 text-center">單價</span>
              <span className="w-28 text-right">金額</span>
              <span className="w-8"></span>
            </div>
            <div className="space-y-2">
              {form.items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => {
                      const newItems = [...form.items]
                      newItems[index].name = e.target.value
                      setForm({ ...form, items: newItems })
                    }}
                    className="input flex-1"
                    placeholder="項目名稱"
                  />
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) => {
                      const newItems = [...form.items]
                      newItems[index].quantity = parseInt(e.target.value) || 0
                      setForm({ ...form, items: newItems })
                      updateItemAmount(index)
                    }}
                    className="input w-16 text-center"
                    placeholder="數量"
                    min="0"
                  />
                  <input
                    type="text"
                    value={item.unit || ''}
                    onChange={(e) => {
                      const newItems = [...form.items]
                      newItems[index].unit = e.target.value
                      setForm({ ...form, items: newItems })
                    }}
                    className="input w-16 text-center"
                    placeholder="月"
                  />
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => {
                      const newItems = [...form.items]
                      newItems[index].unit_price = parseInt(e.target.value) || 0
                      setForm({ ...form, items: newItems })
                      updateItemAmount(index)
                    }}
                    className="input w-28 text-right"
                    placeholder="單價"
                    min="0"
                  />
                  <span className="w-28 text-right font-medium">
                    ${(item.amount || 0).toLocaleString()}
                  </span>
                  {form.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 金額計算 */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>小計</span>
                <span>${subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">折扣</span>
                <input
                  type="number"
                  value={form.discount_amount}
                  onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
                  className="input w-28 text-right"
                  placeholder="0"
                  min="0"
                />
                <input
                  type="text"
                  value={form.discount_note}
                  onChange={(e) => setForm({ ...form, discount_note: e.target.value })}
                  className="input flex-1"
                  placeholder="折扣說明"
                />
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-300">
                <span>總計</span>
                <span className="text-green-600">${total.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm">押金</span>
                <input
                  type="number"
                  value={form.deposit_amount}
                  onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })}
                  className="input w-28 text-right"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* 有效期與備註 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="quote-valid-days" className="label">報價有效天數</label>
              <input
                id="quote-valid-days"
                type="number"
                value={form.valid_days}
                onChange={(e) => setForm({ ...form, valid_days: parseInt(e.target.value) || 30 })}
                className="input"
                min="1"
              />
            </div>
          </div>

          <div>
            <label htmlFor="quote-internal-notes" className="label">內部備註</label>
            <textarea
              id="quote-internal-notes"
              value={form.internal_notes}
              onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
              className="input resize-none"
              rows={2}
              placeholder="內部備註（不會顯示給客戶）"
            />
          </div>
        </div>
      </Modal>

      {/* 報價單詳情 Modal */}
      <Modal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedQuote(null)
        }}
        title={`報價單 ${selectedQuote?.quote_number || ''}`}
        size="md"
      >
        {selectedQuote && (
          <div className="space-y-4">
            {/* 狀態與基本資訊 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Badge variant={STATUS_VARIANTS[selectedQuote.status]} className="text-sm">
                  {STATUS_LABELS[selectedQuote.status]}
                </Badge>
                <p className="text-sm text-gray-500 mt-1">
                  建立於 {selectedQuote.created_at?.split('T')[0]}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">
                  ${(selectedQuote.total_amount || 0).toLocaleString()}
                </p>
                {selectedQuote.deposit_amount > 0 && (
                  <p className="text-sm text-gray-500">押金 ${selectedQuote.deposit_amount.toLocaleString()}</p>
                )}
              </div>
            </div>

            {/* 客戶資訊 */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-blue-600" />
                <span className="font-medium">{selectedQuote.customer_name}</span>
              </div>
              {selectedQuote.company_name && (
                <p className="text-sm text-gray-600">{selectedQuote.company_name}</p>
              )}
              {selectedQuote.customer_phone && (
                <p className="text-sm text-gray-600">{selectedQuote.customer_phone}</p>
              )}
            </div>

            {/* 方案資訊 */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">場館</p>
                <p className="font-medium">{selectedQuote.branch_name}</p>
              </div>
              <div>
                <p className="text-gray-500">方案</p>
                <p className="font-medium">{selectedQuote.plan_name || CONTRACT_TYPES[selectedQuote.contract_type]}</p>
              </div>
              <div>
                <p className="text-gray-500">合約期間</p>
                <p className="font-medium">{selectedQuote.contract_months} 個月</p>
              </div>
              <div>
                <p className="text-gray-500">報價有效期</p>
                <p className="font-medium">{selectedQuote.valid_until}</p>
              </div>
            </div>

            {/* 費用明細 */}
            {selectedQuote.items && (
              <div>
                <h4 className="font-medium mb-2">費用明細</h4>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">項目</th>
                        <th className="px-3 py-2 text-right">數量</th>
                        <th className="px-3 py-2 text-right">單價</th>
                        <th className="px-3 py-2 text-right">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(typeof selectedQuote.items === 'string'
                        ? JSON.parse(selectedQuote.items)
                        : selectedQuote.items
                      ).map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">${item.unit_price?.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">${item.amount?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 備註 */}
            {selectedQuote.internal_notes && (
              <div>
                <h4 className="font-medium mb-1">內部備註</h4>
                <p className="text-sm text-gray-600">{selectedQuote.internal_notes}</p>
              </div>
            )}

            {/* 操作按鈕 */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              {selectedQuote.status === 'draft' && (
                <>
                  <button
                    onClick={() => updateStatus.mutate({ quoteId: selectedQuote.id, status: 'sent' })}
                    className="btn-primary"
                    disabled={updateStatus.isPending}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    標記為已發送
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('確定要刪除此報價單？')) {
                        deleteQuote.mutate(selectedQuote.id)
                      }
                    }}
                    className="btn-danger"
                    disabled={deleteQuote.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    刪除
                  </button>
                </>
              )}
              {selectedQuote.status === 'sent' && (
                <>
                  <button
                    onClick={() => updateStatus.mutate({ quoteId: selectedQuote.id, status: 'accepted' })}
                    className="btn-success"
                    disabled={updateStatus.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    客戶已接受
                  </button>
                  <button
                    onClick={() => updateStatus.mutate({ quoteId: selectedQuote.id, status: 'rejected' })}
                    className="btn-danger"
                    disabled={updateStatus.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    客戶已拒絕
                  </button>
                </>
              )}
              {selectedQuote.status === 'accepted' && (
                <button
                  onClick={() => openConvertModal(selectedQuote)}
                  className="btn-primary bg-purple-600 hover:bg-purple-700"
                >
                  <ArrowRightCircle className="w-4 h-4 mr-2" />
                  轉換為合約
                </button>
              )}
              {selectedQuote.status === 'converted' && (
                <div className="text-sm text-gray-500">
                  此報價單已轉換為合約
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 轉合約 Modal - 填寫完整承租人資訊 */}
      <Modal
        open={showConvertModal}
        onClose={() => {
          setShowConvertModal(false)
          resetContractForm()
        }}
        title="轉換為合約 - 填寫承租人資訊"
        size="lg"
        footer={
          <>
            <button
              onClick={() => {
                setShowConvertModal(false)
                resetContractForm()
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleConvertToContract}
              disabled={convertToContract.isPending}
              className="btn-primary bg-purple-600 hover:bg-purple-700"
            >
              {convertToContract.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  建立中...
                </>
              ) : (
                <>
                  <ArrowRightCircle className="w-4 h-4 mr-2" />
                  確認建立合約
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-6">
          {/* 提示訊息 */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              請填寫完整的承租人資訊。報價單資料僅供參考，簽約時需重新確認客戶資料。
            </p>
          </div>

          {/* 報價單摘要 */}
          {selectedQuote && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">報價單</p>
                  <p className="font-medium">{selectedQuote.quote_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">報價金額</p>
                  <p className="font-bold text-green-600">${(selectedQuote.total_amount || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* 承租人資訊（乙方） */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-4">承租人資訊（乙方）</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">公司名稱</label>
                <input
                  type="text"
                  value={contractForm.company_name}
                  onChange={(e) => setContractForm({ ...contractForm, company_name: e.target.value })}
                  className="input"
                  placeholder="公司名稱（新設立可先空白）"
                />
              </div>
              <div>
                <label className="label">
                  負責人姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contractForm.representative_name}
                  onChange={(e) => setContractForm({ ...contractForm, representative_name: e.target.value })}
                  className="input"
                  placeholder="負責人姓名"
                />
              </div>
              <div className="col-span-2">
                <label className="label">負責人地址</label>
                <input
                  type="text"
                  value={contractForm.representative_address}
                  onChange={(e) => setContractForm({ ...contractForm, representative_address: e.target.value })}
                  className="input"
                  placeholder="戶籍地址"
                />
              </div>
              <div>
                <label className="label">身分證號碼</label>
                <input
                  type="text"
                  value={contractForm.id_number}
                  onChange={(e) => setContractForm({ ...contractForm, id_number: e.target.value })}
                  className="input"
                  placeholder="身分證/居留證號碼"
                />
              </div>
              <div>
                <label className="label">公司統編</label>
                <input
                  type="text"
                  value={contractForm.company_tax_id}
                  onChange={(e) => setContractForm({ ...contractForm, company_tax_id: e.target.value })}
                  className="input"
                  placeholder="8碼統編（新設立公司可空白）"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="label">
                  聯絡電話 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contractForm.phone}
                  onChange={(e) => setContractForm({ ...contractForm, phone: e.target.value })}
                  className="input"
                  placeholder="聯絡電話"
                />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input
                  type="email"
                  value={contractForm.email}
                  onChange={(e) => setContractForm({ ...contractForm, email: e.target.value })}
                  className="input"
                  placeholder="電子郵件"
                />
              </div>
            </div>
          </div>

          {/* 合約條件 */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-medium text-green-900 mb-4">租賃條件</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">
                  合約起始日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={contractForm.start_date}
                  onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">
                  合約結束日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={contractForm.end_date}
                  onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">定價（原價）</label>
                <input
                  type="number"
                  value={contractForm.original_price}
                  onChange={(e) => setContractForm({ ...contractForm, original_price: e.target.value })}
                  className="input"
                  placeholder="用於違約金計算"
                />
              </div>
              <div>
                <label className="label">月租金（折扣價）</label>
                <input
                  type="number"
                  value={contractForm.monthly_rent}
                  onChange={(e) => setContractForm({ ...contractForm, monthly_rent: e.target.value })}
                  className="input"
                  placeholder="實際月租金"
                />
              </div>
              <div>
                <label className="label">押金</label>
                <input
                  type="number"
                  value={contractForm.deposit_amount}
                  onChange={(e) => setContractForm({ ...contractForm, deposit_amount: e.target.value })}
                  className="input"
                  placeholder="押金金額"
                />
              </div>
              <div>
                <label className="label">繳費週期</label>
                <select
                  value={contractForm.payment_cycle}
                  onChange={(e) => setContractForm({ ...contractForm, payment_cycle: e.target.value })}
                  className="input"
                >
                  <option value="monthly">每月</option>
                  <option value="quarterly">每季</option>
                  <option value="semi_annual">每半年</option>
                  <option value="annual">每年</option>
                </select>
              </div>
              <div>
                <label className="label">繳費日</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={contractForm.payment_day}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')  // 只允許數字
                    const num = parseInt(val) || ''
                    if (val === '' || (num >= 1 && num <= 31)) {
                      setContractForm({ ...contractForm, payment_day: val === '' ? '' : num })
                    }
                  }}
                  className="input"
                  placeholder="每期幾號繳費 (1-31)"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
