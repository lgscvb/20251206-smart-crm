import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserPlus,
  Search,
  Filter,
  Phone,
  Building2,
  Calendar,
  ArrowRight,
  MessageSquare,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { db, crm, callTool } from '../services/api'
import useStore from '../store/useStore'

export default function Prospects() {
  const [search, setSearch] = useState('')
  const [selectedProspect, setSelectedProspect] = useState(null)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const selectedBranch = useStore((state) => state.selectedBranch)
  const addNotification = useStore((state) => state.addNotification)
  const queryClient = useQueryClient()

  // 取得潛客列表
  const { data: prospects, isLoading, refetch } = useQuery({
    queryKey: ['prospects', selectedBranch, search],
    queryFn: async () => {
      const params = {
        status: 'eq.prospect',
        order: 'created_at.desc',
        limit: 200
      }
      if (selectedBranch) {
        params.branch_id = `eq.${selectedBranch}`
      }
      if (search) {
        params.or = `(name.ilike.*${search}*,phone.ilike.*${search}*,company_name.ilike.*${search}*)`
      }
      return db.query('customers', params)
    }
  })

  // 取得統計資料
  const { data: stats } = useQuery({
    queryKey: ['prospect-stats', selectedBranch],
    queryFn: async () => {
      const params = { status: 'eq.prospect' }
      if (selectedBranch) {
        params.branch_id = `eq.${selectedBranch}`
      }
      const all = await db.query('customers', params)

      // 計算統計
      const total = all?.length || 0
      const withPhone = all?.filter(p => p.phone)?.length || 0
      const withCompany = all?.filter(p => p.company_name)?.length || 0
      const withLineUid = all?.filter(p => p.line_user_id)?.length || 0

      // 按來源分類
      const today = new Date()
      const thisMonth = all?.filter(p => {
        const created = new Date(p.created_at)
        return created.getMonth() === today.getMonth() && created.getFullYear() === today.getFullYear()
      })?.length || 0

      return {
        total,
        withPhone,
        withCompany,
        withLineUid,
        thisMonth,
        conversionRate: 0 // TODO: 計算轉換率
      }
    }
  })

  // 轉換為正式客戶
  const convertMutation = useMutation({
    mutationFn: async (customerId) => {
      return callTool('crm_update_customer', {
        customer_id: customerId,
        status: 'active'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      queryClient.invalidateQueries({ queryKey: ['prospect-stats'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      addNotification({ type: 'success', message: '已轉換為正式客戶' })
      setShowConvertModal(false)
      setSelectedProspect(null)
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `轉換失敗: ${error.message}` })
    }
  })

  // 刪除潛客
  const deleteMutation = useMutation({
    mutationFn: async (customerId) => {
      return callTool('crm_update_customer', {
        customer_id: customerId,
        status: 'inactive'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      queryClient.invalidateQueries({ queryKey: ['prospect-stats'] })
      addNotification({ type: 'success', message: '已標記為無效' })
      setSelectedProspect(null)
    }
  })

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-7 h-7 text-blue-600" />
            潛客管理
          </h1>
          <p className="mt-1 text-gray-500">追蹤潛在客戶，管理轉換流程</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          重新整理
        </button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">總潛客數</span>
            <UserPlus className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats?.total || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">本月新增</span>
            <Calendar className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-600 mt-2">{stats?.thisMonth || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">有電話</span>
            <Phone className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats?.withPhone || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">有公司名</span>
            <Building2 className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats?.withCompany || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">已綁 LINE</span>
            <MessageSquare className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats?.withLineUid || 0}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">轉換率</span>
            <ArrowRight className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-2">{stats?.conversionRate || 0}%</p>
        </div>
      </div>

      {/* 搜尋與篩選 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="prospect-search"
              name="prospect-search"
              type="text"
              placeholder="搜尋姓名、電話、公司..."
              aria-label="搜尋潛客"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* 潛客列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  潛客資訊
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  聯絡方式
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  來源
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  建立時間
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-gray-500">載入中...</span>
                    </div>
                  </td>
                </tr>
              ) : prospects?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <UserPlus className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>目前沒有潛客</p>
                  </td>
                </tr>
              ) : (
                prospects?.map((prospect) => (
                  <tr
                    key={prospect.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedProspect(prospect)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-medium">
                            {prospect.name?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{prospect.name || '未知'}</div>
                          {prospect.company_name && (
                            <div className="text-sm text-gray-500">{prospect.company_name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{prospect.phone || '-'}</div>
                      <div className="text-sm text-gray-500">{prospect.email || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {prospect.line_user_id ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            LINE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            手動
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(prospect.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedProspect(prospect)
                          setShowConvertModal(true)
                        }}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        轉換
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm('確定要標記此潛客為無效嗎？')) {
                            deleteMutation.mutate(prospect.id)
                          }
                        }}
                        className="text-red-600 hover:text-red-900"
                      >
                        移除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 潛客詳情 Drawer */}
      {selectedProspect && !showConvertModal && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedProspect(null)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl">
            <div className="flex flex-col h-full">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">潛客詳情</h3>
                <button
                  onClick={() => setSelectedProspect(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  {/* 基本資訊 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">基本資訊</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">姓名</span>
                        <span className="font-medium">{selectedProspect.name || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">公司</span>
                        <span className="font-medium">{selectedProspect.company_name || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">電話</span>
                        <span className="font-medium">{selectedProspect.phone || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Email</span>
                        <span className="font-medium">{selectedProspect.email || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* LINE 資訊 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">LINE 綁定</h4>
                    {selectedProspect.line_user_id ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span>已綁定</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-400">
                        <XCircle className="w-5 h-5" />
                        <span>未綁定</span>
                      </div>
                    )}
                  </div>

                  {/* 時間資訊 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-3">時間資訊</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">建立時間</span>
                        <span className="font-medium">{formatDate(selectedProspect.created_at)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">更新時間</span>
                        <span className="font-medium">{formatDate(selectedProspect.updated_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowConvertModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <ArrowRight className="w-4 h-4" />
                  轉換為正式客戶
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 轉換確認 Modal */}
      {showConvertModal && selectedProspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConvertModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">確認轉換</h3>
            <p className="text-gray-600 mb-6">
              確定要將「<span className="font-medium">{selectedProspect.name}</span>」轉換為正式客戶嗎？
              <br />
              <span className="text-sm text-gray-500">轉換後將可以建立合約和繳費記錄。</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConvertModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => convertMutation.mutate(selectedProspect.id)}
                disabled={convertMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {convertMutation.isPending ? '轉換中...' : '確認轉換'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
