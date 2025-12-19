import { useState } from 'react'
import { useBranchRevenue, useTodayTasks, useOverdueDetails, useRenewalReminders, usePaymentsDue } from '../hooks/useApi'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  FileText,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Bell,
  ArrowRight,
  Building2,
  DollarSign,
  CheckCircle,
  Clock,
  Zap,
  Send,
  Loader2,
  MessageCircle,
  History,
  Power
} from 'lucide-react'
import { line } from '../services/api'
import StatCard from '../components/StatCard'
import Badge, { StatusBadge } from '../components/Badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']

// ============================================================================
// 續約 Checklist 相關：從時間戳計算狀態
// ============================================================================

function computeFlags(contract) {
  return {
    is_notified: !!contract.renewal_notified_at,
    is_confirmed: !!contract.renewal_confirmed_at,
    is_paid: !!contract.renewal_paid_at,
    is_signed: !!contract.renewal_signed_at,
    is_invoiced: contract.invoice_status && contract.invoice_status !== 'pending_tax_id'
  }
}

function getDisplayStatus(contract) {
  const flags = computeFlags(contract)

  // 檢查是否全部完成
  const allDone = flags.is_notified && flags.is_confirmed &&
    flags.is_paid && flags.is_invoiced && flags.is_signed
  if (allDone) return { stage: 'completed', progress: 5 }

  // 檢查是否尚未開始
  const noneStarted = !flags.is_notified && !flags.is_confirmed &&
    !flags.is_paid && !flags.is_invoiced && !flags.is_signed
  if (noneStarted) return { stage: 'pending', progress: 0 }

  // 進行中
  const progress = [flags.is_notified, flags.is_confirmed, flags.is_paid, flags.is_invoiced, flags.is_signed].filter(Boolean).length
  return { stage: 'in_progress', progress }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: branchRevenue, isLoading: revenueLoading } = useBranchRevenue()
  const { data: todayTasks, isLoading: tasksLoading } = useTodayTasks()
  const { data: overdue, isLoading: overdueLoading, refetch: refetchOverdue } = useOverdueDetails()
  const { data: renewals } = useRenewalReminders()
  const { data: paymentsDue } = usePaymentsDue()

  // 催繳狀態
  const [sendingReminder, setSendingReminder] = useState({})
  const [reminderResult, setReminderResult] = useState({})

  // 自動通知開關
  const [autoNotifyEnabled, setAutoNotifyEnabled] = useState(false)

  // 模擬通知記錄（實際應該從後端 API 取得）
  const [notificationHistory] = useState([
    {
      id: 1,
      type: 'payment_reminder',
      customer: '張小明',
      message: '催繳通知已發送',
      timestamp: '2024-12-19 10:30',
      status: 'success'
    },
    {
      id: 2,
      type: 'renewal_reminder',
      customer: '李大華',
      message: '續約提醒已發送',
      timestamp: '2024-12-19 09:15',
      status: 'success'
    },
    {
      id: 3,
      type: 'payment_reminder',
      customer: '王美玲',
      message: '催繳通知發送失敗',
      timestamp: '2024-12-19 08:45',
      status: 'error'
    }
  ])

  // 發送催繳
  const handleSendReminder = async (item) => {
    const key = `${item.customer_id}-${item.payment_period}`
    setSendingReminder(prev => ({ ...prev, [key]: true }))
    setReminderResult(prev => ({ ...prev, [key]: null }))

    try {
      await line.sendPaymentReminder(
        item.customer_id,
        item.total_due || item.amount,
        item.due_date
      )
      setReminderResult(prev => ({ ...prev, [key]: 'success' }))
      // 3秒後清除成功狀態
      setTimeout(() => {
        setReminderResult(prev => ({ ...prev, [key]: null }))
      }, 3000)
    } catch (error) {
      console.error('催繳失敗:', error)
      setReminderResult(prev => ({ ...prev, [key]: 'error' }))
    } finally {
      setSendingReminder(prev => ({ ...prev, [key]: false }))
    }
  }

  // 計算統計（金額與筆數）
  const branchRevenueArr = Array.isArray(branchRevenue) ? branchRevenue : []
  const stats = branchRevenueArr.reduce(
    (acc, branch) => ({
      totalCustomers: acc.totalCustomers + (branch.active_customers || 0),
      totalContracts: acc.totalContracts + (branch.active_contracts || 0),
      monthlyRevenue: acc.monthlyRevenue + (branch.current_month_revenue || 0),
      monthlyPending: acc.monthlyPending + (branch.current_month_pending || 0),
      overdueAmount: acc.overdueAmount + (branch.current_month_overdue || 0),
      paidCount: acc.paidCount + (branch.current_month_paid_count || 0),
      pendingCount: acc.pendingCount + (branch.current_month_pending_count || 0),
      overdueCount: acc.overdueCount + (branch.current_month_overdue_count || 0)
    }),
    { totalCustomers: 0, totalContracts: 0, monthlyRevenue: 0, monthlyPending: 0, overdueAmount: 0, paidCount: 0, pendingCount: 0, overdueCount: 0 }
  )

  // 計算本期應收、已收、未收（金額與筆數）
  const receivable = (stats.monthlyRevenue || 0) + (stats.monthlyPending || 0) + (stats.overdueAmount || 0)
  const receivableCount = (stats.paidCount || 0) + (stats.pendingCount || 0) + (stats.overdueCount || 0)
  const received = stats.monthlyRevenue || 0
  const receivedCount = stats.paidCount || 0
  const outstanding = (stats.monthlyPending || 0) + (stats.overdueAmount || 0)
  const outstandingCount = (stats.pendingCount || 0) + (stats.overdueCount || 0)

  // 圖表資料
  const chartData = branchRevenueArr.map((b) => ({
    name: b.branch_name,
    營收: b.current_month_revenue || 0,
    待收: b.current_month_pending || 0,
    逾期: b.current_month_overdue || 0
  }))

  const pieData = [
    { name: '已收款', value: received },
    { name: '待收款', value: stats.monthlyPending || 0 },
    { name: '逾期', value: stats.overdueAmount || 0 }
  ].filter(d => d.value > 0)

  const priorityIcon = {
    urgent: '🔴',
    high: '🟠',
    medium: '🟡',
    payment_due: '💰',
    contract_expiring: '📄',
    commission_due: '💼'
  }

  // 當月應催繳列表（待繳 + 逾期）
  const currentMonthDue = Array.isArray(paymentsDue) ? paymentsDue : []

  // 45天內到期的合約
  const upcomingRenewals = Array.isArray(renewals) ? renewals.filter(r => r.days_until_expiry <= 45) : []

  return (
    <div className="space-y-6">
      {/* 自動通知開關 */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Power className={`w-5 h-5 ${autoNotifyEnabled ? 'text-green-500' : 'text-gray-400'}`} />
            <div>
              <h3 className="font-semibold text-gray-900">自動通知系統</h3>
              <p className="text-sm text-gray-500">自動發送繳費提醒與續約通知</p>
            </div>
          </div>
          <button
            onClick={() => setAutoNotifyEnabled(!autoNotifyEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              autoNotifyEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoNotifyEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 財務統計卡片 - 最重要 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="本期應收"
          value={`$${receivable.toLocaleString()}`}
          subtitle={`共 ${receivableCount} 筆`}
          icon={DollarSign}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          loading={revenueLoading}
        />
        <StatCard
          title="本期已收"
          value={`$${received.toLocaleString()}`}
          subtitle={`共 ${receivedCount} 筆`}
          icon={CheckCircle}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          loading={revenueLoading}
        />
        <StatCard
          title="本期未收"
          value={`$${outstanding.toLocaleString()}`}
          subtitle={`共 ${outstandingCount} 筆`}
          icon={Clock}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          loading={revenueLoading}
        />
        <StatCard
          title="逾期金額"
          value={`$${(stats.overdueAmount || 0).toLocaleString()}`}
          subtitle={`共 ${stats.overdueCount || 0} 筆`}
          icon={AlertTriangle}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          loading={revenueLoading}
        />
      </div>

      {/* 續約狀態統計 - 4 階段模式 */}
      {renewals?.length > 0 && (() => {
        // 計算各階段數量
        const stageCounts = renewals.reduce((acc, r) => {
          const status = getDisplayStatus(r)
          acc[status.stage] = (acc[status.stage] || 0) + 1
          // 急件：7 天內到期且未完成
          if (r.days_until_expiry <= 7 && status.stage !== 'completed') {
            acc.urgent = (acc.urgent || 0) + 1
          }
          return acc
        }, { pending: 0, in_progress: 0, completed: 0, urgent: 0 })

        return (
          <div className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/renewals')}>
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-500" />
                續約追蹤（45天內到期）
              </h3>
              <Badge variant="warning">{renewals.length} 份</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 急件 */}
              <div className="bg-red-100 text-red-700 rounded-lg p-3 text-center relative">
                <Zap className="w-4 h-4 absolute top-2 right-2 opacity-50" />
                <div className="text-2xl font-bold">{stageCounts.urgent}</div>
                <div className="text-xs">急件（7天內）</div>
              </div>
              {/* 待處理 */}
              <div className="bg-gray-100 text-gray-700 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{stageCounts.pending}</div>
                <div className="text-xs">待處理</div>
              </div>
              {/* 進行中 */}
              <div className="bg-blue-100 text-blue-700 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{stageCounts.in_progress}</div>
                <div className="text-xs">進行中</div>
              </div>
              {/* 已完成 */}
              <div className="bg-green-100 text-green-700 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{stageCounts.completed}</div>
                <div className="text-xs">已完成</div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 圖表區與新增區塊 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 收款狀態圓餅圖 */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">本月收款狀態</h3>
          </div>
          <div className="h-72">
            {revenueLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 當月應催繳 */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-500" />
              當月應催繳
            </h3>
            <button
              onClick={() => navigate('/payments')}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {currentMonthDue?.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                ✅ 當月無待催繳款項
              </div>
            ) : (
              currentMonthDue?.slice(0, 8).map((item, i) => {
                const key = `${item.customer_id}-${item.payment_period || i}`
                const isSending = sendingReminder[key]
                const result = reminderResult[key]
                const isOverdue = item.payment_status === 'overdue'

                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isOverdue ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.customer_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.branch_name} · {item.payment_period}
                      </p>
                    </div>
                    <div className="text-right mr-3">
                      <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                        ${(item.amount || item.total_due || 0).toLocaleString()}
                      </p>
                      {isOverdue && item.days_overdue && (
                        <p className="text-xs text-red-500">
                          逾期 {item.days_overdue} 天
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSendReminder(item)
                      }}
                      disabled={isSending}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        result === 'success'
                          ? 'bg-green-100 text-green-700'
                          : result === 'error'
                          ? 'bg-red-200 text-red-700'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      }`}
                      title="發送 LINE 催繳通知"
                    >
                      {isSending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : result === 'success' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      {isSending ? '發送中' : result === 'success' ? '已發送' : result === 'error' ? '失敗' : '催繳'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* 續約通知與通知記錄 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 續約通知 */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              續約通知（45天內到期）
            </h3>
            <button
              onClick={() => navigate('/renewals')}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {upcomingRenewals.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                ✅ 無即將到期的合約
              </div>
            ) : (
              upcomingRenewals.slice(0, 8).map((renewal, i) => {
                const isUrgent = renewal.days_until_expiry <= 7
                const status = getDisplayStatus(renewal)

                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isUrgent ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {renewal.customer_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {renewal.branch_name} · {renewal.product_type || '虛擬辦公室'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={isUrgent ? 'danger' : 'warning'}>
                        {renewal.days_until_expiry <= 0
                          ? '已到期'
                          : `${renewal.days_until_expiry} 天後到期`}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        進度 {status.progress}/5
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 通知記錄 */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <History className="w-5 h-5 text-blue-500" />
              通知記錄
            </h3>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {notificationHistory.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                無通知記錄
              </div>
            ) : (
              notificationHistory.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-shrink-0">
                    {record.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : record.status === 'error' ? (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    ) : (
                      <MessageCircle className="w-5 h-5 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {record.customer}
                    </p>
                    <p className="text-xs text-gray-600">
                      {record.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {record.timestamp}
                    </p>
                  </div>
                  <Badge variant={record.status === 'success' ? 'success' : 'danger'}>
                    {record.type === 'payment_reminder' ? '催繳' : '續約'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 下方區塊 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 今日待辦 */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-500" />
              今日待辦
            </h3>
            <Badge variant="info">{todayTasks?.length || 0} 項</Badge>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {tasksLoading ? (
              <div className="py-8 text-center text-gray-500">載入中...</div>
            ) : todayTasks?.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                🎉 今日沒有待辦事項
              </div>
            ) : (
              todayTasks?.slice(0, 8).map((task, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  onClick={() => {
                    if (task.task_type === 'payment_due') navigate('/payments')
                    else if (task.task_type === 'contract_expiring') navigate('/renewals')
                    else if (task.task_type === 'commission_due') navigate('/commissions')
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {priorityIcon[task.priority] || priorityIcon[task.task_type] || '📌'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {task.task_description}
                      </p>
                      <p className="text-xs text-gray-500">{task.branch_name}</p>
                    </div>
                  </div>
                  {task.amount && (
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-700">
                        ${task.amount.toLocaleString()}
                      </span>
                      {task.amountLabel && (
                        <p className="text-xs text-gray-400">{task.amountLabel}</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 逾期款項提醒 */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              逾期款項
            </h3>
            <button
              onClick={() => navigate('/payments')}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {overdueLoading ? (
              <div className="py-8 text-center text-gray-500">載入中...</div>
            ) : overdue?.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                ✅ 沒有逾期款項
              </div>
            ) : (
              overdue?.slice(0, 6).map((item, i) => {
                const key = `${item.customer_id}-${item.payment_period}`
                const isSending = sendingReminder[key]
                const result = reminderResult[key]

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.customer_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.branch_name} · {item.payment_period}
                      </p>
                    </div>
                    <div className="text-right mr-3">
                      <p className="text-sm font-semibold text-red-600">
                        ${(item.total_due || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-red-500">
                        逾期 {item.days_overdue} 天
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSendReminder(item)
                      }}
                      disabled={isSending}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        result === 'success'
                          ? 'bg-green-100 text-green-700'
                          : result === 'error'
                          ? 'bg-red-200 text-red-700'
                          : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      }`}
                      title="發送 LINE 催繳通知"
                    >
                      {isSending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : result === 'success' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      {isSending ? '發送中' : result === 'success' ? '已發送' : result === 'error' ? '失敗' : '催繳'}
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* 分館詳情 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2">
            <Building2 className="w-5 h-5 text-jungle-500" />
            分館營運概況
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>分館</th>
                <th>活躍客戶</th>
                <th>有效合約</th>
                <th>本月營收</th>
                <th>待收款</th>
                <th>逾期</th>
                <th>即將到期</th>
              </tr>
            </thead>
            <tbody>
              {revenueLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    載入中...
                  </td>
                </tr>
              ) : (
                branchRevenueArr.map((branch, i) => (
                  <tr key={i}>
                    <td className="font-medium">{branch.branch_name}</td>
                    <td>{branch.active_customers || 0}</td>
                    <td>{branch.active_contracts || 0}</td>
                    <td className="text-green-600 font-medium">
                      ${(branch.current_month_revenue || 0).toLocaleString()}
                    </td>
                    <td className="text-blue-600">
                      ${(branch.current_month_pending || 0).toLocaleString()}
                    </td>
                    <td className="text-red-600">
                      ${(branch.current_month_overdue || 0).toLocaleString()}
                    </td>
                    <td>
                      {branch.contracts_expiring_30days > 0 ? (
                        <Badge variant="warning">
                          {branch.contracts_expiring_30days} 份
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
