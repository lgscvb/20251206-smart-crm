import { useState } from 'react'
import { useRenewalReminders, useSendRenewalReminder } from '../hooks/useApi'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge, { StatusBadge } from '../components/Badge'
import {
  Bell,
  Calendar,
  Send,
  Phone,
  Mail,
  MessageSquare,
  AlertTriangle
} from 'lucide-react'

export default function Renewals() {
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [selectedContract, setSelectedContract] = useState(null)

  const { data: renewals, isLoading, refetch } = useRenewalReminders()
  const sendReminder = useSendRenewalReminder()

  const handleSendReminder = async () => {
    if (!selectedContract) return
    await sendReminder.mutateAsync({
      contractId: selectedContract.contract_id,
      daysRemaining: selectedContract.days_remaining
    })
    setShowReminderModal(false)
    setSelectedContract(null)
  }

  // 分組
  const urgent = renewals?.filter((r) => r.priority === 'urgent') || []
  const high = renewals?.filter((r) => r.priority === 'high') || []
  const medium = renewals?.filter((r) => r.priority === 'medium') || []
  const low = renewals?.filter((r) => r.priority === 'low') || []

  const columns = [
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
      header: '分館',
      accessor: 'branch_name'
    },
    {
      header: '合約',
      accessor: 'contract_number',
      cell: (row) => (
        <div>
          <p className="font-medium text-primary-600">{row.contract_number}</p>
          <p className="text-xs text-gray-500">{row.plan_name || row.contract_type}</p>
        </div>
      )
    },
    {
      header: '到期日',
      accessor: 'end_date',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          {row.end_date}
        </div>
      )
    },
    {
      header: '剩餘天數',
      accessor: 'days_remaining',
      cell: (row) => {
        const days = row.days_remaining
        let variant = 'gray'
        if (days <= 7) variant = 'danger'
        else if (days <= 30) variant = 'warning'
        else if (days <= 60) variant = 'info'

        return (
          <Badge variant={variant}>
            {days} 天
          </Badge>
        )
      }
    },
    {
      header: '月租',
      accessor: 'monthly_rent',
      cell: (row) => (
        <span className="font-medium">${(row.monthly_rent || 0).toLocaleString()}</span>
      )
    },
    {
      header: '聯絡',
      accessor: 'customer_phone',
      cell: (row) => (
        <div className="space-y-1">
          {row.customer_phone && (
            <div className="flex items-center gap-1 text-sm">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              {row.customer_phone}
            </div>
          )}
          {row.customer_email && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Mail className="w-3.5 h-3.5" />
              {row.customer_email}
            </div>
          )}
          {row.line_user_id && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs text-green-600">LINE</span>
            </div>
          )}
        </div>
      )
    },
    {
      header: '操作',
      sortable: false,
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.line_user_id ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedContract(row)
                setShowReminderModal(true)
              }}
              className="btn-primary text-xs py-1.5"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              發送提醒
            </button>
          ) : (
            <span className="text-xs text-gray-400">無 LINE</span>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* 統計卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{urgent.length}</p>
              <p className="text-sm text-gray-500">緊急 (7天內)</p>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-orange-500">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Bell className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{high.length}</p>
              <p className="text-sm text-gray-500">重要 (30天內)</p>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{medium.length}</p>
              <p className="text-sm text-gray-500">一般 (60天內)</p>
            </div>
          </div>
        </div>
        <div className="card border-l-4 border-gray-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Calendar className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{low.length}</p>
              <p className="text-sm text-gray-500">90天內</p>
            </div>
          </div>
        </div>
      </div>

      {/* 緊急提醒區塊 */}
      {urgent.length > 0 && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-700">緊急：7天內到期</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {urgent.map((item) => (
              <div
                key={item.contract_id}
                className="p-4 bg-white rounded-lg border border-red-200 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{item.customer_name}</p>
                    <p className="text-sm text-gray-500">{item.branch_name}</p>
                  </div>
                  <Badge variant="danger">{item.days_remaining} 天</Badge>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-600">
                    到期日：{item.end_date}
                  </p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    月租：${(item.monthly_rent || 0).toLocaleString()}
                  </p>
                </div>
                {item.line_user_id && (
                  <button
                    onClick={() => {
                      setSelectedContract(item)
                      setShowReminderModal(true)
                    }}
                    className="btn-primary w-full mt-3 text-sm"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    發送續約提醒
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 全部列表 */}
      <DataTable
        columns={columns}
        data={renewals || []}
        loading={isLoading}
        onRefresh={refetch}
        pageSize={15}
        emptyMessage="🎉 未來 90 天沒有合約到期"
      />

      {/* 發送提醒 Modal */}
      <Modal
        open={showReminderModal}
        onClose={() => {
          setShowReminderModal(false)
          setSelectedContract(null)
        }}
        title="發送 LINE 續約提醒"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowReminderModal(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              onClick={handleSendReminder}
              disabled={sendReminder.isPending}
              className="btn-primary"
            >
              <Send className="w-4 h-4 mr-2" />
              {sendReminder.isPending ? '發送中...' : '發送提醒'}
            </button>
          </>
        }
      >
        {selectedContract && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <p className="font-medium">{selectedContract.customer_name}</p>
              <p className="text-sm text-gray-600">
                合約 {selectedContract.contract_number}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant={selectedContract.days_remaining <= 7 ? 'danger' : 'warning'}>
                  剩餘 {selectedContract.days_remaining} 天
                </Badge>
                <span className="text-sm text-gray-500">
                  到期日：{selectedContract.end_date}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">提醒內容預覽：</p>
              <p className="mt-2 text-sm">
                您好，您的合約將於{' '}
                <span className="font-semibold">{selectedContract.end_date}</span>{' '}
                到期，剩餘{' '}
                <span className="font-semibold">{selectedContract.days_remaining}</span>{' '}
                天。如需續約請與我們聯繫，謝謝！
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
