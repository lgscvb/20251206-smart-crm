import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { db } from '../services/api'
import useStore from '../store/useStore'
import DataTable from '../components/DataTable'
import Badge from '../components/Badge'
import {
  UserX,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  RefreshCw
} from 'lucide-react'

export default function ChurnedCustomers() {
  const navigate = useNavigate()
  const selectedBranch = useStore((state) => state.selectedBranch)

  // 取得流失客戶
  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ['churned-customers', selectedBranch],
    queryFn: () => {
      const params = {
        status: 'eq.churned',
        order: 'latest_contract_end.desc',
        limit: 200
      }
      if (selectedBranch) {
        params.branch_id = `eq.${selectedBranch}`
      }
      return db.query('v_customer_summary', params)
    }
  })

  // 統計
  const stats = customers
    ? {
        total: customers.length,
        withContract: customers.filter((c) => c.total_contracts > 0).length,
        noContract: customers.filter((c) => c.total_contracts === 0).length
      }
    : { total: 0, withContract: 0, noContract: 0 }

  // 表格欄位
  const columns = [
    {
      header: '客戶',
      accessor: 'name',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-500">
              {row.name?.charAt(0) || '?'}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-700">{row.name}</p>
            {row.company_name && (
              <p className="text-xs text-gray-500">{row.company_name}</p>
            )}
          </div>
        </div>
      )
    },
    {
      header: '聯絡方式',
      accessor: 'phone',
      cell: (row) => (
        <div className="space-y-1">
          {row.phone && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Phone className="w-3.5 h-3.5" />
              {row.phone}
            </div>
          )}
          {row.email && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Mail className="w-3.5 h-3.5" />
              {row.email}
            </div>
          )}
          {!row.phone && !row.email && (
            <span className="text-gray-400">-</span>
          )}
        </div>
      )
    },
    {
      header: '分館',
      accessor: 'branch_name'
    },
    {
      header: '合約到期日',
      accessor: 'latest_contract_end',
      cell: (row) =>
        row.latest_contract_end ? (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <Calendar className="w-3.5 h-3.5" />
            {row.latest_contract_end}
          </div>
        ) : (
          <span className="text-gray-400">無合約</span>
        )
    },
    {
      header: '歷史合約',
      accessor: 'total_contracts',
      cell: (row) => (
        <span className="text-gray-600">{row.total_contracts || 0} 份</span>
      )
    },
    {
      header: '累計繳費',
      accessor: 'total_paid',
      cell: (row) =>
        row.total_paid > 0 ? (
          <span className="font-medium text-gray-700">
            ${row.total_paid.toLocaleString()}
          </span>
        ) : (
          <span className="text-gray-400">$0</span>
        )
    },
    {
      header: '流失原因',
      accessor: 'notes',
      cell: () => <Badge variant="gray">未續約</Badge>
    }
  ]

  return (
    <div className="space-y-6">
      {/* 頁首 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <UserX className="w-6 h-6 text-gray-500" />
              流失客戶
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              合約過期未續約的客戶
            </p>
          </div>
        </div>
        <button onClick={() => refetch()} className="btn-secondary">
          <RefreshCw className="w-4 h-4 mr-2" />
          重新整理
        </button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <UserX className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">流失客戶總數</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">有合約記錄</p>
              <p className="text-2xl font-bold text-amber-600">
                {stats.withContract}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <UserX className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500">無合約記錄</p>
              <p className="text-2xl font-bold text-gray-500">
                {stats.noContract}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 資料表 */}
      <DataTable
        columns={columns}
        data={customers || []}
        loading={isLoading}
        onRowClick={(row) => navigate(`/customers/${row.id}`)}
        pageSize={20}
        emptyMessage="沒有流失客戶"
      />
    </div>
  )
}
