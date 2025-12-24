import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useContracts, useContractTerminate } from '../hooks/useApi'
import { useModal } from '../hooks/useModal'
import { crm, callTool } from '../services/api'
import useStore from '../store/useStore'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import { pdf } from '@react-pdf/renderer'
import ContractPDF from '../components/pdf/ContractPDF'
import OfficePDF from '../components/pdf/OfficePDF'
import FlexSeatPDF from '../components/pdf/FlexSeatPDF'
import { FileText, Calendar, DollarSign, FileX, Settings2, ChevronDown, FileDown, Loader2, X, Plus, RefreshCw, Edit3, Trash2, Archive, Pencil } from 'lucide-react'

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

// 可選欄位定義（# 和合約編號固定顯示）
const OPTIONAL_COLUMNS = {
  customers: { label: '客戶', default: true },
  branches: { label: '分館', default: false },
  contract_type: { label: '類型', default: true },
  plan_name: { label: '方案', default: true },
  start_date: { label: '起始日', default: false },
  end_date: { label: '到期日', default: true },
  monthly_rent: { label: '月租', default: true },
  payment_cycle: { label: '每期金額', default: true },
  status: { label: '狀態', default: true },
  actions: { label: '操作', default: true }
}

// 初始合約表單（新架構：直接填寫客戶資訊）
const INITIAL_CONTRACT_FORM = {
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
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  original_price: '',
  monthly_rent: '',
  deposit_amount: '',
  payment_cycle: 'monthly',
  payment_day: new Date().getDate(),  // 預設為當日
  position_number: '',
  // PDF 選項
  show_stamp: true  // 電子用印（預設開啟）
}

