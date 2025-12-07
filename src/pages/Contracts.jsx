import { useState } from 'react'
import { useContracts } from '../hooks/useApi'
import DataTable from '../components/DataTable'
import Badge, { StatusBadge } from '../components/Badge'
import { FileText, Calendar, DollarSign } from 'lucide-react'

export default function Contracts() {
  const [statusFilter, setStatusFilter] = useState('')

  const { data: contracts, isLoading, refetch } = useContracts({
    ...(statusFilter && { status: `eq.${statusFilter}` }),
    limit: 100
  })

  const columns = [
    {
      header: '合約編號',
      accessor: 'contract_number',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-primary-600">{row.contract_number}</span>
        </div>
      )
    },
    {
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
      header: '分館',
      accessor: 'branches',
      cell: (row) => row.branches?.name || '-'
    },
    {
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
      header: '方案',
      accessor: 'plan_name',
      cell: (row) => row.plan_name || '-'
    },
    {
      header: '期間',
      accessor: 'start_date',
      cell: (row) => (
        <div className="flex items-center gap-1 text-sm">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span>{row.start_date}</span>
          <span className="text-gray-400">~</span>
          <span>{row.end_date}</span>
        </div>
      )
    },
    {
      header: '月租',
      accessor: 'monthly_rent',
      cell: (row) => (
        <div className="flex items-center gap-1 font-medium text-green-600">
          <DollarSign className="w-4 h-4" />
          {(row.monthly_rent || 0).toLocaleString()}
        </div>
      )
    },
    {
      header: '狀態',
      accessor: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    }
  ]

  // 統計
  const stats = {
    total: contracts?.length || 0,
    active: contracts?.filter((c) => c.status === 'active').length || 0,
    expiring: contracts?.filter((c) => {
      if (c.status !== 'active') return false
      const endDate = new Date(c.end_date)
      const daysLeft = Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))
      return daysLeft <= 30 && daysLeft > 0
    }).length || 0
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
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-600">狀態：</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-32"
          >
            <option value="">全部</option>
            <option value="active">生效中</option>
            <option value="pending">待生效</option>
            <option value="expired">已到期</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>

      {/* 資料表 */}
      <DataTable
        columns={columns}
        data={contracts || []}
        loading={isLoading}
        onRefresh={refetch}
        pageSize={15}
        emptyMessage="沒有合約資料"
      />
    </div>
  )
}
