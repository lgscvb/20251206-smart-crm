import { useState } from 'react'
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
  virtual_office: '虛擬辦公室',
  coworking_fixed: '固定座位',
  coworking_flexible: '彈性座位',
  meeting_room: '會議室'
}

export default function Quotes() {
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(null) // 正在生成 PDF 的報價單 ID

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
    items: [{ name: '商登月租費', quantity: 12, unit_price: 5000, amount: 60000 }],
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

  // 轉換為合約
  const convertToContract = useMutation({
    mutationFn: (quoteId) => callTool('quote_convert_to_contract', { quote_id: quoteId }),
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
      } else {
        addNotification({ type: 'error', message: data.message || '轉換失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `轉換失敗: ${error.message}` })
    }
  })

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
      plan_name: '',
      contract_months: 12,
      items: [{ name: '商登月租費', quantity: 12, unit_price: 5000, amount: 60000 }],
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
    if (!form.customer_name) {
      addNotification({ type: 'error', message: '請輸入客戶姓名' })
      return
    }

    createQuote.mutate({
      branch_id: parseInt(form.branch_id),
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      customer_email: form.customer_email || null,
      company_name: form.company_name || null,
      contract_type: form.contract_type,
      plan_name: form.plan_name || null,
      contract_months: form.contract_months,
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
      items: [...form.items, { name: '', quantity: 1, unit_price: 0, amount: 0 }]
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
            <>
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
            </>
          )}
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
                if (confirm('確定要將此報價單轉換為合約？')) {
                  convertToContract.mutate(row.id)
                }
              }}
              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg"
              title="轉換為合約"
              disabled={convertToContract.isPending}
            >
              {convertToContract.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRightCircle className="w-4 h-4" />
              )}
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
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
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
          {/* 基本資訊 */}
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label htmlFor="quote-contract-type" className="label">合約類型</label>
              <select
                id="quote-contract-type"
                value={form.contract_type}
                onChange={(e) => setForm({ ...form, contract_type: e.target.value })}
                className="input"
              >
                {Object.entries(CONTRACT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 客戶資訊 */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-3">客戶資訊</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="quote-customer-name" className="label">
                  姓名 <span className="text-red-500">*</span>
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
                    className="input w-20"
                    placeholder="數量"
                    min="0"
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
                    className="input w-28"
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
                  onClick={() => {
                    if (confirm('確定要將此報價單轉換為合約？\n系統將建立一份草稿合約供您確認。')) {
                      convertToContract.mutate(selectedQuote.id)
                    }
                  }}
                  className="btn-primary bg-purple-600 hover:bg-purple-700"
                  disabled={convertToContract.isPending}
                >
                  {convertToContract.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      轉換中...
                    </>
                  ) : (
                    <>
                      <ArrowRightCircle className="w-4 h-4 mr-2" />
                      轉換為合約
                    </>
                  )}
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
    </div>
  )
}
