import { useBranchRevenue, useTodayTasks, useOverdueDetails, useRenewalReminders } from '../hooks/useApi'
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
  Clock
} from 'lucide-react'
import StatCard from '../components/StatCard'
import Badge, { StatusBadge } from '../components/Badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: branchRevenue, isLoading: revenueLoading } = useBranchRevenue()
  const { data: todayTasks, isLoading: tasksLoading } = useTodayTasks()
  const { data: overdue, isLoading: overdueLoading } = useOverdueDetails()
  const { data: renewals } = useRenewalReminders()

  // 計算統計
  const stats = branchRevenue?.reduce(
    (acc, branch) => ({
      totalCustomers: acc.totalCustomers + (branch.active_customers || 0),
      totalContracts: acc.totalContracts + (branch.active_contracts || 0),
      monthlyRevenue: acc.monthlyRevenue + (branch.current_month_revenue || 0),
      monthlyPending: acc.monthlyPending + (branch.current_month_pending || 0),
      overdueAmount: acc.overdueAmount + (branch.current_month_overdue || 0)
    }),
    { totalCustomers: 0, totalContracts: 0, monthlyRevenue: 0, monthlyPending: 0, overdueAmount: 0 }
  ) || {}

  // 計算本期應收、實收、未收
  const receivable = (stats.monthlyRevenue || 0) + (stats.monthlyPending || 0) + (stats.overdueAmount || 0)
  const received = stats.monthlyRevenue || 0
  const outstanding = (stats.monthlyPending || 0) + (stats.overdueAmount || 0)

  // 圖表資料
  const chartData = branchRevenue?.map((b) => ({
    name: b.branch_name,
    營收: b.current_month_revenue || 0,
    待收: b.current_month_pending || 0,
    逾期: b.current_month_overdue || 0
  })) || []

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

  return (
    <div className="space-y-6">
      {/* 財務統計卡片 - 最重要 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="本期應收"
          value={`$${receivable.toLocaleString()}`}
          icon={DollarSign}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          loading={revenueLoading}
        />
        <StatCard
          title="本期已收"
          value={`$${received.toLocaleString()}`}
          icon={CheckCircle}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          loading={revenueLoading}
        />
        <StatCard
          title="本期未收"
          value={`$${outstanding.toLocaleString()}`}
          icon={Clock}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          loading={revenueLoading}
        />
        <StatCard
          title="逾期金額"
          value={`$${(stats.overdueAmount || 0).toLocaleString()}`}
          icon={AlertTriangle}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          loading={revenueLoading}
        />
      </div>

      {/* 續約狀態統計 */}
      {renewals?.length > 0 && (
        <div className="card cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/renewals')}>
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              續約追蹤（60天內到期）
            </h3>
            <Badge variant="warning">{renewals.length} 份</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { status: 'none', label: '待處理', color: 'bg-gray-100 text-gray-700' },
              { status: 'notified', label: '待回覆', color: 'bg-blue-100 text-blue-700' },
              { status: 'confirmed', label: '已確認', color: 'bg-purple-100 text-purple-700' },
              { status: 'paid', label: '已收款', color: 'bg-green-100 text-green-700' },
              { status: 'invoiced', label: '已開票', color: 'bg-teal-100 text-teal-700' },
              { status: 'signed', label: '待回簽', color: 'bg-orange-100 text-orange-700' },
              { status: 'completed', label: '完成', color: 'bg-emerald-100 text-emerald-700' }
            ].map(({ status, label, color }) => {
              const count = renewals.filter(r => (r.renewal_status || 'none') === status).length
              return (
                <div key={status} className={`${color} rounded-lg p-3 text-center`}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs">{label}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 圖表區 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 分館營收長條圖 */}
        <div className="lg:col-span-2 card">
          <div className="card-header">
            <h3 className="card-title">分館營收比較</h3>
            <button
              onClick={() => navigate('/reports')}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              查看報表 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="h-72">
            {revenueLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => `$${value.toLocaleString()}`}
                  />
                  <Bar dataKey="營收" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="待收" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="逾期" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

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
                    <span className="text-sm font-semibold text-gray-700">
                      ${task.amount.toLocaleString()}
                    </span>
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
              overdue?.slice(0, 6).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {item.customer_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.branch_name} · {item.payment_period}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">
                      ${(item.total_due || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-red-500">
                      逾期 {item.days_overdue} 天
                    </p>
                  </div>
                </div>
              ))
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
                branchRevenue?.map((branch, i) => (
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
