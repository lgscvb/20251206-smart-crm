import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  Building2,
  CreditCard,
  User,
  MessageSquare,
  RefreshCw,
  ChevronRight,
  FileWarning
} from 'lucide-react'
import { db } from '../services/api'
import useStore from '../store/useStore'

// 驗證規則
const VALIDATION_RULES = [
  {
    id: 'phone',
    label: '電話號碼',
    icon: Phone,
    check: (c) => !!c.phone,
    severity: 'warning'
  },
  {
    id: 'email',
    label: 'Email',
    icon: Mail,
    check: (c) => !!c.email,
    severity: 'info'
  },
  {
    id: 'company',
    label: '公司名稱',
    icon: Building2,
    check: (c) => c.customer_type !== 'corporate' || !!c.company_name,
    severity: 'warning'
  },
  {
    id: 'tax_id',
    label: '統一編號',
    icon: CreditCard,
    check: (c) => c.customer_type !== 'corporate' || !!c.company_tax_id,
    severity: 'warning'
  },
  {
    id: 'line_uid',
    label: 'LINE 綁定',
    icon: MessageSquare,
    check: (c) => !!c.line_user_id,
    severity: 'info'
  },
  {
    id: 'id_number',
    label: '身分證字號',
    icon: User,
    check: (c) => c.customer_type !== 'individual' || !!c.id_number,
    severity: 'info'
  }
]

