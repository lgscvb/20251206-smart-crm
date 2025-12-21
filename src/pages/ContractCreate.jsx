import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PDFViewer } from '@react-pdf/renderer'
import { crm, db } from '../services/api'
import useStore from '../store/useStore'
import ContractPDF from '../components/pdf/ContractPDF'
import OfficePDF from '../components/pdf/OfficePDF'
import FlexSeatPDF from '../components/pdf/FlexSeatPDF'
import { ArrowLeft, Loader2, Save, AlertTriangle, FileText } from 'lucide-react'

// 預設值
const DEFAULT_ORIGINAL_PRICE = 3000
const DEFAULT_DEPOSIT = 6000

// 計算結束日期（起始日 + N 個月）
const calculateEndDate = (startDate, months = 12) => {
  if (!startDate) return ''
  const date = new Date(startDate)
  date.setMonth(date.getMonth() + months)
  date.setDate(date.getDate() - 1) // 結束日是前一天
  return date.toISOString().split('T')[0]
}

// 計算合約月數
const calculateMonths = (startDate, endDate) => {
  if (!startDate || !endDate) return 12
  const start = new Date(startDate)
  const end = new Date(endDate)
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
  return months > 0 ? months : 12
}

// 初始表單
const getInitialForm = () => {
  const today = new Date().toISOString().split('T')[0]
  return {
    // 承租人資訊
    company_name: '',
    representative_name: '',
    representative_address: '',
    id_number: '',
    company_tax_id: '',
    phone: '',
    email: '',
    // 合約資訊
    branch_id: 1,
    contract_type: 'virtual_office',
    room_number: '', // 辦公室房號（僅辦公室租賃需要）
    start_date: today,
    end_date: calculateEndDate(today, 12),
    contract_months: 12,
    original_price: DEFAULT_ORIGINAL_PRICE,
    monthly_rent: '',
    deposit_amount: DEFAULT_DEPOSIT,
    payment_cycle: 'monthly',
    payment_day: 8,
    notes: ''
  }
}

// 分館資料（含法人資訊）
const BRANCHES = {
  1: {
    name: '大忠館',
    company_name: '你的空間有限公司',
    tax_id: '83772050',
    representative: '戴豪廷',
    address: '台中市西區大忠南街55號7F-5',
    court: '台南地方法院'
  },
  2: {
    name: '環瑞館',
    company_name: '樞紐前沿股份有限公司',
    tax_id: '60710368',
    representative: '戴豪廷',
    address: '臺中市西區台灣大道二段181號4樓之1',
    court: '台中地方法院'
  }
}

// 合約類型（業務項目）
const CONTRACT_TYPES = {
  virtual_office: { label: '營業登記', hasDeposit: true, hasOriginalPrice: true, hasEndDate: true, hasRoom: false },
  office: { label: '辦公室租賃', hasDeposit: true, hasOriginalPrice: true, hasEndDate: true, hasRoom: true },
  flex_seat: { label: '自由座', hasDeposit: false, hasOriginalPrice: false, hasEndDate: false, hasRoom: false }
}

