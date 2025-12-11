import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomers, useCreateCustomer, useBranches } from '../hooks/useApi'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge, { StatusBadge } from '../components/Badge'
import { Plus, User, Building, Phone, Mail, MessageSquare, UserX, Settings2, ChevronDown } from 'lucide-react'

// 可選欄位定義
const OPTIONAL_COLUMNS = {
  branch_name: { label: '分館', default: false },
  active_contracts: { label: '合約', default: true },
  pending_amount: { label: '待繳', default: true },
  line_user_id: { label: 'LINE', default: true },
  risk_level: { label: '風險', default: false },
  status: { label: '狀態', default: true },
  phone: { label: '電話', default: true }
}

export default function Customers() {
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [pageSize, setPageSize] = useState(15)
  const [showColumnPicker, setShowColumnPicker] = useState(false)

  // 初始化欄位顯示狀態
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const initial = {}
    Object.entries(OPTIONAL_COLUMNS).forEach(([key, { default: def }]) => {
      initial[key] = def
    })
    return initial
  })

  const { data: customers, isLoading, refetch } = useCustomers({
    // 預設排除流失客戶，除非選擇特定狀態
    status: statusFilter ? `eq.${statusFilter}` : 'neq.churned'
  })
  const { data: branches } = useBranches()
  const createCustomer = useCreateCustomer()

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
      key: 'name',
      header: '客戶',
      accessor: 'name',
      fixed: true,
      cell: (row) => (
        <div>
          <p className="font-medium text-gray-900">{row.name}</p>
          {row.company_name && (
            <p className="text-xs text-gray-500 truncate max-w-[150px]">{row.company_name}</p>
          )}
        </div>
      )
    },
    {
      key: 'branch_name',
      header: '分館',
      accessor: 'branch_name'
    },
    {
      key: 'active_contracts',
      header: '合約',
      accessor: 'active_contracts',
      cell: (row) => (
        <span className="font-medium">
          {row.active_contracts || 0} 份
        </span>
      )
    },
    {
      key: 'pending_amount',
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
      key: 'line_user_id',
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
      key: 'risk_level',
      header: '風險',
      accessor: 'risk_level',
      cell: (row) => <StatusBadge status={row.risk_level || 'normal'} />
    },
    {
      key: 'status',
      header: '狀態',
      accessor: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      key: 'phone',
      header: '電話',
      accessor: 'phone',
      cell: (row) => (
        <div className="text-sm text-gray-600">
          {row.phone || <span className="text-gray-400">-</span>}
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
              className="input w-40"
            >
              <option value="">全部（不含流失）</option>
              <option value="active">活躍</option>
              <option value="lead">潛在客戶</option>
              <option value="inactive">非活躍</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">每頁：</label>
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
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 p-2 min-w-[120px]">
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
            onClick={() => navigate('/customers/churned')}
            className="btn-secondary"
          >
            <UserX className="w-4 h-4 mr-2" />
            流失客戶
          </button>

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
        pageSize={pageSize}
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
