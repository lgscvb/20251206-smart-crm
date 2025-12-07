import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomers, useCreateCustomer, useBranches } from '../hooks/useApi'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge, { StatusBadge } from '../components/Badge'
import { Plus, User, Building, Phone, Mail, MessageSquare } from 'lucide-react'

export default function Customers() {
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data: customers, isLoading, refetch } = useCustomers({
    ...(statusFilter && { status: `eq.${statusFilter}` })
  })
  const { data: branches } = useBranches()
  const createCustomer = useCreateCustomer()

  // 表格欄位
  const columns = [
    {
      header: '客戶',
      accessor: 'name',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-primary-700">
              {row.name?.charAt(0) || '?'}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{row.name}</p>
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
        </div>
      )
    },
    {
      header: '分館',
      accessor: 'branch_name'
    },
    {
      header: '狀態',
      accessor: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'LINE',
      accessor: 'line_user_id',
      cell: (row) =>
        row.line_user_id ? (
          <Badge variant="success" dot>
            已綁定
          </Badge>
        ) : (
          <Badge variant="gray">未綁定</Badge>
        )
    },
    {
      header: '合約',
      accessor: 'active_contracts',
      cell: (row) => (
        <span className="font-medium">
          {row.active_contracts || 0} 份
        </span>
      )
    },
    {
      header: '待繳',
      accessor: 'pending_amount',
      cell: (row) => {
        const pending = row.pending_amount || 0
        const overdue = row.overdue_amount || 0
        return (
          <div className="text-right">
            {pending > 0 && (
              <p className="text-sm text-gray-700">
                ${pending.toLocaleString()}
              </p>
            )}
            {overdue > 0 && (
              <p className="text-xs text-red-600 font-medium">
                逾期 ${overdue.toLocaleString()}
              </p>
            )}
            {pending === 0 && overdue === 0 && (
              <span className="text-gray-400">-</span>
            )}
          </div>
        )
      }
    },
    {
      header: '風險',
      accessor: 'risk_level',
      cell: (row) => <StatusBadge status={row.risk_level || 'normal'} />
    }
  ]

  // 新增客戶表單
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    branch_id: 1,
    line_user_id: '',
    source_channel: 'admin'
  })

  const handleCreate = async () => {
    if (!formData.name) return
    await createCustomer.mutateAsync({
      ...formData,
      branch_id: Number(formData.branch_id)
    })
    setShowCreateModal(false)
    setFormData({
      name: '',
      company_name: '',
      phone: '',
      email: '',
      branch_id: 1,
      line_user_id: '',
      source_channel: 'admin'
    })
  }

  return (
    <div className="space-y-6">
      {/* 篩選區 */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">狀態：</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-32"
            >
              <option value="">全部</option>
              <option value="active">活躍</option>
              <option value="lead">潛在客戶</option>
              <option value="inactive">非活躍</option>
              <option value="churned">流失</option>
            </select>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            新增客戶
          </button>
        </div>
      </div>

      {/* 資料表 */}
      <DataTable
        columns={columns}
        data={customers || []}
        loading={isLoading}
        onRowClick={(row) => navigate(`/customers/${row.id}`)}
        onRefresh={refetch}
        pageSize={15}
        emptyMessage="沒有找到客戶資料"
      />

      {/* 新增客戶 Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="新增客戶"
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowCreateModal(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!formData.name || createCustomer.isPending}
              className="btn-primary"
            >
              {createCustomer.isPending ? '建立中...' : '建立客戶'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                姓名 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="客戶姓名"
                  className="input pl-10"
                />
              </div>
            </div>
            <div>
              <label className="label">公司名稱</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) =>
                    setFormData({ ...formData, company_name: e.target.value })
                  }
                  placeholder="公司名稱（選填）"
                  className="input pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">電話</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="09xx-xxx-xxx"
                  className="input pl-10"
                />
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="email@example.com"
                  className="input pl-10"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                分館 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.branch_id}
                onChange={(e) =>
                  setFormData({ ...formData, branch_id: e.target.value })
                }
                className="input"
              >
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">LINE User ID</label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.line_user_id}
                  onChange={(e) =>
                    setFormData({ ...formData, line_user_id: e.target.value })
                  }
                  placeholder="U1234567890..."
                  className="input pl-10"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
