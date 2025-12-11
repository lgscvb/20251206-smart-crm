import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useCustomerDetail, useUpdateCustomer, useBranches } from '../hooks/useApi'
import Modal from '../components/Modal'
import Badge, { StatusBadge } from '../components/Badge'
import {
  ArrowLeft,
  Edit2,
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  FileText,
  CreditCard,
  Calendar,
  AlertTriangle,
  Save,
  X
} from 'lucide-react'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: result, isLoading, refetch } = useCustomerDetail(id)
  const { data: branches } = useBranches()
  const updateCustomer = useUpdateCustomer()

  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({})

  const customer = result?.data?.customer
  const contracts = result?.data?.contracts || []
  const payments = result?.data?.payments || []
  const statistics = result?.data?.statistics

  const startEditing = () => {
    setFormData({
      name: customer?.name || '',
      company_name: customer?.company_name || '',
      phone: customer?.phone || '',
      email: customer?.email || '',
      address: customer?.address || '',
      line_user_id: customer?.line_user_id || '',
      status: customer?.status || 'active',
      risk_level: customer?.risk_level || 'normal'
    })
    setEditing(true)
  }

  const handleSave = async () => {
    await updateCustomer.mutateAsync({
      customerId: Number(id),
      data: formData
    })
    setEditing(false)
    refetch()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">找不到客戶資料</p>
        <button onClick={() => navigate('/customers')} className="btn-primary mt-4">
          返回客戶列表
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 頂部導覽 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/customers')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          {customer.company_name && (
            <p className="text-gray-500">{customer.company_name}</p>
          )}
        </div>
        <button onClick={startEditing} className="btn-secondary">
          <Edit2 className="w-4 h-4 mr-2" />
          編輯
        </button>
      </div>

      {/* 主要內容 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：客戶資訊 */}
        <div className="space-y-6">
          {/* 基本資料卡 */}
          <div className="card">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {customer.name?.charAt(0)}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={customer.status} />
                  <StatusBadge status={customer.risk_level || 'normal'} />
                </div>
                <p className="text-sm text-gray-500">
                  建立於 {new Date(customer.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span>{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <span>{customer.email}</span>
                </div>
              )}
              {customer.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <span>{customer.address}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-gray-400" />
                {customer.line_user_id ? (
                  <Badge variant="success" dot>
                    LINE 已綁定
                  </Badge>
                ) : (
                  <Badge variant="gray">LINE 未綁定</Badge>
                )}
              </div>
            </div>
          </div>

          {/* 統計資訊 */}
          <div className="card">
            <h3 className="card-title mb-4">繳費統計</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">已付總額</span>
                <span className="font-semibold text-green-600">
                  ${(statistics?.total_paid || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">待繳金額</span>
                <span className="font-semibold text-blue-600">
                  ${(statistics?.pending_amount || 0).toLocaleString()}
                </span>
              </div>
              {statistics?.overdue_count > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>逾期 ({statistics.overdue_count} 筆)</span>
                  <span className="font-semibold">
                    ${(statistics?.overdue_amount || 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右側：合約和繳費記錄 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 合約列表 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-500" />
                合約記錄
              </h3>
              <Badge variant="info">{contracts.length} 份</Badge>
            </div>
            {contracts.length === 0 ? (
              <p className="text-center py-8 text-gray-500">尚無合約</p>
            ) : (
              <div className="space-y-3">
                {contracts.map((contract) => (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{contract.contract_number}</span>
                        <StatusBadge status={contract.status} />
                      </div>
                      <p className="text-sm text-gray-500">
                        {contract.plan_name || contract.contract_type}
                      </p>
                      <p className="text-xs text-gray-400">
                        {contract.start_date} ~ {contract.end_date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ${(contract.monthly_rent || 0).toLocaleString()}/月
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 繳費記錄 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-500" />
                繳費記錄
              </h3>
            </div>
            {payments.length === 0 ? (
              <p className="text-center py-8 text-gray-500">尚無繳費記錄</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>期別</th>
                      <th>金額</th>
                      <th>到期日</th>
                      <th>狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.slice(0, 10).map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.payment_period}</td>
                        <td>${(payment.amount || 0).toLocaleString()}</td>
                        <td>{payment.due_date}</td>
                        <td>
                          <StatusBadge status={payment.payment_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 編輯 Modal */}
      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="編輯客戶資料"
        size="lg"
        footer={
          <>
            <button onClick={() => setEditing(false)} className="btn-secondary">
              <X className="w-4 h-4 mr-2" />
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={updateCustomer.isPending}
              className="btn-primary"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateCustomer.isPending ? '儲存中...' : '儲存'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">姓名</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">公司名稱</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">電話</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div>
            <label className="label">地址</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">LINE User ID</label>
              <input
                type="text"
                value={formData.line_user_id}
                onChange={(e) => setFormData({ ...formData, line_user_id: e.target.value })}
                className="input"
                placeholder="U1234567890..."
              />
            </div>
            <div>
              <label className="label">狀態</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input"
              >
                <option value="lead">潛在客戶</option>
                <option value="active">活躍</option>
                <option value="inactive">非活躍</option>
                <option value="churned">流失</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">風險等級</label>
            <select
              value={formData.risk_level}
              onChange={(e) => setFormData({ ...formData, risk_level: e.target.value })}
              className="input"
            >
              <option value="low">低風險</option>
              <option value="normal">正常</option>
              <option value="medium">中風險</option>
              <option value="high">高風險</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  )
}
