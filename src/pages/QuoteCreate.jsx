import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, Loader2, Trash2 } from 'lucide-react'
import { callTool, db } from '../services/api'
import useStore from '../store/useStore'
import { pdf } from '@react-pdf/renderer'
import QuotePDF from '../components/pdf/QuotePDF'

// 營業登記方案選項
const VIRTUAL_OFFICE_OPTIONS = {
  original_price: 3000, // 原價
  prices: [1490, 1690, 1800, 2000], // 折扣價選項
  cycles: [
    { label: '年繳', months: 12 },
    { label: '半年繳', months: 6 }
  ]
}

// 服務類型預設值
const SERVICE_PRESETS = {
  virtual_office: {
    label: '營業登記',
    description: '商業登記地址服務',
    plan_name: '營業登記方案',
    contract_months: 12,
    deposit_amount: 6000,
    original_price: 3000,
    hasSubOptions: true,
    items: [
      { name: '商登月租費', quantity: 12, unit: '月', unit_price: 1490, amount: 17880 }
    ]
  },
  office: {
    label: '辦公室',
    description: '獨立辦公室租賃',
    plan_name: '辦公室租賃',
    contract_months: 12,
    deposit_amount: 0,
    items: [
      { name: '辦公室月租', quantity: 1, unit: '月', unit_price: 0, amount: 0 }
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

// 格式化金額
const formatCurrency = (amount) => {
  if (!amount) return '0'
  return Number(amount).toLocaleString('zh-TW')
}

export default function QuoteCreate() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)
  const selectedBranch = useStore((state) => state.selectedBranch)

  // 取得分館列表
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => db.getBranches()
  })

  // 表單狀態
  const [form, setForm] = useState({
    branch_id: selectedBranch || '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    company_name: '',
    contract_type: 'virtual_office',
    plan_name: '營業登記方案',
    contract_months: 12,
    original_price: 3000,
    items: [{ name: '商登月租費', quantity: 12, unit: '月', unit_price: 1490, amount: 17880 }],
    discount_amount: 0,
    discount_note: '',
    deposit_amount: 6000,
    valid_days: 30,
    internal_notes: '',
    customer_notes: ''
  })

  // 生成並下載 PDF
  const generateAndDownloadPdf = async (quote) => {
    try {
      const branch = branches?.find(b => b.id === parseInt(form.branch_id))
      // 計算有效期限
      const today = new Date()
      const validFrom = today.toISOString().split('T')[0]
      const validUntilDate = new Date(today)
      validUntilDate.setDate(validUntilDate.getDate() + form.valid_days)
      const validUntil = validUntilDate.toISOString().split('T')[0]

      // 計算總金額
      const subtotal = form.items.reduce((sum, item) => sum + (item.amount || 0), 0)
      const totalAmount = subtotal - (parseFloat(form.discount_amount) || 0)

      const pdfData = {
        quote_number: quote.quote_number,
        valid_from: validFrom,
        valid_until: validUntil,
        branch_name: branch?.name || '台中館',
        plan_name: form.plan_name,
        items: form.items,
        deposit_amount: parseFloat(form.deposit_amount) || 0,
        total_amount: totalAmount,
        bank_account_name: '你的空間有限公司',
        bank_name: '永豐商業銀行(南台中分行)',
        bank_code: '807',
        bank_account_number: '03801800183399',
        contact_email: 'wtxg@hourjungle.com',
        contact_phone: '04-23760282'
      }

      const blob = await pdf(<QuotePDF data={pdfData} />).toBlob()
      const url = URL.createObjectURL(blob)

      // 自動下載
      const link = document.createElement('a')
      link.href = url
      link.download = `報價單_${quote.quote_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      addNotification({ type: 'success', message: '報價單 PDF 已下載' })
    } catch (error) {
      console.error('生成 PDF 失敗:', error)
      addNotification({ type: 'warning', message: '報價單已建立，但 PDF 下載失敗' })
    }
  }

  // 建立報價單
  const createQuote = useMutation({
    mutationFn: (data) => callTool('quote_create', data),
    onSuccess: async (response) => {
      const data = response?.result || response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['quotes'] })
        addNotification({ type: 'success', message: '報價單建立成功' })

        // 同時下載 PDF
        if (data.quote) {
          await generateAndDownloadPdf(data.quote)
        }

        navigate('/quotes')
      } else {
        addNotification({ type: 'error', message: data.message || '建立失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `建立失敗: ${error.message}` })
    }
  })

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
      original_price: preset.original_price || 0,
      items: preset.items.map(item => ({ ...item }))
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

  // 處理提交
  const handleSubmit = () => {
    if (!form.branch_id) {
      addNotification({ type: 'error', message: '請選擇場館' })
      return
    }

    createQuote.mutate({
      branch_id: parseInt(form.branch_id),
      customer_name: form.customer_name || null,
      customer_phone: form.customer_phone || null,
      customer_email: form.customer_email || null,
      company_name: form.company_name || null,
      contract_type: form.contract_type,
      plan_name: form.plan_name || null,
      contract_months: parseInt(form.contract_months) || 12,
      original_price: parseFloat(form.original_price) || null,
      items: form.items,
      discount_amount: parseFloat(form.discount_amount) || 0,
      discount_note: form.discount_note || null,
      deposit_amount: parseFloat(form.deposit_amount) || 0,
      valid_days: form.valid_days,
      internal_notes: form.internal_notes || null,
      customer_notes: form.customer_notes || null
    })
  }

  // 取得分館名稱
  const getBranchName = () => {
    const branch = branches?.find(b => b.id === parseInt(form.branch_id))
    return branch?.name || '台中館'
  }

  // 計算有效期限
  const getValidDates = () => {
    const today = new Date()
    const validFrom = today.toISOString().split('T')[0]
    const validUntil = new Date(today.setDate(today.getDate() + form.valid_days)).toISOString().split('T')[0]
    return { validFrom, validUntil }
  }

  const { validFrom, validUntil } = getValidDates()

  return (
    <div className="h-full flex flex-col">
      {/* 頂部工具欄 */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/quotes')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">建立報價單</h1>
        </div>
        <button
          onClick={handleSubmit}
          disabled={createQuote.isPending}
          className="btn btn-primary flex items-center gap-2"
        >
          {createQuote.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              建立中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              建立報價單
            </>
          )}
        </button>
      </div>

      {/* 主要內容區 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側：表單 */}
        <div className="w-1/2 overflow-y-auto p-6 bg-gray-50 border-r">
          <div className="max-w-xl space-y-6">
            {/* 場館選擇 */}
            <div>
              <label className="label">
                場館 <span className="text-red-500">*</span>
              </label>
              <select
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
              <label className="label">服務類型</label>
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
                  </button>
                ))}
              </div>
            </div>

            {/* 營業登記子選項 */}
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
            <div className="p-4 bg-white rounded-lg border">
              <h3 className="font-medium mb-3">客戶資訊</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">姓名</label>
                  <input
                    type="text"
                    value={form.customer_name}
                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    className="input"
                    placeholder="客戶姓名"
                  />
                </div>
                <div>
                  <label className="label">電話</label>
                  <input
                    type="text"
                    value={form.customer_phone}
                    onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    className="input"
                    placeholder="電話"
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={form.customer_email}
                    onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                    className="input"
                    placeholder="Email"
                  />
                </div>
                <div>
                  <label className="label">公司名稱</label>
                  <input
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
                <label className="label">方案名稱</label>
                <input
                  type="text"
                  value={form.plan_name}
                  onChange={(e) => setForm({ ...form, plan_name: e.target.value })}
                  className="input"
                  placeholder="例：商登基本方案"
                />
              </div>
              <div>
                <label className="label">合約月數</label>
                <input
                  type="number"
                  value={form.contract_months}
                  onChange={(e) => setForm({ ...form, contract_months: e.target.value === '' ? '' : parseInt(e.target.value) })}
                  onBlur={(e) => {
                    // 失焦時確保有有效值
                    if (!form.contract_months || form.contract_months < 1) {
                      setForm({ ...form, contract_months: 12 })
                    }
                  }}
                  className="input"
                  min="1"
                />
              </div>
            </div>

            {/* 費用項目 */}
            <div className="p-4 bg-white rounded-lg border">
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
                <span className="w-24 text-center">單價</span>
                <span className="w-24 text-right">金額</span>
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
                      className="input w-24 text-right"
                      min="0"
                    />
                    <span className="w-24 text-right font-medium text-sm">
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
                    className="input w-24 text-right"
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
                    className="input w-24 text-right"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* 有效期與備註 */}
            <div>
              <label className="label">報價有效天數</label>
              <input
                type="number"
                value={form.valid_days}
                onChange={(e) => setForm({ ...form, valid_days: parseInt(e.target.value) || 30 })}
                className="input w-32"
                min="1"
              />
            </div>

            <div>
              <label className="label">內部備註</label>
              <textarea
                value={form.internal_notes}
                onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
                className="input"
                rows={2}
                placeholder="內部備註（不會顯示給客戶）"
              />
            </div>
          </div>
        </div>

        {/* 右側：預覽 */}
        <div className="w-1/2 overflow-y-auto p-6 bg-gray-100">
          <div className="bg-white rounded-lg shadow-lg max-w-lg mx-auto" style={{ minHeight: '842px' }}>
            {/* 預覽報價單 */}
            <div className="p-8">
              {/* 標題區 */}
              <div className="text-center mb-6">
                <div className="text-[#2d5a27] text-xs tracking-widest mb-2">HOUR JUNGLE</div>
                <h2 className="text-xl font-bold text-[#2d5a27]">
                  HourJungle {getBranchName()}報價單
                </h2>
              </div>

              {/* 報價單資訊 */}
              <div className="text-right text-xs text-gray-500 mb-4">
                <div>報價單號：Q{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-XXXX</div>
                <div>報價日期：{validFrom}</div>
                <div>有效期限：{validUntil}</div>
                <div className="font-medium text-gray-700">合約期限：{form.contract_months} 個月（{form.contract_months >= 12 ? `${Math.floor(form.contract_months / 12)}年${form.contract_months % 12 > 0 ? `${form.contract_months % 12}個月` : ''}` : `${form.contract_months}個月`}）</div>
              </div>

              {/* 服務項目表格 */}
              <div className="border rounded-lg overflow-hidden mb-4 text-xs">
                {/* 表頭 */}
                <div className="flex bg-gray-100 border-b">
                  <div className="flex-1 p-2 text-center font-bold">服務項目</div>
                  <div className="w-28 p-2 text-center font-bold">請款金額 (NTD)</div>
                </div>

                {/* 方案標題 */}
                {form.plan_name && (
                  <div className="bg-gray-50 border-b p-2 text-center font-medium">
                    {form.plan_name}（依合約內指定付款時間點）
                  </div>
                )}

                {/* 項目列表 */}
                {form.items.map((item, index) => (
                  <div key={index} className="flex border-b">
                    <div className="flex-1 p-2">
                      {item.name || '（項目名稱）'}
                      {item.quantity > 1 && item.unit && (
                        <span className="text-gray-500 ml-1">
                          ({item.quantity} {item.unit})
                        </span>
                      )}
                    </div>
                    <div className="w-28 p-2 text-right font-mono">
                      {formatCurrency(item.amount)}
                    </div>
                  </div>
                ))}

                {/* 押金 */}
                {parseFloat(form.deposit_amount) > 0 && (
                  <div className="flex border-b">
                    <div className="flex-1 p-2">押金</div>
                    <div className="w-28 p-2 text-right font-mono">
                      {formatCurrency(form.deposit_amount)}
                    </div>
                  </div>
                )}

                {/* 合計 */}
                <div className="flex bg-gray-50">
                  <div className="flex-1 p-2 text-center font-bold text-[#2d5a27] text-sm">合計</div>
                  <div className="w-28 p-2 text-right font-bold text-[#2d5a27] text-sm font-mono">
                    {formatCurrency(total + (parseFloat(form.deposit_amount) || 0))}
                  </div>
                </div>
              </div>

              {/* 銀行資訊 */}
              <div className="mb-4 text-xs border rounded">
                <div className="flex items-center border-b">
                  <span className="whitespace-nowrap text-gray-500 bg-gray-50 px-2 py-1">帳戶名稱</span>
                  <span className="flex-1 text-right px-2 py-1">你的空間有限公司</span>
                </div>
                <div className="flex items-center border-b">
                  <span className="whitespace-nowrap text-gray-500 bg-gray-50 px-2 py-1">銀行名稱</span>
                  <span className="flex-1 text-right px-2 py-1">永豐商業銀行(南台中分行)</span>
                </div>
                <div className="flex items-center border-b">
                  <span className="whitespace-nowrap text-gray-500 bg-gray-50 px-2 py-1">行庫代號</span>
                  <span className="flex-1 text-right px-2 py-1">807</span>
                </div>
                <div className="flex items-center">
                  <span className="whitespace-nowrap text-gray-500 bg-gray-50 px-2 py-1">帳號</span>
                  <span className="flex-1 text-right px-2 py-1">03801800183399</span>
                </div>
              </div>

              {/* 備註 */}
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
                <div className="font-bold mb-1">備註：</div>
                <div>1. 報價有效期間：即日起{form.valid_days}天內。</div>
                <div>2. 獨家！威立方（V-CUBE）集團，指定合作夥伴E樂堂企業內訓系統會員免費獨享。</div>
                <div>3. 超過百間以上蝦皮店家登記指定選擇hourjungle，可登記使用免用統一發票（限無店面零售業）電商最划算的選擇。</div>
                <div>4. 全台灣唯一敢在合約內註明如因我方因素主管機關不予核准，我們全額退費！</div>
                <div>5. 多位知名客戶阿里巴巴、UBER、唐吉軻德、arrow（全球五百大企業）指定選擇解決方案。</div>
                <div>6. 獨家！蝦皮商城免費健檢！提供金、物流、包材、bsmi、財稅法一站式解決方案。再送一年免費稅務諮詢。</div>
                <div>7. 獨家！勞動部TTQS認證單位，不定期超過百種創業課程會員免費獨享。</div>
                <div>8. 獨家經濟部中小企業處認證國際育成中心！</div>
                <div>9. 獨家！國科會科研平台輔導業師進駐。</div>
                <div>10. 有任何問題請洽詢公司信箱 wtxg@hourjungle.com 或電話 04-23760282。</div>
              </div>

              {/* 頁尾提醒 */}
              <div className="mt-4 pt-3 border-t text-xs text-gray-500">
                本公司之報價不包含銀行匯款手續費，匯款後請閣下將匯款憑證回傳本公司，以便進行確認。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
