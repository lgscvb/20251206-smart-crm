import { useState } from 'react'
import { useBranchRevenue, useOverdueReport, useCommissionReport, useBranches } from '../hooks/useApi'
import Badge from '../components/Badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Download,
  Calendar
} from 'lucide-react'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

export default function Reports() {
  const [activeReport, setActiveReport] = useState('revenue')
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )

  const { data: branches } = useBranches()
  const { data: branchRevenue, isLoading: revenueLoading } = useBranchRevenue()
  const { data: overdueReport } = useOverdueReport(selectedBranch)
  const { data: commissionReport } = useCommissionReport()

  const reports = [
    { id: 'revenue', name: '營收報表', icon: TrendingUp },
    { id: 'overdue', name: '逾期報表', icon: AlertTriangle },
    { id: 'commission', name: '佣金報表', icon: DollarSign }
  ]

  // 營收圖表資料
  const revenueChartData = branchRevenue?.map((b) => ({
    name: b.branch_name,
    已收款: b.current_month_revenue || 0,
    待收款: b.current_month_pending || 0,
    逾期: b.current_month_overdue || 0
  })) || []

  // 收款狀態圓餅圖
  const totalRevenue = branchRevenue?.reduce((sum, b) => sum + (b.current_month_revenue || 0), 0) || 0
  const totalPending = branchRevenue?.reduce((sum, b) => sum + (b.current_month_pending || 0), 0) || 0
  const totalOverdue = branchRevenue?.reduce((sum, b) => sum + (b.current_month_overdue || 0), 0) || 0

  const pieData = [
    { name: '已收款', value: totalRevenue },
    { name: '待收款', value: totalPending },
    { name: '逾期', value: totalOverdue }
  ].filter(d => d.value > 0)

  // 匯出 CSV
  const exportCSV = (data, filename) => {
    if (!data || data.length === 0) return

    const headers = Object.keys(data[0]).join(',')
    const rows = data
      .map((row) =>
        Object.values(row)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n')

    const csv = `${headers}\n${rows}`
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="space-y-6">
      {/* 報表選擇 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => setActiveReport(report.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeReport === report.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <report.icon className="w-4 h-4" />
              {report.name}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input w-40"
          />
        </div>
      </div>

      {/* 營收報表 */}
      {activeReport === 'revenue' && (
        <div className="space-y-6">
          {/* 摘要卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">本月已收款</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                ${totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">待收款</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                ${totalPending.toLocaleString()}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">逾期金額</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                ${totalOverdue.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 圖表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">分館營收比較</h3>
                <button
                  onClick={() => exportCSV(branchRevenue, 'revenue_report')}
                  className="btn-ghost text-sm"
                >
                  <Download className="w-4 h-4 mr-1" />
                  匯出
                </button>
              </div>
              <div className="h-80">
                {revenueLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueChartData}>
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
                      <Bar dataKey="已收款" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="待收款" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="逾期" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title">收款狀態分布</h3>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 詳細表格 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">分館詳細數據</h3>
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
                    <th>30天內到期</th>
                  </tr>
                </thead>
                <tbody>
                  {branchRevenue?.map((branch, i) => (
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
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 逾期報表 */}
      {activeReport === 'overdue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">逾期筆數</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {overdueReport?.data?.total_count || 0}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">逾期總額</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                ${(overdueReport?.data?.total_amount || 0).toLocaleString()}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">平均逾期天數</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">
                {Math.round(overdueReport?.data?.avg_days_overdue || 0)} 天
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">逾期清單</h3>
              <button
                onClick={() =>
                  exportCSV(overdueReport?.data?.items, 'overdue_report')
                }
                className="btn-ghost text-sm"
              >
                <Download className="w-4 h-4 mr-1" />
                匯出
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>客戶</th>
                    <th>分館</th>
                    <th>應繳金額</th>
                    <th>逾期天數</th>
                    <th>嚴重度</th>
                    <th>聯絡電話</th>
                  </tr>
                </thead>
                <tbody>
                  {overdueReport?.data?.items?.length > 0 ? (
                    overdueReport.data.items.map((item, i) => (
                      <tr key={i}>
                        <td>
                          <div>
                            <p className="font-medium">{item.customer_name}</p>
                            {item.company_name && (
                              <p className="text-xs text-gray-500">
                                {item.company_name}
                              </p>
                            )}
                          </div>
                        </td>
                        <td>{item.branch_name}</td>
                        <td className="font-medium text-red-600">
                          ${(item.total_due || 0).toLocaleString()}
                        </td>
                        <td>
                          <Badge
                            variant={item.days_overdue > 30 ? 'danger' : 'warning'}
                          >
                            {item.days_overdue} 天
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            variant={
                              item.overdue_level === 'severe'
                                ? 'danger'
                                : item.overdue_level === 'high'
                                ? 'warning'
                                : 'gray'
                            }
                          >
                            {item.overdue_level}
                          </Badge>
                        </td>
                        <td>{item.phone || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        ✅ 沒有逾期款項
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 佣金報表 */}
      {activeReport === 'commission' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">待付佣金總額</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                ${(commissionReport?.data?.total_pending || 0).toLocaleString()}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">可付款總額</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                ${(commissionReport?.data?.total_eligible || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">佣金明細</h3>
              <button
                onClick={() =>
                  exportCSV(commissionReport?.data?.items, 'commission_report')
                }
                className="btn-ghost text-sm"
              >
                <Download className="w-4 h-4 mr-1" />
                匯出
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>事務所</th>
                    <th>客戶</th>
                    <th>合約編號</th>
                    <th>佣金金額</th>
                    <th>狀態</th>
                    <th>可付款日</th>
                  </tr>
                </thead>
                <tbody>
                  {commissionReport?.data?.items?.length > 0 ? (
                    commissionReport.data.items.map((item, i) => (
                      <tr key={i}>
                        <td className="font-medium">
                          {item.firm_short_name || item.firm_name}
                        </td>
                        <td>{item.customer_name}</td>
                        <td className="text-primary-600">
                          {item.contract_number}
                        </td>
                        <td className="font-medium text-green-600">
                          ${(item.commission_amount || 0).toLocaleString()}
                        </td>
                        <td>
                          <Badge
                            variant={
                              item.commission_status === 'eligible'
                                ? 'success'
                                : item.commission_status === 'paid'
                                ? 'gray'
                                : 'warning'
                            }
                          >
                            {item.commission_status === 'eligible'
                              ? '可付款'
                              : item.commission_status === 'paid'
                              ? '已付款'
                              : '待審核'}
                          </Badge>
                        </td>
                        <td>{item.eligible_date}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        沒有佣金記錄
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
