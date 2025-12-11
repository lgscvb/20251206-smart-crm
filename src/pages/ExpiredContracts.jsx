import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { db } from '../services/api'
import useStore from '../store/useStore'
import DataTable from '../components/DataTable'
import Badge, { StatusBadge } from '../components/Badge'
import {
  FileX,
  Calendar,
  ArrowLeft,
  RefreshCw,
  FileText,
  DollarSign
} from 'lucide-react'

export default function ExpiredContracts() {
  const navigate = useNavigate()
  const selectedBranch = useStore((state) => state.selectedBranch)
  const [statusFilter, setStatusFilter] = useState('')
  const [pageSize, setPageSize] = useState(15)

  // 取得已結束合約（expired + cancelled）
  const { data: contracts, isLoading, refetch } = useQuery({
    queryKey: ['expired-contracts', selectedBranch, statusFilter],
    queryFn: () => {
      const params = {
        order: 'end_date.desc',
        limit: 200,
        select: '*,customers(name,company_name),branches(name)'
      }

      if (statusFilter) {
        params.status = `eq.${statusFilter}`
      } else {
        params.status = 'in.(expired,cancelled)'
      }

      if (selectedBranch) {
        params.branch_id = `eq.${selectedBranch}`
      }
      return db.query('contracts', params)
    }
  })

  // 統計
  const stats = contracts
    ? {
        total: contracts.length,
        expired: contracts.filter((c) => c.status === 'expired').length,
        cancelled: contracts.filter((c) => c.status === 'cancelled').length
      }
    : { total: 0, expired: 0, cancelled: 0 }

  // 表格欄位
  const columns = [
    {
      header: '#',
      accessor: '_index',
      cell: (row, index) => (
        <span className="text-gray-500 font-mono text-sm">{index + 1}</span>
      )
    },
    {
      header: '合約編號',
      accessor: 'contract_number',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-600">{row.contract_number}</span>
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
      header: '起始日',
      accessor: 'start_date',
      cell: (row) => (
        <span className="text-sm text-gray-600">{row.start_date || '-'}</span>
      )
    },
    {
      header: '到期日',
      accessor: 'end_date',
      cell: (row) => (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Calendar className="w-3.5 h-3.5" />
          {row.end_date || '-'}
        </div>
      )
    },
    {
      header: '月租',
      accessor: 'monthly_rent',
      cell: (row) => (
        <span className="font-medium text-gray-600">
          ${(row.monthly_rent || 0).toLocaleString()}
        </span>
      )
    },
    {
      header: '狀態',
      accessor: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    }
  ]

  return (
    <div className="space-y-6">
      {/* 頁首 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/contracts')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileX className="w-6 h-6 text-gray-500" />
              已結束合約
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              已到期或已取消的合約
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
              <FileX className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已結束總數</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已到期</p>
              <p className="text-2xl font-bold text-amber-600">{stats.expired}</p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <FileX className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">已取消</p>
              <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
            </div>
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
            <option value="expired">已到期</option>
            <option value="cancelled">已取消</option>
          </select>

          <label className="text-sm text-gray-600 ml-4">每頁：</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="input w-20"
          >
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* 資料表 */}
      <DataTable
        columns={columns}
        data={contracts || []}
        loading={isLoading}
        onRefresh={refetch}
        pageSize={pageSize}
        emptyMessage="沒有已結束的合約"
      />
    </div>
  )
}