export default function DataValidation() {
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [filter, setFilter] = useState('all') // all, warning, info
  const selectedBranch = useStore((state) => state.selectedBranch)

  // 取得客戶資料
  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ['validation-customers', selectedBranch],
    queryFn: async () => {
      const params = {
        status: 'eq.active',
        order: 'legacy_id.asc',
        limit: 500
      }
      if (selectedBranch) {
        params.branch_id = `eq.${selectedBranch}`
      }
      return db.query('customers', params)
    }
  })

  // 計算驗證統計
  const validationStats = customers ? calculateStats(customers) : null

  function calculateStats(customers) {
    const issues = []
    const summary = {}

    VALIDATION_RULES.forEach((rule) => {
      summary[rule.id] = { total: 0, passed: 0, failed: 0, customers: [] }
    })

    customers.forEach((customer) => {
      VALIDATION_RULES.forEach((rule) => {
        summary[rule.id].total++
        if (rule.check(customer)) {
          summary[rule.id].passed++
        } else {
          summary[rule.id].failed++
          summary[rule.id].customers.push(customer)
          issues.push({
            customer,
            rule,
            severity: rule.severity
          })
        }
      })
    })

    // 計算總體完整度
    const totalChecks = customers.length * VALIDATION_RULES.length
    const passedChecks = Object.values(summary).reduce((sum, s) => sum + s.passed, 0)
    const completeness = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0

    // 按嚴重程度分類
    const warnings = issues.filter((i) => i.severity === 'warning')
    const infos = issues.filter((i) => i.severity === 'info')

    return {
      summary,
      issues,
      warnings,
      infos,
      completeness,
      totalCustomers: customers.length
    }
  }

  // 過濾問題
  const filteredIssues = validationStats?.issues.filter((issue) => {
    if (filter === 'all') return true
    return issue.severity === filter
  }) || []

  // 按客戶分組
  const issuesByCustomer = filteredIssues.reduce((acc, issue) => {
    const id = issue.customer.id
    if (!acc[id]) {
      acc[id] = { customer: issue.customer, issues: [] }
    }
    acc[id].issues.push(issue)
    return acc
  }, {})

  const getCompletenessColor = (pct) => {
    if (pct >= 90) return 'text-green-600'
    if (pct >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getCompletenessBarColor = (pct) => {
    if (pct >= 90) return 'bg-green-500'
    if (pct >= 70) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-blue-600" />
            資料驗證
          </h1>
          <p className="mt-1 text-gray-500">檢查資料完整度，確保資料品質</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          重新檢查
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-500">檢查中...</span>
        </div>
      ) : (
        <>
          {/* 總覽卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 完整度 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">資料完整度</span>
                <ShieldCheck className="w-5 h-5 text-blue-500" />
              </div>
              <div className={`text-4xl font-bold ${getCompletenessColor(validationStats?.completeness || 0)}`}>
                {validationStats?.completeness || 0}%
              </div>
              <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getCompletenessBarColor(validationStats?.completeness || 0)} transition-all`}
                  style={{ width: `${validationStats?.completeness || 0}%` }}
                />
              </div>
            </div>

            {/* 客戶總數 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">檢查客戶數</span>
                <User className="w-5 h-5 text-gray-500" />
              </div>
              <div className="text-4xl font-bold text-gray-900">
                {validationStats?.totalCustomers || 0}
              </div>
              <p className="mt-2 text-sm text-gray-500">有效客戶</p>
            </div>

            {/* 警告 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">重要問題</span>
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="text-4xl font-bold text-yellow-600">
                {validationStats?.warnings?.length || 0}
              </div>
              <p className="mt-2 text-sm text-gray-500">需要處理</p>
            </div>

            {/* 提示 */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">一般提示</span>
                <FileWarning className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-4xl font-bold text-blue-600">
                {validationStats?.infos?.length || 0}
              </div>
              <p className="mt-2 text-sm text-gray-500">建議補充</p>
            </div>
          </div>

          {/* 驗證項目明細 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">驗證項目</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {VALIDATION_RULES.map((rule) => {
                const stat = validationStats?.summary[rule.id]
                const passRate = stat?.total > 0 ? Math.round((stat.passed / stat.total) * 100) : 0
                const Icon = rule.icon

                return (
                  <div
                    key={rule.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedIssue(selectedIssue === rule.id ? null : rule.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        passRate >= 90 ? 'bg-green-100' : passRate >= 70 ? 'bg-yellow-100' : 'bg-red-100'
                      }`}>
                        <Icon className={`w-5 h-5 ${
                          passRate >= 90 ? 'text-green-600' : passRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{rule.label}</p>
                        <p className="text-sm text-gray-500">
                          {stat?.passed || 0} / {stat?.total || 0} 通過
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getCompletenessBarColor(passRate)} transition-all`}
                          style={{ width: `${passRate}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium w-12 text-right ${getCompletenessColor(passRate)}`}>
                        {passRate}%
                      </span>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
                        selectedIssue === rule.id ? 'rotate-90' : ''
                      }`} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 展開的問題明細 */}
          {selectedIssue && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  缺少「{VALIDATION_RULES.find(r => r.id === selectedIssue)?.label}」的客戶
                </h2>
                <span className="text-sm text-gray-500">
                  {validationStats?.summary[selectedIssue]?.failed || 0} 筆
                </span>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">編號</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">姓名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">公司</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">電話</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {validationStats?.summary[selectedIssue]?.customers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-500">
                          {customer.legacy_id || '-'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {customer.name}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                          {customer.company_name || '-'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                          {customer.phone || '-'}
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-sm">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            customer.customer_type === 'corporate'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {customer.customer_type === 'corporate' ? '公司' : '個人'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 問題客戶列表 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">問題客戶總覽</h2>
              <div className="flex gap-2">
                {['all', 'warning', 'info'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 text-sm rounded-lg ${
                      filter === f
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {f === 'all' ? '全部' : f === 'warning' ? '重要' : '一般'}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {Object.values(issuesByCustomer).length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="text-gray-500">沒有符合條件的問題</p>
                </div>
              ) : (
                Object.values(issuesByCustomer).slice(0, 50).map(({ customer, issues }) => (
                  <div key={customer.id} className="px-6 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-gray-400">{customer.legacy_id}</span>
                        <span className="font-medium text-gray-900">{customer.name}</span>
                        {customer.company_name && (
                          <span className="text-sm text-gray-500">({customer.company_name})</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{issues.length} 個問題</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {issues.map((issue, i) => {
                        const Icon = issue.rule.icon
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                              issue.severity === 'warning'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            缺少{issue.rule.label}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