export default function Contracts() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const customerIdFilter = searchParams.get('customer_id')
  const [statusFilter, setStatusFilter] = useState('')
  const [pageSize, setPageSize] = useState(15)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(null) // 正在生成 PDF 的合約 ID

  // ==========================================================================
  // 統一 Modal 狀態管理（解決多 Modal 問題）
  // modal.open('renew', contract) / modal.isOpen('renew') / modal.getData()
  // ==========================================================================
  const modal = useModal()

  // 便捷存取當前 Modal 資料
  const selectedContract = useMemo(() => {
    const type = modal.currentType
    if (['renew', 'taxId', 'terminate', 'edit'].includes(type)) {
      return modal.currentData
    }
    return null
  }, [modal.currentType, modal.currentData])

  // 新增合約相關
  const [contractForm, setContractForm] = useState(INITIAL_CONTRACT_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 續約表單
  const [renewForm, setRenewForm] = useState({
    new_start_date: '',
    new_end_date: '',
    new_monthly_rent: '',
    notes: ''
  })

  // 補統編表單
  const [taxIdForm, setTaxIdForm] = useState({
    company_tax_id: ''
  })

  // 終止合約原因
  const [terminateReason, setTerminateReason] = useState('')

  // 編輯合約表單
  const [editForm, setEditForm] = useState(INITIAL_CONTRACT_FORM)

  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  // 客戶列表（保留供其他功能使用）
  // const { data: customers } = useCustomers({ limit: 500 })

  // 續約 mutation
  const renewContract = useMutation({
    mutationFn: (data) => callTool('contract_renew', data),
    onSuccess: (response) => {
      const data = response?.result || response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['contracts'] })
        addNotification({
          type: 'success',
          message: `續約成功！新合約編號：${data.new_contract?.contract_number || ''}`
        })
        modal.close()
        resetRenewForm()
      } else {
        addNotification({ type: 'error', message: data.message || '續約失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `續約失敗: ${error.message}` })
    }
  })

  // 補統編 mutation
  const updateTaxId = useMutation({
    mutationFn: (data) => callTool('contract_update_tax_id', data),
    onSuccess: (response) => {
      const data = response?.result || response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['contracts'] })
        addNotification({
          type: 'success',
          message: `統編已更新！${data.note || ''}`
        })
        modal.close()
        resetTaxIdForm()
      } else {
        addNotification({ type: 'error', message: data.message || '更新失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `更新失敗: ${error.message}` })
    }
  })

  // 刪除合約 mutation
  const deleteContract = useMutation({
    mutationFn: async (contractId) => {
      // 1. 先清除報價單的 converted_contract_id 外鍵關聯
      const clearQuotesResponse = await fetch(`/api/db/quotes?converted_contract_id=eq.${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          converted_contract_id: null,
          status: 'accepted'  // 將狀態改回已接受，因為合約被刪除了
        })
      })
      if (!clearQuotesResponse.ok) {
        const errorData = await clearQuotesResponse.json().catch(() => ({}))
        throw new Error(errorData.message || '清除報價單關聯失敗')
      }

      // 2. 刪除相關的付款記錄
      const deletePaymentsResponse = await fetch(`/api/db/payments?contract_id=eq.${contractId}`, {
        method: 'DELETE'
      })
      if (!deletePaymentsResponse.ok) {
        const errorData = await deletePaymentsResponse.json().catch(() => ({}))
        throw new Error(errorData.message || '刪除付款記錄失敗')
      }

      // 3. 刪除合約
      const response = await fetch(`/api/db/contracts?id=eq.${contractId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || '刪除合約失敗')
      }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      addNotification({ type: 'success', message: '合約已刪除，相關報價單已恢復' })
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `刪除失敗: ${error.message}` })
    }
  })

  // 使用 DDD Hook 終止合約
  const terminateContract = useContractTerminate()

  // 更新合約 mutation
  const updateContract = useMutation({
    mutationFn: async ({ contractId, data }) => {
      const response = await fetch(`/api/db/contracts?id=eq.${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) {
        throw new Error('更新失敗')
      }
      return { success: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
      addNotification({ type: 'success', message: '合約已更新' })
      modal.close()
      setEditForm(INITIAL_CONTRACT_FORM)
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `更新失敗: ${error.message}` })
    }
  })

  // 刪除確認
  const handleDeleteContract = (contract) => {
    if (window.confirm(`確定要刪除合約 ${contract.contract_number} 嗎？此操作無法復原。`)) {
      deleteContract.mutate(contract.id)
    }
  }

  // 重設續約表單
  const resetRenewForm = () => {
    setRenewForm({
      new_start_date: '',
      new_end_date: '',
      new_monthly_rent: '',
      notes: ''
    })
  }

  // 重設補統編表單
  const resetTaxIdForm = () => {
    setTaxIdForm({ company_tax_id: '' })
  }

  // 開啟續約 Modal
  const openRenewModal = (contract) => {
    // 預填：新合約開始日 = 舊合約結束日次日
    const oldEndDate = new Date(contract.end_date)
    const newStartDate = new Date(oldEndDate)
    newStartDate.setDate(newStartDate.getDate() + 1)

    // 新合約結束日 = 新開始日 + 12 個月
    const newEndDate = new Date(newStartDate)
    newEndDate.setFullYear(newEndDate.getFullYear() + 1)

    setRenewForm({
      new_start_date: newStartDate.toISOString().split('T')[0],
      new_end_date: newEndDate.toISOString().split('T')[0],
      new_monthly_rent: contract.monthly_rent || '',
      notes: ''
    })
    modal.open('renew', contract)
  }

  // 開啟補統編 Modal
  const openTaxIdModal = (contract) => {
    setTaxIdForm({
      company_tax_id: contract.company_tax_id || ''
    })
    modal.open('taxId', contract)
  }

  // 開啟編輯 Modal
  const openEditModal = (contract) => {
    setEditForm({
      company_name: contract.company_name || contract.customers?.company_name || '',
      representative_name: contract.representative_name || contract.customers?.name || '',
      representative_address: contract.representative_address || '',
      id_number: contract.id_number || '',
      company_tax_id: contract.company_tax_id || '',
      phone: contract.phone || contract.customers?.phone || '',
      email: contract.email || contract.customers?.email || '',
      branch_id: contract.branch_id || 1,
      contract_type: contract.contract_type || 'virtual_office',
      start_date: contract.start_date || '',
      end_date: contract.end_date || '',
      original_price: contract.original_price || 3000,
      monthly_rent: contract.monthly_rent || '',
      deposit_amount: contract.deposit || '',
      payment_cycle: contract.payment_cycle || 'monthly',
      payment_day: contract.payment_day || new Date().getDate(),  // 預設當日
      position_number: contract.position_number || '',
      show_stamp: true  // 電子用印預設開啟
    })
    modal.open('edit', contract)
  }

  // 處理編輯合約
  const handleEditContract = (e) => {
    e.preventDefault()
    if (!selectedContract) return

    updateContract.mutate({
      contractId: selectedContract.id,
      data: {
        company_name: editForm.company_name || null,
        representative_name: editForm.representative_name || null,
        representative_address: editForm.representative_address || null,
        id_number: editForm.id_number || null,
        company_tax_id: editForm.company_tax_id || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        branch_id: parseInt(editForm.branch_id) || 1,
        contract_type: editForm.contract_type,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        original_price: parseFloat(editForm.original_price) || null,
        monthly_rent: parseFloat(editForm.monthly_rent) || null,
        deposit: parseFloat(editForm.deposit_amount) || null,
        payment_cycle: editForm.payment_cycle,
        payment_day: parseInt(editForm.payment_day) || new Date().getDate(),  // 預設當日
        position_number: editForm.position_number || null
      }
    })
  }

  // 開啟終止合約 Modal
  const openTerminateModal = (contract) => {
    setTerminateReason('')
    modal.open('terminate', contract)
  }

  // 執行終止合約（使用 DDD Hook）
  const handleTerminate = async () => {
    if (!selectedContract) return
    await terminateContract.mutateAsync({
      contractId: selectedContract.id,
      reason: terminateReason
    })
    modal.close()
    setTerminateReason('')
  }

  // 執行續約
  const handleRenew = () => {
    if (!renewForm.new_start_date || !renewForm.new_end_date) {
      addNotification({ type: 'error', message: '請填寫新合約起訖日期' })
      return
    }

    renewContract.mutate({
      contract_id: selectedContract.id,
      new_start_date: renewForm.new_start_date,
      new_end_date: renewForm.new_end_date,
      new_monthly_rent: renewForm.new_monthly_rent ? parseFloat(renewForm.new_monthly_rent) : null,
      notes: renewForm.notes || null
    })
  }

  // 執行補統編
  const handleUpdateTaxId = () => {
    if (!taxIdForm.company_tax_id || taxIdForm.company_tax_id.length !== 8) {
      addNotification({ type: 'error', message: '統編格式錯誤，應為 8 碼' })
      return
    }

    updateTaxId.mutate({
      contract_id: selectedContract.id,
      company_tax_id: taxIdForm.company_tax_id
    })
  }

  // 計算合約月數
  const calculateMonths = (startDate, endDate) => {
    if (!startDate || !endDate) return 12
    const start = new Date(startDate)
    const end = new Date(endDate)
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    return months > 0 ? months : 12
  }

  // 生成合約 PDF（前端生成）
  const handleGeneratePdf = async (contractId) => {
    setGeneratingPdf(contractId)
    try {
      // 先獲取完整合約資料
      const result = await crm.getContractDetail(contractId)
      if (!result?.success) {
        throw new Error(result?.error || '無法取得合約資料')
      }

      const contract = result.data?.contract
      const customer = result.data?.customer
      if (!contract) {
        throw new Error('合約資料不存在')
      }

      // 準備 PDF 資料
      const branchInfo = BRANCHES[contract.branch_id] || BRANCHES[1]
      const pdfData = {
        contract_type: contract.contract_type,
        branch_company_name: branchInfo.company_name,
        branch_tax_id: branchInfo.tax_id,
        branch_representative: branchInfo.representative,
        branch_address: branchInfo.address,
        branch_court: branchInfo.court,
        branch_id: contract.branch_id,
        room_number: contract.room_number || '',
        company_name: contract.company_name || customer?.company_name || '',
        representative_name: contract.representative_name || customer?.name || '',
        representative_address: contract.representative_address || customer?.address || '',
        id_number: contract.id_number || customer?.id_number || '',
        company_tax_id: contract.company_tax_id || customer?.company_tax_id || '',
        phone: contract.phone || customer?.phone || '',
        email: contract.email || customer?.email || '',
        start_date: contract.start_date,
        end_date: contract.end_date,
        periods: calculateMonths(contract.start_date, contract.end_date),
        original_price: parseFloat(contract.original_price) || 0,
        monthly_rent: parseFloat(contract.monthly_rent) || 0,
        deposit_amount: parseFloat(contract.deposit) || 0,
        payment_day: parseInt(contract.payment_day) || 8,
        show_stamp: true
      }

      // 根據合約類型選擇 PDF 組件
      let PdfComponent
      if (contract.contract_type === 'office') {
        PdfComponent = OfficePDF
      } else if (contract.contract_type === 'flex_seat') {
        PdfComponent = FlexSeatPDF
      } else {
        PdfComponent = ContractPDF
      }

      // 生成 PDF blob
      const blob = await pdf(<PdfComponent data={pdfData} />).toBlob()

      // 建立下載連結
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `合約_${contract.contract_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('生成合約 PDF 失敗:', error)
      alert('生成合約 PDF 失敗: ' + (error.message || '未知錯誤'))
    } finally {
      setGeneratingPdf(null)
    }
  }

  // 新增合約
  const handleCreateContract = async (e) => {
    e.preventDefault()
    // 驗證必填欄位
    if (!contractForm.representative_name) {
      addNotification({ type: 'error', message: '請填寫負責人姓名' })
      return
    }
    if (!contractForm.phone) {
      addNotification({ type: 'error', message: '請填寫聯絡電話' })
      return
    }
    if (!contractForm.start_date || !contractForm.end_date) {
      addNotification({ type: 'error', message: '請填寫合約期間' })
      return
    }
    if (!contractForm.monthly_rent) {
      addNotification({ type: 'error', message: '請填寫月租金額' })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await callTool('crm_create_contract', {
        // 承租人資訊（觸發器會自動建立/關聯客戶）
        company_name: contractForm.company_name || null,
        representative_name: contractForm.representative_name,
        representative_address: contractForm.representative_address || null,
        id_number: contractForm.id_number || null,
        company_tax_id: contractForm.company_tax_id || null,
        phone: contractForm.phone,
        email: contractForm.email || null,
        // 合約資訊
        branch_id: parseInt(contractForm.branch_id),
        contract_type: contractForm.contract_type,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date,
        original_price: contractForm.original_price ? parseFloat(contractForm.original_price) : null,
        monthly_rent: parseFloat(contractForm.monthly_rent),
        deposit_amount: parseFloat(contractForm.deposit_amount) || 0,
        payment_cycle: contractForm.payment_cycle,
        payment_day: parseInt(contractForm.payment_day) || new Date().getDate()  // 預設當日
      })

      if (result?.success || result?.result?.success) {
        alert('合約建立成功！')
        modal.close()
        setContractForm(INITIAL_CONTRACT_FORM)
        refetch()
        // 導航到新合約詳情頁
        const newContractId = result?.result?.contract_id || result?.contract_id
        if (newContractId) {
          navigate(`/contracts/${newContractId}`)
        }
      } else {
        alert('建立失敗: ' + (result?.result?.error || result?.error || '未知錯誤'))
      }
    } catch (error) {
      console.error('建立合約失敗:', error)
      alert('建立合約失敗: ' + (error.message || '未知錯誤'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // 初始化欄位顯示狀態
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const initial = {}
    Object.entries(OPTIONAL_COLUMNS).forEach(([key, { default: def }]) => {
      initial[key] = def
    })
    return initial
  })

  const { data: contracts, isLoading, refetch } = useContracts({
    // 預設排除已到期和已取消的合約
    status: statusFilter ? `eq.${statusFilter}` : 'in.(active,pending,pending_sign)',
    customer_id: customerIdFilter ? `eq.${customerIdFilter}` : undefined,
    limit: 99999
  })

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
      key: 'contract_number',
      header: '合約編號',
      accessor: 'contract_number',
      fixed: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-primary-600">{row.contract_number}</span>
        </div>
      )
    },
    {
      key: 'customers',
      header: '客戶',
      accessor: 'customers',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.customers?.name || '-'}</p>
          {row.customers?.company_name && (
            <p className="text-xs text-gray-500">{row.customers.company_name}</p>
          )}
        </div>
      )
    },
    {
      key: 'branches',
      header: '分館',
      accessor: 'branches',
      cell: (row) => row.branches?.name || '-'
    },
    {
      key: 'contract_type',
      header: '類型',
      accessor: 'contract_type',
      cell: (row) => {
        const types = {
          virtual_office: '營業登記',
          custom: '營業登記',  // 從報價單轉換的合約
          office: '辦公室租賃',
          flex_seat: '自由座',
          shared_space: '共享空間',
          coworking_fixed: '固定座位',
          coworking_flexible: '彈性座位',
          meeting_room: '會議室',
          mailbox: '郵件代收'
        }
        return types[row.contract_type] || row.contract_type
      }
    },
    {
      key: 'duration',
      header: '年限',
      accessor: 'start_date',
      cell: (row) => {
        if (!row.start_date || !row.end_date) return '-'
        const start = new Date(row.start_date)
        const end = new Date(row.end_date)
        const months = Math.round((end - start) / (1000 * 60 * 60 * 24 * 30))
        if (months >= 12) {
          const years = Math.round(months / 12)
          return <span className="text-sm">{years} 年</span>
        }
        return <span className="text-sm">{months} 月</span>
      }
    },
    {
      key: 'start_date',
      header: '起始日',
      accessor: 'start_date',
      cell: (row) => (
        <span className="text-sm">{row.start_date || '-'}</span>
      )
    },
    {
      key: 'end_date',
      header: '到期日',
      accessor: 'end_date',
      cell: (row) => (
        <span className="text-sm">{row.end_date || '-'}</span>
      )
    },
    {
      key: 'monthly_rent',
      header: '月租',
      accessor: 'monthly_rent',
      cell: (row) => (
        <span className="font-medium text-green-600">
          ${(row.monthly_rent || 0).toLocaleString()}
        </span>
      )
    },
    {
      key: 'payment_cycle',
      header: '每期金額',
      accessor: 'payment_cycle',
      cell: (row) => {
        const monthlyRent = row.monthly_rent || 0
        const cycleMultiplier = {
          monthly: 1,
          quarterly: 3,
          semi_annual: 6,
          annual: 12,
          biennial: 24
        }
        const cycleLabel = {
          monthly: '月繳',
          quarterly: '季繳',
          semi_annual: '半年繳',
          annual: '年繳',
          biennial: '兩年繳'
        }
        const multiplier = cycleMultiplier[row.payment_cycle] || 1
        const periodAmount = monthlyRent * multiplier
        return (
          <div className="text-sm">
            <span className="font-medium text-blue-600">
              ${periodAmount.toLocaleString()}
            </span>
            <span className="text-gray-400 text-xs ml-1">
              ({cycleLabel[row.payment_cycle] || row.payment_cycle})
            </span>
          </div>
        )
      }
    },
    {
      key: 'actions',
      header: '操作',
      accessor: 'id',
      cell: (row) => (
        <div className="flex items-center gap-1">
          {/* 生成 PDF */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleGeneratePdf(row.id)
            }}
            disabled={generatingPdf === row.id}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            title="生成合約 PDF"
          >
            {generatingPdf === row.id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
          </button>
          {/* 編輯合約 - 非已結束狀態可編輯 */}
          {row.status !== 'cancelled' && row.status !== 'terminated' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openEditModal(row)
              }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
              title="編輯合約"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {/* 續約（只有 active 或 expired 可續約） */}
          {(row.status === 'active' || row.status === 'expired') && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openRenewModal(row)
              }}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
              title="續約"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {/* 補統編（沒有統編的合約才顯示） */}
          {!row.company_tax_id && row.status !== 'cancelled' && row.status !== 'terminated' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openTaxIdModal(row)
              }}
              className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg"
              title="補統編"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          {/* 終止合約（移動到已結束） - active 或 pending 狀態可用 */}
          {(row.status === 'active' || row.status === 'pending' || row.status === 'pending_sign') && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openTerminateModal(row)
              }}
              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
              title="移動到已結束"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
          {/* 刪除合約 - 只有待簽約或待生效可刪除 */}
          {(row.status === 'pending' || row.status === 'pending_sign') && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteContract(row)
              }}
              disabled={deleteContract.isPending}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
              title="刪除合約"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  // 根據顯示狀態過濾欄位
  const columns = allColumns.filter(col =>
    col.fixed || visibleColumns[col.key]
  )

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  // 統計
  const contractsArr = Array.isArray(contracts) ? contracts : []
  const stats = {
    total: contractsArr.length,
    active: contractsArr.filter((c) => c.status === 'active').length,
    expiring: contractsArr.filter((c) => {
      if (c.status !== 'active') return false
      const endDate = new Date(c.end_date)
      const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))
      return daysLeft <= 30 && daysLeft > 0
    }).length
  }

  return (
    <div className="space-y-6">
      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-gray-500">總合約數</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-xl">
            <FileText className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.active}</p>
            <p className="text-sm text-gray-500">有效合約</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="p-3 bg-yellow-100 rounded-xl">
            <Calendar className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.expiring}</p>
            <p className="text-sm text-gray-500">30天內到期</p>
          </div>
        </div>
      </div>

      {/* 篩選 */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          {/* 客戶篩選提示 */}
          {customerIdFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-sm">
              <span>篩選：{contracts?.[0]?.customers?.name || '客戶'} 的合約</span>
              <button
                onClick={() => setSearchParams({})}
                className="p-0.5 hover:bg-primary-100 rounded"
                title="清除篩選"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="contract-status-filter" className="text-sm text-gray-600">狀態：</label>
            <select
              id="contract-status-filter"
              name="contract-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-40"
            >
              <option value="">全部（不含已結束）</option>
              <option value="active">生效中</option>
              <option value="pending">待生效</option>
              <option value="pending_sign">待簽約</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="contract-page-size" className="text-sm text-gray-600">每頁：</label>
            <select
              id="contract-page-size"
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

          <div className="flex-1" />

          <button
            onClick={() => navigate('/contracts/expired')}
            className="btn-secondary"
          >
            <FileX className="w-4 h-4 mr-2" />
            已結束合約
          </button>

          <button
            onClick={() => navigate('/contracts/new')}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            新增合約
          </button>
        </div>
      </div>

      {/* 資料表 */}
      <DataTable
        columns={columns}
        data={contracts || []}
        loading={isLoading}
        onRefresh={refetch}
        pageSize={pageSize}
        emptyMessage="沒有合約資料"
        onRowClick={(row) => navigate(`/contracts/${row.id}`)}
      />

      {/* 新增合約 Modal */}
      <Modal
        open={modal.isOpen('add')}
        onClose={() => {
          modal.close()
          setContractForm(INITIAL_CONTRACT_FORM)
        }}
        title="新增合約"
        size="lg"
      >
        <form onSubmit={handleCreateContract} className="space-y-6">
          {/* 承租人資訊（乙方） */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-4">承租人資訊（乙方）</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公司名稱</label>
                <input
                  type="text"
                  value={contractForm.company_name}
                  onChange={(e) => setContractForm(prev => ({ ...prev, company_name: e.target.value }))}
                  className="input w-full"
                  placeholder="公司名稱（新設立可空白）"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  負責人姓名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contractForm.representative_name}
                  onChange={(e) => setContractForm(prev => ({ ...prev, representative_name: e.target.value }))}
                  className="input w-full"
                  placeholder="負責人姓名"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">負責人地址</label>
                <input
                  type="text"
                  value={contractForm.representative_address}
                  onChange={(e) => setContractForm(prev => ({ ...prev, representative_address: e.target.value }))}
                  className="input w-full"
                  placeholder="戶籍地址"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">身分證號碼</label>
                <input
                  type="text"
                  value={contractForm.id_number}
                  onChange={(e) => setContractForm(prev => ({ ...prev, id_number: e.target.value }))}
                  className="input w-full"
                  placeholder="身分證/居留證號碼"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公司統編</label>
                <input
                  type="text"
                  value={contractForm.company_tax_id}
                  onChange={(e) => setContractForm(prev => ({ ...prev, company_tax_id: e.target.value }))}
                  className="input w-full"
                  placeholder="8碼統編（新設立可空白）"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  聯絡電話 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={contractForm.phone}
                  onChange={(e) => setContractForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="input w-full"
                  placeholder="聯絡電話"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={contractForm.email}
                  onChange={(e) => setContractForm(prev => ({ ...prev, email: e.target.value }))}
                  className="input w-full"
                  placeholder="電子郵件"
                />
              </div>
            </div>
          </div>

          {/* 合約條件 */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-medium text-green-900 mb-4">租賃條件</h3>

            {/* 合約類型 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">合約類型</label>
                <select
                  value={contractForm.contract_type}
                  onChange={(e) => setContractForm(prev => ({ ...prev, contract_type: e.target.value }))}
                  className="input w-full"
                >
                  <option value="virtual_office">營業登記</option>
                  <option value="coworking_fixed">固定座位</option>
                  <option value="coworking_flexible">彈性座位</option>
                  <option value="meeting_room">會議室</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分館</label>
                <select
                  value={contractForm.branch_id}
                  onChange={(e) => setContractForm(prev => ({ ...prev, branch_id: e.target.value }))}
                  className="input w-full"
                >
                  <option value="1">大忠館</option>
                  <option value="2">環瑞館</option>
                </select>
              </div>
            </div>

            {/* 合約期間 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  起始日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={contractForm.start_date}
                  onChange={(e) => setContractForm(prev => ({ ...prev, start_date: e.target.value }))}
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  結束日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={contractForm.end_date}
                  onChange={(e) => setContractForm(prev => ({ ...prev, end_date: e.target.value }))}
                  className="input w-full"
                  required
                />
              </div>
            </div>

            {/* 金額 */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">定價（原價）</label>
                <input
                  type="number"
                  value={contractForm.original_price}
                  onChange={(e) => setContractForm(prev => ({ ...prev, original_price: e.target.value }))}
                  className="input w-full"
                  placeholder="用於違約金計算"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  月租金額 <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={contractForm.monthly_rent}
                  onChange={(e) => setContractForm(prev => ({ ...prev, monthly_rent: e.target.value }))}
                  className="input w-full"
                  placeholder="實際月租"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">押金</label>
                <input
                  type="number"
                  value={contractForm.deposit_amount}
                  onChange={(e) => setContractForm(prev => ({ ...prev, deposit_amount: e.target.value }))}
                  className="input w-full"
                  placeholder="押金金額"
                />
              </div>
            </div>

            {/* 繳費週期 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">繳費週期</label>
                <select
                  value={contractForm.payment_cycle}
                  onChange={(e) => setContractForm(prev => ({ ...prev, payment_cycle: e.target.value }))}
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={contractForm.payment_day}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')  // 只允許數字
                    const num = parseInt(val) || ''
                    // 限制範圍 1-31，超過月底時自動用該月最後一天
                    if (val === '' || (num >= 1 && num <= 31)) {
                      setContractForm(prev => ({ ...prev, payment_day: val === '' ? '' : num }))
                    }
                  }}
                  className="input w-full"
                  placeholder="每期幾號 (1-31)"
                />
                <p className="text-xs text-gray-500 mt-1">預設為合約建立當日</p>
              </div>
            </div>
          </div>

          {/* 按鈕 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                modal.close()
                setContractForm(INITIAL_CONTRACT_FORM)
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
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
                  <Plus className="w-4 h-4 mr-2" />
                  建立合約
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* 續約 Modal */}
      <Modal
        open={modal.isOpen('renew')}
        onClose={() => {
          modal.close()
          resetRenewForm()
        }}
        title="合約續約"
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                modal.close()
                resetRenewForm()
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleRenew}
              disabled={renewContract.isPending}
              className="btn-primary bg-green-600 hover:bg-green-700"
            >
              {renewContract.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  確認續約
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 提示訊息 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              續約將把原合約標記為「已續約」，並建立一份新合約。
            </p>
          </div>

          {/* 原合約摘要 */}
          {selectedContract && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">原合約</p>
              <p className="font-medium">{selectedContract.contract_number}</p>
              <p className="text-sm text-gray-600">
                {selectedContract.customers?.name} - {selectedContract.customers?.company_name || ''}
              </p>
              <p className="text-sm text-gray-600">
                {selectedContract.start_date} ~ {selectedContract.end_date}
              </p>
              <p className="text-sm font-medium text-green-600">
                月租 ${(selectedContract.monthly_rent || 0).toLocaleString()}
              </p>
            </div>
          )}

          {/* 新合約設定 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                新合約起始日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={renewForm.new_start_date}
                onChange={(e) => setRenewForm({ ...renewForm, new_start_date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">
                新合約結束日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={renewForm.new_end_date}
                onChange={(e) => setRenewForm({ ...renewForm, new_end_date: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">新月租金（不填則沿用）</label>
            <input
              type="number"
              value={renewForm.new_monthly_rent}
              onChange={(e) => setRenewForm({ ...renewForm, new_monthly_rent: e.target.value })}
              className="input"
              placeholder={`原月租：${selectedContract?.monthly_rent || 0}`}
            />
          </div>

          <div>
            <label className="label">備註</label>
            <textarea
              value={renewForm.notes}
              onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
              className="input resize-none"
              rows={2}
              placeholder="選填"
            />
          </div>
        </div>
      </Modal>

      {/* 補統編 Modal */}
      <Modal
        open={modal.isOpen('taxId')}
        onClose={() => {
          modal.close()
          resetTaxIdForm()
        }}
        title="補上公司統編"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                modal.close()
                resetTaxIdForm()
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleUpdateTaxId}
              disabled={updateTaxId.isPending}
              className="btn-primary"
            >
              {updateTaxId.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  更新中...
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 mr-2" />
                  確認更新
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 提示訊息 */}
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              新設立公司取得統編後，請在此補上。更新後請重新產生合約 PDF。
            </p>
          </div>

          {/* 合約摘要 */}
          {selectedContract && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">合約</p>
              <p className="font-medium">{selectedContract.contract_number}</p>
              <p className="text-sm text-gray-600">
                {selectedContract.company_name || selectedContract.customers?.company_name || '無公司名稱'}
              </p>
            </div>
          )}

          <div>
            <label className="label">
              公司統編 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={taxIdForm.company_tax_id}
              onChange={(e) => setTaxIdForm({ ...taxIdForm, company_tax_id: e.target.value })}
              className="input"
              placeholder="8 碼統一編號"
              maxLength={8}
            />
          </div>
        </div>
      </Modal>

      {/* 終止合約 Modal */}
      <Modal
        open={modal.isOpen('terminate')}
        onClose={() => {
          modal.close()
          setTerminateReason('')
        }}
        title="終止合約"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                modal.close()
                setTerminateReason('')
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleTerminate}
              disabled={terminateContract.isPending}
              className="btn-primary bg-gray-600 hover:bg-gray-700"
            >
              {terminateContract.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-2" />
                  確認終止
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* 警告訊息 */}
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              終止合約後，合約將移動到「已結束合約」列表。此操作可以在已結束合約頁面中恢復。
            </p>
          </div>

          {/* 合約摘要 */}
          {selectedContract && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">合約</p>
              <p className="font-medium">{selectedContract.contract_number}</p>
              <p className="text-sm text-gray-600">
                {selectedContract.customers?.name} - {selectedContract.company_name || selectedContract.customers?.company_name || ''}
              </p>
              <p className="text-sm text-gray-600">
                {selectedContract.start_date} ~ {selectedContract.end_date}
              </p>
            </div>
          )}

          <div>
            <label className="label">終止原因（選填）</label>
            <textarea
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
              className="input resize-none"
              rows={2}
              placeholder="例：客戶提前解約、遷址..."
            />
          </div>
        </div>
      </Modal>

      {/* 編輯合約 Modal */}
      <Modal
        open={modal.isOpen('edit')}
        onClose={() => {
          modal.close()
          setEditForm(INITIAL_CONTRACT_FORM)
        }}
        title={`編輯合約 ${selectedContract?.contract_number || ''}`}
        size="lg"
      >
        <form onSubmit={handleEditContract} className="space-y-6">
          {/* 承租人資訊（乙方） */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-4">承租人資訊（乙方）</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公司名稱</label>
                <input
                  type="text"
                  value={editForm.company_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, company_name: e.target.value }))}
                  className="input w-full"
                  placeholder="公司名稱"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">負責人姓名</label>
                <input
                  type="text"
                  value={editForm.representative_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, representative_name: e.target.value }))}
                  className="input w-full"
                  placeholder="負責人姓名"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">負責人地址</label>
                <input
                  type="text"
                  value={editForm.representative_address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, representative_address: e.target.value }))}
                  className="input w-full"
                  placeholder="戶籍地址"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">身分證號碼</label>
                <input
                  type="text"
                  value={editForm.id_number}
                  onChange={(e) => setEditForm(prev => ({ ...prev, id_number: e.target.value }))}
                  className="input w-full"
                  placeholder="身分證/居留證號碼"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">公司統編</label>
                <input
                  type="text"
                  value={editForm.company_tax_id}
                  onChange={(e) => setEditForm(prev => ({ ...prev, company_tax_id: e.target.value }))}
                  className="input w-full"
                  placeholder="8碼統編"
                  maxLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">聯絡電話</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="input w-full"
                  placeholder="聯絡電話"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="input w-full"
                  placeholder="電子郵件"
                />
              </div>
            </div>
          </div>

          {/* 合約條件 */}
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-medium text-green-900 mb-4">租賃條件</h3>

            {/* 合約類型 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">合約類型</label>
                <select
                  value={editForm.contract_type}
                  onChange={(e) => setEditForm(prev => ({ ...prev, contract_type: e.target.value }))}
                  className="input w-full"
                >
                  <option value="virtual_office">營業登記</option>
                  <option value="coworking_fixed">固定座位</option>
                  <option value="coworking_flexible">彈性座位</option>
                  <option value="meeting_room">會議室</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分館</label>
                <select
                  value={editForm.branch_id}
                  onChange={(e) => setEditForm(prev => ({ ...prev, branch_id: e.target.value }))}
                  className="input w-full"
                >
                  <option value="1">大忠館</option>
                  <option value="2">環瑞館</option>
                </select>
              </div>
            </div>

            {/* 合約期間 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">起始日期</label>
                <input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
                <input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm(prev => ({ ...prev, end_date: e.target.value }))}
                  className="input w-full"
                />
              </div>
            </div>

            {/* 金額 */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">定價（原價）</label>
                <input
                  type="number"
                  value={editForm.original_price}
                  onChange={(e) => setEditForm(prev => ({ ...prev, original_price: e.target.value }))}
                  className="input w-full"
                  placeholder="用於違約金計算"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">月租金額</label>
                <input
                  type="number"
                  value={editForm.monthly_rent}
                  onChange={(e) => setEditForm(prev => ({ ...prev, monthly_rent: e.target.value }))}
                  className="input w-full"
                  placeholder="實際月租"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">押金</label>
                <input
                  type="number"
                  value={editForm.deposit_amount}
                  onChange={(e) => setEditForm(prev => ({ ...prev, deposit_amount: e.target.value }))}
                  className="input w-full"
                  placeholder="押金金額"
                />
              </div>
            </div>

            {/* 繳費週期 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">繳費週期</label>
                <select
                  value={editForm.payment_cycle}
                  onChange={(e) => setEditForm(prev => ({ ...prev, payment_cycle: e.target.value }))}
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
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editForm.payment_day}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '')  // 只允許數字
                    const num = parseInt(val) || ''
                    // 限制範圍 1-31，超過月底時自動用該月最後一天
                    if (val === '' || (num >= 1 && num <= 31)) {
                      setEditForm(prev => ({ ...prev, payment_day: val === '' ? '' : num }))
                    }
                  }}
                  className="input w-full"
                  placeholder="每期幾號 (1-31)"
                />
              </div>
            </div>
          </div>

          {/* 電子用印選項 */}
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={editForm.show_stamp}
                onChange={(e) => setEditForm(prev => ({ ...prev, show_stamp: e.target.checked }))}
                className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="font-medium text-purple-900">電子用印</span>
                <p className="text-sm text-purple-600">勾選後合約 PDF 將自動加蓋公司印章（適用於線上續約客戶）</p>
              </div>
            </label>
          </div>

          {/* 按鈕 */}
          <div className="flex justify-between items-center pt-4 border-t">
            {/* 左側：下載 PDF */}
            <button
              type="button"
              onClick={async () => {
                if (!selectedContract) return
                try {
                  const branchInfo = BRANCHES[selectedContract.branch_id] || BRANCHES[1]
                  const pdfData = {
                    contract_type: selectedContract.contract_type,
                    branch_company_name: branchInfo.company_name,
                    branch_tax_id: branchInfo.tax_id,
                    branch_representative: branchInfo.representative,
                    branch_address: branchInfo.address,
                    branch_court: branchInfo.court,
                    branch_id: selectedContract.branch_id,
                    room_number: selectedContract.room_number || '',
                    company_name: editForm.company_name,
                    representative_name: editForm.representative_name,
                    representative_address: editForm.representative_address,
                    id_number: editForm.id_number,
                    company_tax_id: editForm.company_tax_id,
                    phone: editForm.phone,
                    email: editForm.email,
                    start_date: editForm.start_date,
                    end_date: editForm.end_date,
                    periods: calculateMonths(editForm.start_date, editForm.end_date),
                    original_price: parseFloat(editForm.original_price) || 0,
                    monthly_rent: parseFloat(editForm.monthly_rent) || 0,
                    deposit_amount: parseFloat(editForm.deposit_amount) || 0,
                    payment_day: parseInt(editForm.payment_day) || 8,
                    show_stamp: editForm.show_stamp
                  }
                  let PdfComponent
                  if (selectedContract.contract_type === 'office') {
                    PdfComponent = OfficePDF
                  } else if (selectedContract.contract_type === 'flex_seat') {
                    PdfComponent = FlexSeatPDF
                  } else {
                    PdfComponent = ContractPDF
                  }
                  const blob = await pdf(<PdfComponent data={pdfData} />).toBlob()
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `合約_${selectedContract.contract_number}.pdf`
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                  URL.revokeObjectURL(url)
                } catch (error) {
                  console.error('生成合約 PDF 失敗:', error)
                  alert('生成合約 PDF 失敗: ' + (error.message || '未知錯誤'))
                }
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              下載合約 PDF
            </button>

            {/* 右側：取消和儲存 */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  modal.close()
                  setEditForm(INITIAL_CONTRACT_FORM)
                }}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={updateContract.isPending}
                className="btn-primary"
              >
                {updateContract.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    更新中...
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4 mr-2" />
                    儲存變更
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}
