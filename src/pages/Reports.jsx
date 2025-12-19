import { useState, useMemo } from 'react'
import { useBranchRevenue, useOverdueReport, useCommissionReport, useBranches, useCustomers, useContracts, useRenewalReminders, useCompanyMonthlyRevenue, useCompanyQuarterlyRevenue, useCompanyYearlyRevenue, useMonthlyRevenue, useQuarterlyRevenue, useYearlyRevenue } from '../hooks/useApi'
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
  Cell,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
  RadialBarChart,
  RadialBar
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  Download,
  Calendar,
  Users,
  FileText,
  PieChart as PieChartIcon,
  Activity
} from 'lucide-react'

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

export default function Reports() {
  const [activeReport, setActiveReport] = useState('revenue')
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [timePeriod, setTimePeriod] = useState('month') // month, quarter, year
  const [selectedPeriod, setSelectedPeriod] = useState(null) // 選擇的特定期間

  const { data: branches } = useBranches()
  const { data: branchRevenue, isLoading: revenueLoading } = useBranchRevenue()
  const { data: overdueReport } = useOverdueReport(selectedBranch)
  const { data: commissionReport } = useCommissionReport()
  const { data: customers } = useCustomers({ limit: 500 })
  const { data: contracts } = useContracts({ limit: 500 })
  const { data: renewals } = useRenewalReminders()

  // 歷史營收數據（公司合計）
  const { data: monthlyRevenue, isLoading: monthlyLoading } = useCompanyMonthlyRevenue()
  const { data: quarterlyRevenue, isLoading: quarterlyLoading } = useCompanyQuarterlyRevenue()
  const { data: yearlyRevenue, isLoading: yearlyLoading } = useCompanyYearlyRevenue()

  // 歷史營收數據（分館明細）
  const { data: branchMonthlyRevenue } = useMonthlyRevenue()
  const { data: branchQuarterlyRevenue } = useQuarterlyRevenue()
  const { data: branchYearlyRevenue } = useYearlyRevenue()

  const reports = [
    { id: 'revenue', name: '營收報表', icon: TrendingUp },
    { id: 'trend', name: '趨勢分析', icon: Activity },
    { id: 'financial', name: '財務分析', icon: DollarSign },
    { id: 'customer', name: '客戶分析', icon: Users },
    { id: 'contract', name: '合約分析', icon: FileText },
    { id: 'overdue', name: '逾期報表', icon: AlertTriangle },
    { id: 'commission', name: '佣金報表', icon: PieChartIcon }
  ]

  // 根據時間區間選擇數據
  const trendData = useMemo(() => {
    if (timePeriod === 'quarter') return quarterlyRevenue || []
    if (timePeriod === 'year') return yearlyRevenue || []
    return monthlyRevenue || []
  }, [timePeriod, monthlyRevenue, quarterlyRevenue, yearlyRevenue])

  const trendLoading = timePeriod === 'quarter' ? quarterlyLoading : timePeriod === 'year' ? yearlyLoading : monthlyLoading

  // 圖表數據（反轉顯示順序，最舊的在左邊）
  const trendChartData = useMemo(() => {
    return [...(trendData || [])].reverse().slice(-12).map(d => ({
      period: d.period,
      營收: d.revenue || 0,
      應收: d.total_due || 0
    }))
  }, [trendData])

  // 當期數據
  const currentPeriodData = trendData?.[0] || {}
  const prevPeriodRevenue = timePeriod === 'quarter'
    ? currentPeriodData.prev_quarter_revenue
    : timePeriod === 'year'
    ? currentPeriodData.prev_year_revenue
    : currentPeriodData.prev_month_revenue

  const periodChange = timePeriod === 'quarter'
    ? currentPeriodData.qoq_change
    : timePeriod === 'year'
    ? currentPeriodData.yoy_change
    : currentPeriodData.mom_change

  const yoyChange = currentPeriodData.yoy_change

  // 可選擇的期間列表
  const availablePeriods = useMemo(() => {
    if (timePeriod === 'quarter') return quarterlyRevenue?.map(d => d.period) || []
    if (timePeriod === 'year') return yearlyRevenue?.map(d => String(d.year)) || []
    return monthlyRevenue?.map(d => d.period) || []
  }, [timePeriod, monthlyRevenue, quarterlyRevenue, yearlyRevenue])

  // 當前選擇的期間（預設最新）
  const activePeriod = selectedPeriod || availablePeriods[0]

  // 根據選擇期間的分館營收數據
  const branchRevenueData = useMemo(() => {
    if (timePeriod === 'quarter') {
      return branchQuarterlyRevenue?.filter(d => d.period === activePeriod) || []
    }
    if (timePeriod === 'year') {
      return branchYearlyRevenue?.filter(d => String(d.year) === activePeriod) || []
    }
    return branchMonthlyRevenue?.filter(d => d.period === activePeriod) || []
  }, [timePeriod, activePeriod, branchMonthlyRevenue, branchQuarterlyRevenue, branchYearlyRevenue])

  // 選擇期間的合計數據
  const selectedPeriodData = useMemo(() => {
    if (timePeriod === 'quarter') {
      return quarterlyRevenue?.find(d => d.period === activePeriod)
    }
    if (timePeriod === 'year') {
      return yearlyRevenue?.find(d => String(d.year) === activePeriod)
    }
    return monthlyRevenue?.find(d => d.period === activePeriod)
  }, [timePeriod, activePeriod, monthlyRevenue, quarterlyRevenue, yearlyRevenue])

  // 營收圖表資料（使用選擇期間的數據）
  const branchRevenueArr = Array.isArray(branchRevenueData) ? branchRevenueData : []
  const revenueChartData = branchRevenueArr.map((b) => ({
    name: b.branch_name,
    已收款: b.revenue || 0,
    待收款: b.pending || 0,
    逾期: b.overdue || 0
  }))

  // 收款狀態圓餅圖（使用選擇期間的數據）
  const totalRevenue = branchRevenueArr.reduce((sum, b) => sum + (b.revenue || 0), 0)
  const totalPending = branchRevenueArr.reduce((sum, b) => sum + (b.pending || 0), 0)
  const totalOverdue = branchRevenueArr.reduce((sum, b) => sum + (b.overdue || 0), 0)
  const totalReceivable = selectedPeriodData?.total_due || (totalRevenue + totalPending + totalOverdue)

  const pieData = [
    { name: '已收款', value: totalRevenue },
    { name: '待收款', value: totalPending },
    { name: '逾期', value: totalOverdue }
  ].filter(d => d.value > 0)

  // 收款率數據（用於儀表板）
  const collectionRate = totalReceivable > 0 ? Math.round((totalRevenue / totalReceivable) * 100) : 0
  const collectionRateData = [
    { name: '收款率', value: collectionRate, fill: '#22c55e' }
  ]

  // 分館收款率對比（根據選擇期間）
  const branchCollectionData = useMemo(() => {
    const arr = Array.isArray(branchRevenueData) ? branchRevenueData : []
    return arr.map((b) => {
      const rate = b.collection_rate || 0
      return {
        name: b.branch_name,
        收款率: rate,
        fill: rate >= 80 ? '#22c55e' : rate >= 60 ? '#f59e0b' : '#ef4444'
      }
    })
  }, [branchRevenueData])

  // 客戶類型分佈
  const customerTypeData = useMemo(() => {
    const customersArr = Array.isArray(customers) ? customers : []
    if (customersArr.length === 0) return []
    const types = customersArr.reduce((acc, c) => {
      let type = '個人戶'
      if (c.customer_type === 'company') type = '公司戶'
      else if (c.customer_type === 'sole_proprietorship') type = '行號'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})
    return Object.entries(types).map(([name, value]) => ({ name, value }))
  }, [customers])

  // 客戶來源分佈
  const customerSourceData = useMemo(() => {
    const customersArr = Array.isArray(customers) ? customers : []
    if (customersArr.length === 0) return []
    const sources = customersArr.reduce((acc, c) => {
      const source = c.source_channel || '直接來訪'
      acc[source] = (acc[source] || 0) + 1
      return acc
    }, {})
    return Object.entries(sources)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [customers])

  // 客戶狀態分佈
  const customerStatusData = useMemo(() => {
    const customersArr = Array.isArray(customers) ? customers : []
    if (customersArr.length === 0) return []
    const statuses = customersArr.reduce((acc, c) => {
      const status = c.status === 'active' ? '活躍' : c.status === 'inactive' ? '休眠' : c.status === 'prospect' ? '潛客' : '其他'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})
    return Object.entries(statuses).map(([name, value]) => ({ name, value }))
  }, [customers])

  // 分館客戶分佈
  const branchCustomerData = useMemo(() => {
    const arr = Array.isArray(branchRevenue) ? branchRevenue : []
    return arr.map((b) => ({
      name: b.branch_name,
      活躍客戶: b.active_customers || 0,
      有效合約: b.active_contracts || 0
    }))
  }, [branchRevenue])

  // 合約週期分佈
  const CYCLE_LABELS = {
    monthly: '月繳',
    quarterly: '季繳',
    semi_annual: '半年繳',
    annual: '年繳'
  }
  const contractCycleData = useMemo(() => {
    const contractsArr = Array.isArray(contracts) ? contracts : []
    if (contractsArr.length === 0) return []
    // 只統計有效合約
    const activeContracts = contractsArr.filter(c => c.status === 'active')
    const cycles = activeContracts.reduce((acc, c) => {
      const cycle = c.payment_cycle || 'monthly'
      const label = CYCLE_LABELS[cycle] || cycle
      acc[label] = (acc[label] || 0) + 1
      return acc
    }, {})
    return Object.entries(cycles).map(([name, value]) => ({ name, value }))
  }, [contracts])

  // 合約到期分佈
  const contractExpiryData = useMemo(() => {
    const renewalsArr = Array.isArray(renewals) ? renewals : []
    if (renewalsArr.length === 0) return []
    const ranges = {
      '7天內': 0,
      '8-14天': 0,
      '15-30天': 0,
      '31-45天': 0
    }
    renewalsArr.forEach((r) => {
      const days = r.days_until_expiry || r.days_remaining || 0
      if (days <= 7) ranges['7天內']++
      else if (days <= 14) ranges['8-14天']++
      else if (days <= 30) ranges['15-30天']++
      else ranges['31-45天']++
    })
    return Object.entries(ranges).map(([name, value]) => ({ name, value }))
  }, [renewals])

  // 逾期天數分佈
  const overdueDistributionData = useMemo(() => {
    const items = overdueReport?.data?.items || []
    const ranges = {
      '1-7天': 0,
      '8-14天': 0,
      '15-30天': 0,
      '31-60天': 0,
      '60天以上': 0
    }
    items.forEach((item) => {
      const days = item.days_overdue || 0
      if (days <= 7) ranges['1-7天']++
      else if (days <= 14) ranges['8-14天']++
      else if (days <= 30) ranges['15-30天']++
      else if (days <= 60) ranges['31-60天']++
      else ranges['60天以上']++
    })
    return Object.entries(ranges).map(([name, value]) => ({ name, value }))
  }, [overdueReport])

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
        <div className="flex flex-wrap gap-2">
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

        <div className="flex items-center gap-4">
          {/* 時間區間選擇器 - 營收相關報表都顯示 */}
          {['revenue', 'trend', 'financial', 'overdue', 'commission'].includes(activeReport) && (
            <>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                {[
                  { value: 'month', label: '月' },
                  { value: 'quarter', label: '季' },
                  { value: 'year', label: '年' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setTimePeriod(option.value)
                      setSelectedPeriod(null) // 切換時間區間時重置選擇
                    }}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      timePeriod === option.value
                        ? 'bg-white text-primary-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* 期間選擇下拉 */}
              <select
                id="report-period-selector"
                name="report-period"
                aria-label="選擇報表期間"
                value={activePeriod || ''}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="input text-sm w-32"
              >
                {availablePeriods.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>

              {/* YoY/MoM/QoQ 變化指標 */}
              {selectedPeriodData && (
                <div className="flex items-center gap-2">
                  {timePeriod === 'month' && selectedPeriodData.mom_change !== null && (
                    <Badge variant={selectedPeriodData.mom_change >= 0 ? 'success' : 'danger'}>
                      MoM {selectedPeriodData.mom_change >= 0 ? '+' : ''}{selectedPeriodData.mom_change?.toFixed(1)}%
                    </Badge>
                  )}
                  {timePeriod === 'quarter' && selectedPeriodData.qoq_change !== null && (
                    <Badge variant={selectedPeriodData.qoq_change >= 0 ? 'success' : 'danger'}>
                      QoQ {selectedPeriodData.qoq_change >= 0 ? '+' : ''}{selectedPeriodData.qoq_change?.toFixed(1)}%
                    </Badge>
                  )}
                  {selectedPeriodData.yoy_change !== null && (
                    <Badge variant={selectedPeriodData.yoy_change >= 0 ? 'success' : 'danger'}>
                      YoY {selectedPeriodData.yoy_change >= 0 ? '+' : ''}{selectedPeriodData.yoy_change?.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 營收報表 */}
      {activeReport === 'revenue' && (
        <div className="space-y-6">
          {/* 期間標題 */}
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-800">
              {activePeriod} 營收報表
            </h2>
            {selectedPeriodData?.collection_rate && (
              <Badge variant={selectedPeriodData.collection_rate >= 80 ? 'success' : selectedPeriodData.collection_rate >= 60 ? 'warning' : 'danger'}>
                收款率 {selectedPeriodData.collection_rate.toFixed(1)}%
              </Badge>
            )}
          </div>

          {/* 摘要卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">應收金額</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                ${totalReceivable.toLocaleString()}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">已收款</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                ${totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">待收款</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">
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
                  onClick={() => exportCSV(branchRevenueData, `revenue_${activePeriod}`)}
                  className="btn-ghost text-sm"
                >
                  <Download className="w-4 h-4 mr-1" />
                  匯出
                </button>
              </div>
              <div className="h-80">
                {monthlyLoading ? (
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
                      <Legend />
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
              <h3 className="card-title">{activePeriod} 分館詳細數據</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>分館</th>
                    <th>已收款</th>
                    <th>待收款</th>
                    <th>逾期</th>
                    <th>應收總額</th>
                    <th>收款率</th>
                  </tr>
                </thead>
                <tbody>
                  {branchRevenueData?.map((branch, i) => (
                    <tr key={i}>
                      <td className="font-medium">{branch.branch_name}</td>
                      <td className="text-green-600 font-medium">
                        ${(branch.revenue || 0).toLocaleString()}
                      </td>
                      <td className="text-blue-600">
                        ${(branch.pending || 0).toLocaleString()}
                      </td>
                      <td className="text-red-600">
                        ${(branch.overdue || 0).toLocaleString()}
                      </td>
                      <td className="font-medium">
                        ${(branch.total_due || 0).toLocaleString()}
                      </td>
                      <td>
                        {branch.collection_rate != null ? (
                          <Badge variant={branch.collection_rate >= 80 ? 'success' : branch.collection_rate >= 60 ? 'warning' : 'danger'}>
                            {branch.collection_rate.toFixed(1)}%
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* 合計列 */}
                  <tr className="bg-gray-50 font-medium">
                    <td>合計</td>
                    <td className="text-green-600">${totalRevenue.toLocaleString()}</td>
                    <td className="text-blue-600">${totalPending.toLocaleString()}</td>
                    <td className="text-red-600">${totalOverdue.toLocaleString()}</td>
                    <td>${totalReceivable.toLocaleString()}</td>
                    <td>
                      <Badge variant={collectionRate >= 80 ? 'success' : collectionRate >= 60 ? 'warning' : 'danger'}>
                        {collectionRate}%
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 趨勢分析 */}
      {activeReport === 'trend' && (
        <div className="space-y-6">
          {/* YoY/MoM/QoQ 卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">
                {timePeriod === 'month' ? '本月營收' : timePeriod === 'quarter' ? '本季營收' : '本年營收'}
              </p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                ${(currentPeriodData.revenue || 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">{currentPeriodData.period}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">
                {timePeriod === 'month' ? '上月營收' : timePeriod === 'quarter' ? '上季營收' : '去年營收'}
              </p>
              <p className="text-3xl font-bold text-gray-600 mt-1">
                ${(prevPeriodRevenue || 0).toLocaleString()}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">
                {timePeriod === 'month' ? 'MoM 月增率' : timePeriod === 'quarter' ? 'QoQ 季增率' : 'YoY 年增率'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {periodChange !== null && periodChange !== undefined ? (
                  <>
                    {periodChange >= 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-500" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-500" />
                    )}
                    <p className={`text-3xl font-bold ${periodChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {periodChange >= 0 ? '+' : ''}{periodChange}%
                    </p>
                  </>
                ) : (
                  <p className="text-3xl font-bold text-gray-400">-</p>
                )}
              </div>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">YoY 同期比較</p>
              <div className="flex items-center gap-2 mt-1">
                {yoyChange !== null && yoyChange !== undefined ? (
                  <>
                    {yoyChange >= 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-500" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-500" />
                    )}
                    <p className={`text-3xl font-bold ${yoyChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {yoyChange >= 0 ? '+' : ''}{yoyChange}%
                    </p>
                  </>
                ) : (
                  <p className="text-3xl font-bold text-gray-400">-</p>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">vs 去年同期</p>
            </div>
          </div>

          {/* 趨勢圖 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                營收趨勢（{timePeriod === 'month' ? '月度' : timePeriod === 'quarter' ? '季度' : '年度'}）
              </h3>
              <button
                onClick={() => exportCSV(trendData, `revenue_trend_${timePeriod}`)}
                className="btn-ghost text-sm"
              >
                <Download className="w-4 h-4 mr-1" />
                匯出
              </button>
            </div>
            <div className="h-80">
              {trendLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="period" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                      formatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <Legend />
                    <Bar dataKey="營收" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="應收" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 歷史數據表格 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">歷史數據明細</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>期間</th>
                    <th>營收</th>
                    <th>應收總額</th>
                    <th>收款筆數</th>
                    <th>
                      {timePeriod === 'month' ? 'MoM' : timePeriod === 'quarter' ? 'QoQ' : 'YoY'}
                    </th>
                    <th>YoY</th>
                  </tr>
                </thead>
                <tbody>
                  {trendData?.slice(0, 12).map((item, i) => {
                    const change = timePeriod === 'quarter' ? item.qoq_change : timePeriod === 'year' ? item.yoy_change : item.mom_change
                    return (
                      <tr key={i}>
                        <td className="font-medium">{item.period}</td>
                        <td className="text-green-600 font-medium">
                          ${(item.revenue || 0).toLocaleString()}
                        </td>
                        <td>${(item.total_due || 0).toLocaleString()}</td>
                        <td>{item.paid_count || 0} 筆</td>
                        <td>
                          {change !== null && change !== undefined ? (
                            <span className={`flex items-center gap-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              {change >= 0 ? '+' : ''}{change}%
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          {item.yoy_change !== null && item.yoy_change !== undefined ? (
                            <span className={`flex items-center gap-1 ${item.yoy_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {item.yoy_change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              {item.yoy_change >= 0 ? '+' : ''}{item.yoy_change}%
                            </span>
                          ) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 財務分析 */}
      {activeReport === 'financial' && (
        <div className="space-y-6">
          {/* KPI 卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card bg-gradient-to-br from-green-50 to-green-100">
              <p className="text-sm text-green-700">收款率</p>
              <p className="text-4xl font-bold text-green-600 mt-1">{collectionRate}%</p>
              <p className="text-xs text-green-600 mt-2">已收 / 應收</p>
            </div>
            <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
              <p className="text-sm text-blue-700">總應收金額</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                ${totalReceivable.toLocaleString()}
              </p>
            </div>
            <div className="card bg-gradient-to-br from-amber-50 to-amber-100">
              <p className="text-sm text-amber-700">待收款比例</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">
                {totalReceivable > 0 ? Math.round((totalPending / totalReceivable) * 100) : 0}%
              </p>
            </div>
            <div className="card bg-gradient-to-br from-red-50 to-red-100">
              <p className="text-sm text-red-700">逾期比例</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {totalReceivable > 0 ? Math.round((totalOverdue / totalReceivable) * 100) : 0}%
              </p>
            </div>
          </div>

          {/* 圖表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 分館收款率對比 */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">分館收款率對比</h3>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchCollectionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} width={80} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar dataKey="收款率" radius={[0, 4, 4, 0]}>
                      {branchCollectionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 金額佔比 */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">金額佔比分析</h3>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value, percent }) =>
                        `${name}: $${value.toLocaleString()} (${(percent * 100).toFixed(0)}%)`
                      }
                      labelLine={true}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 分館比較表 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">{activePeriod} 分館財務比較</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>分館</th>
                    <th>應收金額</th>
                    <th>已收金額</th>
                    <th>收款率</th>
                    <th>待收金額</th>
                    <th>逾期金額</th>
                    <th>健康度</th>
                  </tr>
                </thead>
                <tbody>
                  {branchRevenueData?.map((branch, i) => {
                    const branchRate = branch.collection_rate || 0
                    return (
                      <tr key={i}>
                        <td className="font-medium">{branch.branch_name}</td>
                        <td>${(branch.total_due || 0).toLocaleString()}</td>
                        <td className="text-green-600 font-medium">
                          ${(branch.revenue || 0).toLocaleString()}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${branchRate >= 80 ? 'bg-green-500' : branchRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${branchRate}%` }}
                              />
                            </div>
                            <span className="text-sm">{branchRate.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="text-amber-600">${(branch.pending || 0).toLocaleString()}</td>
                        <td className="text-red-600">${(branch.overdue || 0).toLocaleString()}</td>
                        <td>
                          <Badge variant={branchRate >= 80 ? 'success' : branchRate >= 60 ? 'warning' : 'danger'}>
                            {branchRate >= 80 ? '良好' : branchRate >= 60 ? '注意' : '警示'}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                  {/* 合計列 */}
                  <tr className="bg-gray-50 font-medium">
                    <td>合計</td>
                    <td>${totalReceivable.toLocaleString()}</td>
                    <td className="text-green-600">${totalRevenue.toLocaleString()}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${collectionRate >= 80 ? 'bg-green-500' : collectionRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${collectionRate}%` }}
                          />
                        </div>
                        <span className="text-sm">{collectionRate}%</span>
                      </div>
                    </td>
                    <td className="text-amber-600">${totalPending.toLocaleString()}</td>
                    <td className="text-red-600">${totalOverdue.toLocaleString()}</td>
                    <td>
                      <Badge variant={collectionRate >= 80 ? 'success' : collectionRate >= 60 ? 'warning' : 'danger'}>
                        {collectionRate >= 80 ? '良好' : collectionRate >= 60 ? '注意' : '警示'}
                      </Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 客戶分析 */}
      {activeReport === 'customer' && (
        <div className="space-y-6">
          {/* 統計卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">總客戶數</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{customers?.length || 0}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">活躍客戶</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {customers?.filter(c => c.status === 'active').length || 0}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">公司戶</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                {customers?.filter(c => c.customer_type === 'company' || c.customer_type === 'sole_proprietorship').length || 0}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">個人戶</p>
              <p className="text-3xl font-bold text-cyan-600 mt-1">
                {customers?.filter(c => c.customer_type === 'individual').length || 0}
              </p>
            </div>
          </div>

          {/* 圖表 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 客戶類型分佈 */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">客戶類型分佈</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {customerTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 客戶狀態分佈 */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">客戶狀態分佈</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {customerStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 客戶來源分佈 */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">客戶來源分佈</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={customerSourceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} width={70} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 分館客戶分佈 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">分館客戶與合約數量</h3>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchCustomerData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="活躍客戶" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="有效合約" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 合約分析 */}
      {activeReport === 'contract' && (
        <div className="space-y-6">
          {/* 統計卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">總合約數</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{(Array.isArray(contracts) ? contracts : []).length}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">有效合約</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {(Array.isArray(contracts) ? contracts : []).filter(c => c.status === 'active').length}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">即將到期</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{(Array.isArray(renewals) ? renewals : []).length}</p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">月租總額</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">
                ${(Array.isArray(contracts) ? contracts : []).filter(c => c.status === 'active').reduce((sum, c) => sum + (c.monthly_rent || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* 圖表 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 繳費週期分佈 */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">繳費週期分佈</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={contractCycleData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {contractCycleData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 到期時間分佈 */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">合約到期分佈（45天內）</h3>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contractExpiryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="合約數" radius={[4, 4, 0, 0]}>
                      {contractExpiryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? '#ef4444' : index === 1 ? '#f59e0b' : '#22c55e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 逾期報表 */}
      {activeReport === 'overdue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
            <div className="card">
              <p className="text-sm text-gray-500">嚴重逾期（60天+）</p>
              <p className="text-3xl font-bold text-red-800 mt-1">
                {overdueReport?.data?.items?.filter(i => i.days_overdue > 60).length || 0}
              </p>
            </div>
          </div>

          {/* 逾期天數分佈圖 */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">逾期天數分佈</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overdueDistributionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="筆數" radius={[4, 4, 0, 0]}>
                    {overdueDistributionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index >= 3 ? '#ef4444' : index >= 2 ? '#f59e0b' : '#fbbf24'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
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
                            {item.overdue_level === 'severe' ? '嚴重' : item.overdue_level === 'high' ? '高' : item.overdue_level === 'medium' ? '中' : '低'}
                          </Badge>
                        </td>
                        <td>{item.phone || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        沒有逾期款項
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
