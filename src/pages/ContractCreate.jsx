import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PDFViewer } from '@react-pdf/renderer'
import { crm } from '../services/api'
import useStore from '../store/useStore'
import ContractPDF from '../components/pdf/ContractPDF'
import { ArrowLeft, Loader2, Save, AlertTriangle, FileText } from 'lucide-react'

// 預設押金
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
    start_date: today,
    end_date: calculateEndDate(today, 12),
    contract_months: 12,
    original_price: '',
    monthly_rent: '',
    deposit_amount: DEFAULT_DEPOSIT,
    payment_cycle: 'monthly',
    payment_day: 5,
    notes: ''
  }
}

// 分館資料
const BRANCHES = {
  1: { name: '大忠館', address: '台中市西區大忠南街55號7F-5', phone: '04-2305-0508' },
  2: { name: '環瑞館', address: '台中市西區環瑞街133號1樓', phone: '04-2305-0508' }
}

// 合約類型
const CONTRACT_TYPES = {
  virtual_office: '虛擬辦公室',
  coworking_fixed: '固定座位',
  coworking_flexible: '彈性座位',
  meeting_room: '會議室'
}

export default function ContractCreate() {
  const navigate = useNavigate()
  const addNotification = useStore((state) => state.addNotification)

  const [form, setForm] = useState(getInitialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [depositLocked, setDepositLocked] = useState(true)
  const [showDepositWarning, setShowDepositWarning] = useState(false)

  // 更新表單欄位
  const updateForm = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value }

      // 起始日期變更時，自動計算結束日期
      if (field === 'start_date') {
        updated.end_date = calculateEndDate(value, prev.contract_months)
      }

      // 合約月數變更時，重新計算結束日期
      if (field === 'contract_months') {
        updated.end_date = calculateEndDate(prev.start_date, parseInt(value) || 12)
      }

      return updated
    })
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
      contract_number: '（新合約）',
      branch_name: branch.name,
      branch_address: branch.address,
      branch_phone: branch.phone,
      company_name: form.company_name,
      representative_name: form.representative_name,
      representative_address: form.representative_address,
      id_number: form.id_number,
      company_tax_id: form.company_tax_id,
      phone: form.phone,
      email: form.email,
      contract_type: form.contract_type,
      start_date: form.start_date,
      end_date: form.end_date,
      periods: calculateMonths(form.start_date, form.end_date),
      original_price: parseFloat(form.original_price) || 0,
      monthly_rent: parseFloat(form.monthly_rent) || 0,
      deposit_amount: parseFloat(form.deposit_amount) || 0,
      payment_day: parseInt(form.payment_day) || 5,
      notes: form.notes
    }
  }, [form])

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
            <h1 className="text-xl font-bold text-gray-900">新增合約</h1>
            <p className="text-sm text-gray-500">填寫合約資料，右側即時預覽</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">合約類型</label>
                  <select
                    value={form.contract_type}
                    onChange={(e) => updateForm('contract_type', e.target.value)}
                    className="input w-full"
                  >
                    {Object.entries(CONTRACT_TYPES).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
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

              {/* 合約期間 */}
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

              {/* 金額 */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">定價（原價）</label>
                  <input
                    type="number"
                    value={form.original_price}
                    onChange={(e) => updateForm('original_price', e.target.value)}
                    className="input w-full"
                    placeholder="用於違約金"
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
                    placeholder="實際月租"
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

            {/* 備註 */}
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center text-sm">3</span>
                其他約定事項
              </h3>
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
            <span className="text-sm font-medium text-gray-700">合約預覽</span>
          </div>
          <div className="flex-1 min-h-0">
            <PDFViewer
              width="100%"
              height="100%"
              showToolbar={false}
              className="border-0"
            >
              <ContractPDF data={pdfData} />
            </PDFViewer>
          </div>
        </div>
      </div>

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
