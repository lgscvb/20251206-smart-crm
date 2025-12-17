import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useContracts } from '../hooks/useApi'
import { crm } from '../services/api'
import DataTable from '../components/DataTable'
import Badge, { StatusBadge } from '../components/Badge'
import { FileText, Calendar, DollarSign, FileX, Settings2, ChevronDown, FileDown, Loader2, ExternalLink, X } from 'lucide-react'

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

export default function Contracts() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const customerIdFilter = searchParams.get('customer_id')
  const [statusFilter, setStatusFilter] = useState('')
  const [pageSize, setPageSize] = useState(15)
  const [showColumnPicker, setShowColumnPicker] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(null) // 正在生成 PDF 的合約 ID
  const [pdfResult, setPdfResult] = useState(null) // PDF 生成結果

  // 生成合約 PDF
  const handleGeneratePdf = async (contractId) => {
    setGeneratingPdf(contractId)
    setPdfResult(null)
    try {
      const result = await crm.generateContractPdf(contractId)
      // API 回應結構: { success, tool, result: { success, pdf_url } }
      const pdfUrl = result?.result?.pdf_url || result?.pdf_url
      const isSuccess = result?.result?.success || result?.success
      const expiresAt = result?.result?.expires_at || result?.expires_at
      const message = result?.result?.message || result?.message

      if (isSuccess && pdfUrl) {
        setPdfResult({
          contractId,
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
      setGeneratingPdf(null)
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
    status: statusFilter ? `eq.${statusFilter}` : 'in.(active,pending)',
    customer_id: customerIdFilter ? `eq.${customerIdFilter}` : undefined,
    limit: 100
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
          virtual_office: '虛擬辦公室',
          shared_space: '共享空間',
          meeting_room: '會議室',
          mailbox: '郵件代收'
        }
        return types[row.contract_type] || row.contract_type
      }
    },
    {
      key: 'plan_name',
      header: '方案',
      accessor: 'plan_name',
      cell: (row) => row.plan_name || '-'
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
          annual: 12
        }
        const cycleLabel = {
          monthly: '月繳',
          quarterly: '季繳',
          semi_annual: '半年繳',
          annual: '年繳'
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
      key: 'status',
      header: '狀態',
      accessor: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      key: 'actions',
      header: '操作',
      accessor: 'id',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleGeneratePdf(row.id)
            }}
            disabled={generatingPdf === row.id}
            className="btn-secondary text-xs py-1 px-2 disabled:opacity-50"
            title="生成合約 PDF"
          >
            {generatingPdf === row.id ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <FileDown className="w-3 h-3 mr-1" />
                合約PDF
              </>
            )}
          </button>
          {pdfResult?.contractId === row.id && (
            <a
              href={pdfResult.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700"
              title="開啟 PDF"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
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
    </div>
  )
}