export default function ContractCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const addNotification = useStore((state) => state.addNotification)

  // 從 URL 參數讀取報價單 ID
  const fromQuoteId = searchParams.get('from_quote')

  const [form, setForm] = useState(getInitialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [originalPriceLocked, setOriginalPriceLocked] = useState(true)
  const [showOriginalPriceWarning, setShowOriginalPriceWarning] = useState(false)
  const [depositLocked, setDepositLocked] = useState(true)
  const [showDepositWarning, setShowDepositWarning] = useState(false)
  const [showStamp, setShowStamp] = useState(false) // 電子用印
  const [quoteLoaded, setQuoteLoaded] = useState(false) // 避免重複載入

  // 從報價單載入資料（如果有 from_quote 參數）
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: ['quote', fromQuoteId],
    queryFn: () => db.query('v_quotes', { id: `eq.${fromQuoteId}` }),
    enabled: !!fromQuoteId,
    staleTime: 0
  })

  // 當報價單資料載入後，預填表單
  useEffect(() => {
    if (quoteData && quoteData.length > 0 && !quoteLoaded) {
      const quote = quoteData[0]

      // 計算合約日期
      const today = new Date()
      const startDate = quote.proposed_start_date || today.toISOString().split('T')[0]
      const months = quote.contract_months || 12
      const endDate = calculateEndDate(startDate, months)

      // 計算月租金和繳費週期：從 items 中找出月租項目（own 項目）
      let monthlyRent = ''
      let paymentCycle = 'monthly'  // 預設月繳
      if (quote.items) {
        const items = typeof quote.items === 'string' ? JSON.parse(quote.items) : quote.items
        const ownItems = items.filter(item =>
          item.revenue_type !== 'referral' &&
          item.billing_cycle && item.billing_cycle !== 'one_time'
        )
        if (ownItems.length > 0) {
          monthlyRent = ownItems.reduce((sum, item) => sum + (parseFloat(item.unit_price) || 0), 0)
          // 從主要項目取得繳費週期
          const mainItem = ownItems[0]
          if (mainItem.billing_cycle) {
            paymentCycle = mainItem.billing_cycle
          }
        }
      }

      // 預填表單
      setForm({
        company_name: quote.company_name || '',
        representative_name: quote.customer_name || '',
        representative_address: '',
        id_number: '',
        company_tax_id: '',
        phone: quote.customer_phone || '',
        email: quote.customer_email || '',
        branch_id: quote.branch_id || 1,
        contract_type: quote.contract_type || 'virtual_office',
        room_number: '',
        start_date: startDate,
        end_date: endDate,
        contract_months: months,
        original_price: quote.original_price || DEFAULT_ORIGINAL_PRICE,
        monthly_rent: monthlyRent,
        deposit_amount: quote.deposit_amount || DEFAULT_DEPOSIT,
        payment_cycle: paymentCycle,
        payment_day: new Date().getDate(),
        notes: `來源報價單：${quote.quote_number}`
      })

      // 解鎖原價和押金欄位（因為已從報價單帶入）
      if (quote.original_price && quote.original_price !== DEFAULT_ORIGINAL_PRICE) {
        setOriginalPriceLocked(false)
      }
      if (quote.deposit_amount && quote.deposit_amount !== DEFAULT_DEPOSIT) {
        setDepositLocked(false)
      }

      setQuoteLoaded(true)
      addNotification({ type: 'info', message: `已從報價單 ${quote.quote_number} 載入資料` })
    }
  }, [quoteData, quoteLoaded, addNotification])

  // 取得當前合約類型的設定
  const contractTypeConfig = CONTRACT_TYPES[form.contract_type] || CONTRACT_TYPES.virtual_office

  // 更新表單欄位
  const updateForm = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value }

      // 合約類型變更時，處理 end_date
      if (field === 'contract_type') {
        const typeConfig = CONTRACT_TYPES[value] || CONTRACT_TYPES.virtual_office
        if (!typeConfig.hasEndDate) {
          // 自由座：設為 9999-12-31（長期合約）
          updated.end_date = '9999-12-31'
        } else {
          // 其他類型：重新計算結束日期
          updated.end_date = calculateEndDate(prev.start_date, prev.contract_months)
        }
      }

      // 起始日期變更時，自動計算結束日期（僅限有結束日的合約類型）
      if (field === 'start_date') {
        const typeConfig = CONTRACT_TYPES[prev.contract_type] || CONTRACT_TYPES.virtual_office
        if (typeConfig.hasEndDate) {
          updated.end_date = calculateEndDate(value, prev.contract_months)
        }
      }

      // 合約月數變更時，重新計算結束日期
      if (field === 'contract_months') {
        updated.end_date = calculateEndDate(prev.start_date, parseInt(value) || 12)
      }

      return updated
    })
  }

  // 嘗試修改原價
  const handleOriginalPriceChange = (value) => {
    if (originalPriceLocked) {
      setShowOriginalPriceWarning(true)
    } else {
      updateForm('original_price', value)
    }
  }

  // 確認解鎖原價編輯
  const confirmUnlockOriginalPrice = () => {
    setOriginalPriceLocked(false)
    setShowOriginalPriceWarning(false)
  }

  // 嘗試修改押金
  const handleDepositChange = (value) => {
    if (depositLocked) {
      setShowDepositWarning(true)
    } else {
      updateForm('deposit_amount', value)
    }
  }

  // 確認解鎖押金編輯
  const confirmUnlockDeposit = () => {
    setDepositLocked(false)
    setShowDepositWarning(false)
  }

  // 準備 PDF 預覽資料
  const pdfData = useMemo(() => {
    const branch = BRANCHES[form.branch_id] || BRANCHES[1]
    return {
      // 合約類型
      contract_type: form.contract_type,
      // 甲方資訊（從分館帶入）
      branch_company_name: branch.company_name,
      branch_tax_id: branch.tax_id,
      branch_representative: branch.representative,
      branch_address: branch.address,
      branch_court: branch.court,
      branch_id: form.branch_id,
      room_number: form.room_number, // 辦公室房號
      // 乙方資訊
      company_name: form.company_name,
      representative_name: form.representative_name,
      representative_address: form.representative_address,
      id_number: form.id_number,
      company_tax_id: form.company_tax_id,
      phone: form.phone,
      email: form.email,
      // 租賃條件
      start_date: form.start_date,
      end_date: form.end_date,
      periods: calculateMonths(form.start_date, form.end_date),
      original_price: parseFloat(form.original_price) || 0,
      monthly_rent: parseFloat(form.monthly_rent) || 0,
      deposit_amount: contractTypeConfig.hasDeposit ? (parseFloat(form.deposit_amount) || 0) : 0,
      payment_day: parseInt(form.payment_day) || 8,
      // 電子用印
      show_stamp: showStamp
    }
  }, [form, showStamp, contractTypeConfig])

  // 提交表單
  const handleSubmit = async (e) => {
    e.preventDefault()

    // 驗證
    if (!form.representative_name) {
      addNotification({ type: 'error', message: '請填寫負責人姓名' })
      return
    }
    if (!form.phone) {
      addNotification({ type: 'error', message: '請填寫聯絡電話' })
      return
    }
    if (!form.start_date || !form.end_date) {
      addNotification({ type: 'error', message: '請填寫合約期間' })
      return
    }
    if (!form.monthly_rent) {
      addNotification({ type: 'error', message: '請填寫月租金額' })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await crm.createContract({
        company_name: form.company_name || null,
        representative_name: form.representative_name,
        representative_address: form.representative_address || null,
        id_number: form.id_number || null,
        company_tax_id: form.company_tax_id || null,
        phone: form.phone,
        email: form.email || null,
        branch_id: parseInt(form.branch_id),
        contract_type: form.contract_type,
        start_date: form.start_date,
        end_date: form.end_date,
        original_price: form.original_price ? parseFloat(form.original_price) : null,
        monthly_rent: parseFloat(form.monthly_rent),
        deposit_amount: parseFloat(form.deposit_amount) || 0,
        payment_cycle: form.payment_cycle,
        payment_day: parseInt(form.payment_day),
        notes: form.notes || null
      })

      if (result?.success) {
        addNotification({ type: 'success', message: `合約建立成功！編號：${result.contract_number}` })
        if (result.contract_id) {
          navigate(`/contracts/${result.contract_id}`)
        } else {
          navigate('/contracts')
        }
      } else {
        addNotification({
          type: 'error',
          message: '建立失敗: ' + (result?.error || '未知錯誤')
        })
      }
    } catch (error) {
      console.error('建立合約失敗:', error)
      addNotification({
        type: 'error',
        message: '建立合約失敗: ' + (error.message || '未知錯誤')
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* 頂部導航 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/contracts')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">新增合約</h1>
              {fromQuoteId && quoteData?.[0] && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  來自報價單 {quoteData[0].quote_number}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {fromQuoteId ? '已從報價單載入資料，請確認後建立合約' : '填寫合約資料，右側即時預覽'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              建立中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              建立合約
            </>
          )}
        </button>
      </div>

      {/* 主要內容：左右分割 */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {/* 左側：輸入表單 */}
        <div className="overflow-y-auto pr-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 承租人資訊（乙方） */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">1</span>
                承租人資訊（乙方）
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">公司名稱</label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => updateForm('company_name', e.target.value)}
                    className="input w-full"
                    placeholder="新設立可空白"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    負責人姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.representative_name}
                    onChange={(e) => updateForm('representative_name', e.target.value)}
                    className="input w-full"
                    placeholder="負責人姓名"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">負責人地址</label>
                  <input
                    type="text"
                    value={form.representative_address}
                    onChange={(e) => updateForm('representative_address', e.target.value)}
                    className="input w-full"
                    placeholder="戶籍地址"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">身分證號碼</label>
                  <input
                    type="text"
                    value={form.id_number}
                    onChange={(e) => updateForm('id_number', e.target.value)}
                    className="input w-full"
                    placeholder="身分證/居留證"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">公司統編</label>
                  <input
                    type="text"
                    value={form.company_tax_id}
                    onChange={(e) => updateForm('company_tax_id', e.target.value)}
                    className="input w-full"
                    placeholder="8碼（新設立可空白）"
                    maxLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    聯絡電話 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                    className="input w-full"
                    placeholder="聯絡電話"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    className="input w-full"
                    placeholder="電子郵件"
                  />
                </div>
              </div>
            </div>

            {/* 租賃條件 */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm">2</span>
                租賃條件
              </h3>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">業務項目</label>
                  <select
                    value={form.contract_type}
                    onChange={(e) => updateForm('contract_type', e.target.value)}
                    className="input w-full"
                  >
                    {Object.entries(CONTRACT_TYPES).map(([value, config]) => (
                      <option key={value} value={value}>{config.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分館</label>
                  <select
                    value={form.branch_id}
                    onChange={(e) => updateForm('branch_id', e.target.value)}
                    className="input w-full"
                  >
                    {Object.entries(BRANCHES).map(([id, branch]) => (
                      <option key={id} value={id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 房號（僅辦公室租賃需要） */}
              {contractTypeConfig.hasRoom && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    房號 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.room_number}
                    onChange={(e) => updateForm('room_number', e.target.value)}
                    className="input w-full"
                    placeholder="例如：A室、B室"
                  />
                </div>
              )}

              {/* 合約期間 */}
              {contractTypeConfig.hasEndDate ? (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      起始日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => updateForm('start_date', e.target.value)}
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">合約長度</label>
                    <select
                      value={form.contract_months}
                      onChange={(e) => updateForm('contract_months', e.target.value)}
                      className="input w-full"
                    >
                      <option value={6}>6 個月</option>
                      <option value={12}>1 年（12 個月）</option>
                      <option value={24}>2 年（24 個月）</option>
                      <option value={36}>3 年（36 個月）</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      結束日期
                    </label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => updateForm('end_date', e.target.value)}
                      className="input w-full bg-gray-50"
                      readOnly
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      起始日期 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => updateForm('start_date', e.target.value)}
                      className="input w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">租期說明</label>
                    <div className="input w-full bg-gray-50 text-gray-600">月租，自動續約</div>
                  </div>
                </div>
              )}

              {/* 金額 */}
              {contractTypeConfig.hasOriginalPrice ? (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      定價（原價）
                      {originalPriceLocked && (
                        <span className="ml-1 text-xs text-yellow-600">(已鎖定)</span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={form.original_price}
                      onChange={(e) => handleOriginalPriceChange(e.target.value)}
                      onFocus={() => originalPriceLocked && setShowOriginalPriceWarning(true)}
                      className={`input w-full ${originalPriceLocked ? 'bg-yellow-50 cursor-pointer' : ''}`}
                      readOnly={originalPriceLocked}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      月租金額 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={form.monthly_rent}
                      onChange={(e) => updateForm('monthly_rent', e.target.value)}
                      className="input w-full"
                      placeholder="折扣後月租"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      押金
                      {depositLocked && (
                        <span className="ml-1 text-xs text-yellow-600">(已鎖定)</span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={form.deposit_amount}
                      onChange={(e) => handleDepositChange(e.target.value)}
                      onFocus={() => depositLocked && setShowDepositWarning(true)}
                      className={`input w-full ${depositLocked ? 'bg-yellow-50 cursor-pointer' : ''}`}
                      readOnly={depositLocked}
                    />
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    月租金額 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={form.monthly_rent}
                    onChange={(e) => updateForm('monthly_rent', e.target.value)}
                    className="input w-full"
                    placeholder="每月租金"
                    required
                  />
                </div>
              )}

              {/* 繳費週期 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">繳費週期</label>
                  <select
                    value={form.payment_cycle}
                    onChange={(e) => updateForm('payment_cycle', e.target.value)}
                    className="input w-full"
                  >
                    <option value="monthly">月繳</option>
                    <option value="quarterly">季繳</option>
                    <option value="semi_annual">半年繳</option>
                    <option value="annual">年繳</option>
                    <option value="biennial">兩年繳</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">繳費日</label>
                  <input
                    type="number"
                    value={form.payment_day}
                    onChange={(e) => updateForm('payment_day', e.target.value)}
                    className="input w-full"
                    min="1"
                    max="28"
                    placeholder="每期幾號"
                  />
                </div>
              </div>
            </div>

            {/* 備註與選項 */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm">3</span>
                其他約定事項
              </h3>

              {/* 電子用印選項 */}
              <div className="mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStamp}
                    onChange={(e) => setShowStamp(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-gray-900">電子用印</span>
                    <p className="text-sm text-gray-500">勾選後合約 PDF 將自動加蓋公司印章（適用於線上續約客戶）</p>
                  </div>
                </label>
              </div>

              <textarea
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                className="input w-full resize-none"
                rows={3}
                placeholder="合約備註（選填）"
              />
            </div>
          </form>
        </div>

        {/* 右側：PDF 預覽 */}
        <div className="bg-gray-100 rounded-lg overflow-hidden flex flex-col">
          <div className="bg-gray-200 px-4 py-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              合約預覽 - {contractTypeConfig.label}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <PDFViewer
              width="100%"
              height="100%"
              showToolbar={false}
              className="border-0"
            >
              {form.contract_type === 'office' ? (
                <OfficePDF data={pdfData} />
              ) : form.contract_type === 'flex_seat' ? (
                <FlexSeatPDF data={pdfData} />
              ) : (
                <ContractPDF data={pdfData} />
              )}
            </PDFViewer>
          </div>
        </div>
      </div>

      {/* 原價修改警告 Modal */}
      {showOriginalPriceWarning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">確認修改原價？</h3>
                <p className="text-sm text-gray-500">原價預設為 $3,000</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              原價用於違約金計算。如果您確定要修改原價，請點擊「確認修改」按鈕。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowOriginalPriceWarning(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={confirmUnlockOriginalPrice}
                className="btn-primary bg-yellow-600 hover:bg-yellow-700"
              >
                確認修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 押金修改警告 Modal */}
      {showDepositWarning && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">確認修改押金？</h3>
                <p className="text-sm text-gray-500">押金預設為 $6,000</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              押金金額通常固定為 $6,000。如果您確定要修改押金，請點擊「確認修改」按鈕。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDepositWarning(false)}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={confirmUnlockDeposit}
                className="btn-primary bg-yellow-600 hover:bg-yellow-700"
              >
                確認修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
