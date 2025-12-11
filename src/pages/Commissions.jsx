import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCommissions } from '../hooks/useApi'
import { callTool } from '../services/api'
import useStore from '../store/useStore'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge, { StatusBadge } from '../components/Badge'
import {
  DollarSign,
  CheckCircle,
  Clock,
  Building2,
  Calendar,
  CreditCard,
  AlertCircle,
  Loader2
} from 'lucide-react'

export default function Commissions() {
  const [statusFilter, setStatusFilter] = useState('')
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedCommission, setSelectedCommission] = useState(null)
  const [paymentForm, setPaymentForm] = useState({
    payment_method: 'transfer',
    reference: ''
  })

  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  const { data: commissions, isLoading, refetch } = useCommissions({
    ...(statusFilter && { commission_status: `eq.${statusFilter}` })
  })

  // 佣金付款 mutation
  const payCommission = useMutation({
    mutationFn: async ({ commissionId, paymentMethod, reference }) => {
      return callTool('commission_pay', {
        commission_id: commissionId,
        payment_method: paymentMethod,
        reference: reference || null
      })
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['commissions'] })
        addNotification({ type: 'success', message: '佣金付款成功' })
        setShowPayModal(false)
        setSelectedCommission(null)
        setPaymentForm({ payment_method: 'transfer', reference: '' })
      } else {
        addNotification({ type: 'error', message: data.message || '付款失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `付款失敗: ${error.message}` })
    }
  })

  const handlePayCommission = () => {
    if (!selectedCommission) return

    // 驗證
    if (paymentForm.payment_method === 'transfer' && !paymentForm.reference) {
      addNotification({ type: 'error', message: '請輸入轉帳帳號後五碼' })
      return
    }

    payCommission.mutate({
      commissionId: selectedCommission.id,
      paymentMethod: paymentForm.payment_method,
      reference: paymentForm.reference
    })
  }

  // 統計
  const commissionsArr = Array.isArray(commissions) ? commissions : []
  const stats = {
    pending: commissionsArr.filter((c) => c.commission_status === 'pending'),
    eligible: commissionsArr.filter((c) => c.commission_status === 'eligible'),
    paid: commissionsArr.filter((c) => c.commission_status === 'paid')
  }

  const totalPending = stats.pending.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
  const totalEligible = stats.eligible.reduce((sum, c) => sum + (c.commission_amount || 0), 0)
  const totalPaid = stats.paid.reduce((sum, c) => sum + (c.commission_amount || 0), 0)

  const columns = [
    {
      header: '事務所',
      accessor: 'firm_name',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Building2 className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="font-medium">{row.firm_short_name || row.firm_name}</p>
            {row.firm_contact && (
              <p className="text-xs text-gray-500">{row.firm_contact}</p>
            )}
          </div>
        </div>
      )
    },
    {
      header: '客戶',
      accessor: 'customer_name',
      cell: (row) => (
        <div>
          <p className="font-medium">{row.customer_name}</p>
          {row.company_name && (
            <p className="text-xs text-gray-500">{row.company_name}</p>
          )}
        </div>
      )
    },
    {
      header: '合約',
      accessor: 'contract_number',
      cell: (row) => (
        <span className="text-primary-600 font-medium">{row.contract_number}</span>
      )
    },
    {
      header: '分館',
      accessor: 'branch_name'
    },
    {
      header: '佣金',
      accessor: 'commission_amount',
      cell: (row) => (
        <span className="font-semibold text-green-600">
          ${(row.commission_amount || 0).toLocaleString()}
        </span>
      )
    },
    {
      header: '月租基準',
      accessor: 'monthly_rent',
      cell: (row) => (
        <span className="text-gray-600">
          ${(row.monthly_rent || 0).toLocaleString()}
        </span>
      )
    },
    {
      header: '合約開始',
      accessor: 'contract_start_date',
      cell: (row) => (
        <div className="text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {row.contract_start_date}
          </div>
        </div>
      )
    },
    {
      header: '可付款日',
      accessor: 'eligible_date',
      cell: (row) => (
        <div>
          <p className="text-sm">{row.eligible_date}</p>
          {row.is_eligible_now ? (
            <Badge variant="success" className="mt-1">已達條件</Badge>
          ) : (
            <Badge variant="gray" className="mt-1">
              還需 {row.days_until_eligible} 天
            </Badge>
          )}
        </div>
      )
    },
    {
      header: '狀態',
      accessor: 'commission_status',
      cell: (row) => <StatusBadge status={row.commission_status} />
    },
    {
      header: '操作',
      sortable: false,
      cell: (row) => (
        <div>
          {row.commission_status === 'eligible' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedCommission(row)
                setShowPayModal(true)
              }}
              className="btn-success text-xs py-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5 mr-1" />
              確認付款
            </button>
          )}
          {row.commission_status === 'pending' && !row.is_eligible_now && (
            <span className="text-xs text-gray-400">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              等待中
            </span>
          )}
          {row.commission_status === 'paid' && (
            <span className="text-xs text-green-600">
              <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
              已付款
            </span>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">待審核佣金</p>
              <p className="text-2xl font-bold text-yellow-600">
                ${totalPending.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">{stats.pending.length} 筆</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-xl">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">可付款佣金</p>
              <p className="text-2xl font-bold text-green-600">
                ${totalEligible.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">{stats.eligible.length} 筆</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-gray-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">已付款佣金</p>
              <p className="text-2xl font-bold text-gray-600">
                ${totalPaid.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">{stats.paid.length} 筆</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-xl">
              <CheckCircle className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 可付款提醒 */}
      {stats.eligible.length > 0 && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-700">
              有 {stats.eligible.length} 筆佣金可付款
            </h3>
          </div>
          <p className="text-sm text-green-600">
            總金額：${totalEligible.toLocaleString()}
          </p>
        </div>
      )}

      {/* 篩選 */}
      <div className="card">
        <div className="flex items-center gap-4">
          <label htmlFor="commission-status-filter" className="text-sm text-gray-600">狀態：</label>
          <select
            id="commission-status-filter"
            name="commission-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-32"
          >
            <option value="">全部</option>
            <option value="pending">待審核</option>
            <option value="eligible">可付款</option>
            <option value="paid">已付款</option>
          </select>
        </div>
      </div>

      {/* 資料表 */}
      <DataTable
        columns={columns}
        data={commissions || []}
        loading={isLoading}
        onRefresh={refetch}
        pageSize={15}
        emptyMessage="沒有佣金記錄"
      />

      {/* 付款確認 Modal */}
      <Modal
        open={showPayModal}
        onClose={() => {
          setShowPayModal(false)
          setSelectedCommission(null)
          setPaymentForm({ payment_method: 'transfer', reference: '' })
        }}
        title="確認佣金付款"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setShowPayModal(false)
                setSelectedCommission(null)
                setPaymentForm({ payment_method: 'transfer', reference: '' })
              }}
              className="btn-secondary"
              disabled={payCommission.isPending}
            >
              取消
            </button>
            <button
              onClick={handlePayCommission}
              className="btn-success"
              disabled={payCommission.isPending}
            >
              {payCommission.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  處理中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  確認付款
                </>
              )}
            </button>
          </>
        }
      >
        {selectedCommission && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">
                    {selectedCommission.firm_short_name || selectedCommission.firm_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedCommission.firm_contact}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">客戶</span>
                  <span>{selectedCommission.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">合約</span>
                  <span>{selectedCommission.contract_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">月租基準</span>
                  <span>${(selectedCommission.monthly_rent || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-gray-600 mb-1">佣金金額</p>
              <p className="text-2xl font-bold text-green-600">
                ${(selectedCommission.commission_amount || 0).toLocaleString()}
              </p>
            </div>

            <div>
              <label htmlFor="commission-payment-method" className="label">
                付款方式 <span className="text-red-500">*</span>
              </label>
              <select
                id="commission-payment-method"
                name="payment_method"
                className="input"
                value={paymentForm.payment_method}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_method: e.target.value }))}
              >
                <option value="transfer">銀行轉帳</option>
                <option value="check">支票</option>
                <option value="cash">現金</option>
              </select>
            </div>

            <div>
              <label htmlFor="commission-reference" className="label">
                {paymentForm.payment_method === 'transfer' ? '轉帳後五碼' :
                 paymentForm.payment_method === 'check' ? '支票號碼' : '備註'}
                {paymentForm.payment_method === 'transfer' && <span className="text-red-500"> *</span>}
              </label>
              <input
                id="commission-reference"
                name="reference"
                type="text"
                placeholder={
                  paymentForm.payment_method === 'transfer' ? '請輸入轉帳帳號後五碼' :
                  paymentForm.payment_method === 'check' ? '請輸入支票號碼' : '選填'
                }
                className="input"
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
