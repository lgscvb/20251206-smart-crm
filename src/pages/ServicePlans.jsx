import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db, callTool } from '../services/api'
import Modal from '../components/Modal'
import useStore from '../store/useStore'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Bot,
  Loader2,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Clock,
  Calendar
} from 'lucide-react'

// 分類設定
const CATEGORY_CONFIG = {
  '登記服務': { icon: '📋', color: 'blue' },
  '空間服務': { icon: '🏢', color: 'green' },
  '代辦服務': { icon: '📝', color: 'purple' },
  '加值服務': { icon: '✨', color: 'yellow' }
}

// 繳費週期選項
const BILLING_CYCLES = [
  { value: 'monthly', label: '月繳' },
  { value: 'quarterly', label: '季繳' },
  { value: 'semi_annual', label: '半年繳' },
  { value: 'annual', label: '年繳' },
  { value: 'biennial', label: '兩年繳' },
  { value: 'one_time', label: '一次性' }
]

// 計價單位選項
const UNIT_OPTIONS = ['月', '小時', '天', '次', '3小時', '年']

// 初始表單
const INITIAL_FORM = {
  category: '登記服務',
  name: '',
  code: '',
  unit_price: '',
  unit: '月',
  billing_cycle: 'monthly',
  deposit: '',
  original_price: '',
  min_duration: '',
  revenue_type: 'own',
  annual_months: '',
  notes: '',
  sort_order: 0
}

export default function ServicePlans() {
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)
  const [syncing, setSyncing] = useState(false)

  // 查詢服務方案
  const { data: plans = [], isLoading, refetch } = useQuery({
    queryKey: ['service-plans'],
    queryFn: async () => {
      const result = await db.query('service_plans', {
        order: 'sort_order.asc,id.asc'
      })
      return result || []
    }
  })

  // 按分類分組
  const groupedPlans = plans.reduce((acc, plan) => {
    const cat = plan.category || '其他'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(plan)
    return acc
  }, {})

  // 新增方案
  const createMutation = useMutation({
    mutationFn: (data) => callTool('service_plan_create', data),
    onSuccess: (result) => {
      if (result?.success || result?.result?.success) {
        addNotification({ type: 'success', message: '服務方案已建立' })
        setShowAddModal(false)
        setForm(INITIAL_FORM)
        refetch()
      } else {
        addNotification({ type: 'error', message: result?.error || result?.result?.error || '建立失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: error.message })
    }
  })

  // 更新方案
  const updateMutation = useMutation({
    mutationFn: ({ plan_id, updates }) => callTool('service_plan_update', { plan_id, updates }),
    onSuccess: (result) => {
      if (result?.success || result?.result?.success) {
        addNotification({ type: 'success', message: '服務方案已更新' })
        setShowEditModal(false)
        setEditingPlan(null)
        setForm(INITIAL_FORM)
        refetch()
      } else {
        addNotification({ type: 'error', message: result?.error || result?.result?.error || '更新失敗' })
      }
    }
  })

  // 刪除方案
  const deleteMutation = useMutation({
    mutationFn: (plan_id) => callTool('service_plan_delete', { plan_id }),
    onSuccess: (result) => {
      if (result?.success || result?.result?.success) {
        addNotification({ type: 'success', message: '服務方案已刪除' })
        refetch()
      } else {
        addNotification({ type: 'error', message: result?.error || result?.result?.error || '刪除失敗' })
      }
    }
  })

  // 切換啟用狀態
  const toggleActive = async (plan) => {
    try {
      await callTool('service_plan_update', {
        plan_id: plan.id,
        updates: { is_active: !plan.is_active }
      })
      addNotification({
        type: 'success',
        message: `${plan.name} 已${plan.is_active ? '停用' : '啟用'}`
      })
      refetch()
    } catch (error) {
      addNotification({ type: 'error', message: error.message })
    }
  }

  // 同步到 Brain
  const handleSyncToBrain = async () => {
    setSyncing(true)
    try {
      const result = await callTool('sync_prices_to_brain', {})
      if (result?.success || result?.result?.success) {
        const imported = result?.imported || result?.result?.imported || 0
        addNotification({
          type: 'success',
          message: `已同步 ${imported} 個價格資訊到 AI 知識庫`
        })
      } else {
        addNotification({
          type: 'error',
          message: result?.error || result?.result?.error || '同步失敗'
        })
      }
    } catch (error) {
      addNotification({ type: 'error', message: error.message })
    } finally {
      setSyncing(false)
    }
  }

  // 開啟編輯
  const openEditModal = (plan) => {
    setEditingPlan(plan)
    setForm({
      category: plan.category || '',
      name: plan.name || '',
      code: plan.code || '',
      unit_price: plan.unit_price || '',
      unit: plan.unit || '月',
      billing_cycle: plan.billing_cycle || 'monthly',
      deposit: plan.deposit || '',
      original_price: plan.original_price || '',
      min_duration: plan.min_duration || '',
      revenue_type: plan.revenue_type || 'own',
      annual_months: plan.annual_months || '',
      notes: plan.notes || '',
      sort_order: plan.sort_order || 0
    })
    setShowEditModal(true)
  }

  // 處理新增
  const handleCreate = (e) => {
    e.preventDefault()
    createMutation.mutate({
      category: form.category,
      name: form.name,
      code: form.code,
      unit_price: parseFloat(form.unit_price) || 0,
      unit: form.unit,
      billing_cycle: form.billing_cycle || null,
      deposit: parseFloat(form.deposit) || 0,
      original_price: form.original_price ? parseFloat(form.original_price) : null,
      min_duration: form.min_duration || null,
      revenue_type: form.revenue_type,
      annual_months: form.annual_months ? parseInt(form.annual_months) : null,
      notes: form.notes || null,
      sort_order: parseInt(form.sort_order) || 0
    })
  }

  // 處理更新
  const handleUpdate = (e) => {
    e.preventDefault()
    if (!editingPlan) return

    updateMutation.mutate({
      plan_id: editingPlan.id,
      updates: {
        category: form.category,
        name: form.name,
        code: form.code,
        unit_price: parseFloat(form.unit_price) || 0,
        unit: form.unit,
        billing_cycle: form.billing_cycle || null,
        deposit: parseFloat(form.deposit) || 0,
        original_price: form.original_price ? parseFloat(form.original_price) : null,
        min_duration: form.min_duration || null,
        revenue_type: form.revenue_type,
        annual_months: form.annual_months ? parseInt(form.annual_months) : null,
        notes: form.notes || null,
        sort_order: parseInt(form.sort_order) || 0
      }
    })
  }

  // 處理刪除
  const handleDelete = (plan) => {
    if (window.confirm(`確定要刪除「${plan.name}」嗎？`)) {
      deleteMutation.mutate(plan.id)
    }
  }

  // 格式化繳費週期
  const formatBillingCycle = (cycle) => {
    const found = BILLING_CYCLES.find(c => c.value === cycle)
    return found?.label || cycle || '-'
  }

  return (
    <div className="space-y-6">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-jungle-100 rounded-lg">
            <Package className="w-6 h-6 text-jungle-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">價格設定</h1>
            <p className="text-sm text-gray-500">管理服務方案與價格表</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncToBrain}
            disabled={syncing}
            className="btn-secondary flex items-center gap-2"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            同步到 AI
          </button>
          <button
            onClick={() => {
              setForm(INITIAL_FORM)
              setShowAddModal(true)
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新增方案
          </button>
        </div>
      </div>

      {/* 方案列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
            const categoryPlans = groupedPlans[category] || []
            if (categoryPlans.length === 0) return null

            return (
              <div key={category} className="card">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">{config.icon}</span>
                  <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-sm text-gray-600">
                    {categoryPlans.length}
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {categoryPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`py-4 flex items-center justify-between ${!plan.is_active ? 'opacity-50' : ''}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-gray-900">{plan.name}</h3>
                          {plan.revenue_type === 'referral' && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                              轉介
                            </span>
                          )}
                          {!plan.is_active && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                              已停用
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" />
                            ${(plan.unit_price || 0).toLocaleString()}/{plan.unit}
                          </span>
                          {plan.billing_cycle && plan.billing_cycle !== 'one_time' && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatBillingCycle(plan.billing_cycle)}
                            </span>
                          )}
                          {plan.deposit > 0 && (
                            <span>押金 ${(plan.deposit || 0).toLocaleString()}</span>
                          )}
                          {plan.min_duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {plan.min_duration}
                            </span>
                          )}
                        </div>
                        {plan.notes && (
                          <p className="mt-1 text-xs text-gray-400">{plan.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(plan)}
                          className={`p-1.5 rounded-lg ${plan.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                          title={plan.is_active ? '停用' : '啟用'}
                        >
                          {plan.is_active ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(plan)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="編輯"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(plan)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 新增 Modal */}
      <Modal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setForm(INITIAL_FORM)
        }}
        title="新增服務方案"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                分類 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input w-full"
                required
              >
                {Object.keys(CATEGORY_CONFIG).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                服務代碼 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="input w-full"
                placeholder="如 virtual_office_2year"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              服務名稱 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              placeholder="如 借址登記 - 兩年約"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                單價 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                className="input w-full"
                placeholder="1490"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                單位 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="input w-full"
              >
                {UNIT_OPTIONS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">繳費週期</label>
              <select
                value={form.billing_cycle}
                onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })}
                className="input w-full"
              >
                {BILLING_CYCLES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">押金</label>
              <input
                type="number"
                value={form.deposit}
                onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                className="input w-full"
                placeholder="6000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">原價</label>
              <input
                type="number"
                value={form.original_price}
                onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                className="input w-full"
                placeholder="有優惠時填寫"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最低租期</label>
              <input
                type="text"
                value={form.min_duration}
                onChange={(e) => setForm({ ...form, min_duration: e.target.value })}
                className="input w-full"
                placeholder="如 2年"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">營收類型</label>
              <select
                value={form.revenue_type}
                onChange={(e) => setForm({ ...form, revenue_type: e.target.value })}
                className="input w-full"
              >
                <option value="own">自己收款</option>
                <option value="referral">轉介（事務所收款）</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年度月數</label>
              <input
                type="number"
                value={form.annual_months}
                onChange={(e) => setForm({ ...form, annual_months: e.target.value })}
                className="input w-full"
                placeholder="會計服務填 14"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input w-full resize-none"
              rows={2}
              placeholder="補充說明"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false)
                setForm(INITIAL_FORM)
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              建立
            </button>
          </div>
        </form>
      </Modal>

      {/* 編輯 Modal */}
      <Modal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingPlan(null)
          setForm(INITIAL_FORM)
        }}
        title={`編輯：${editingPlan?.name || ''}`}
        size="lg"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                分類 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input w-full"
                required
              >
                {Object.keys(CATEGORY_CONFIG).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                服務代碼 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="input w-full"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              服務名稱 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                單價 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                單位 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="input w-full"
              >
                {UNIT_OPTIONS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">繳費週期</label>
              <select
                value={form.billing_cycle}
                onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })}
                className="input w-full"
              >
                {BILLING_CYCLES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">押金</label>
              <input
                type="number"
                value={form.deposit}
                onChange={(e) => setForm({ ...form, deposit: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">原價</label>
              <input
                type="number"
                value={form.original_price}
                onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">最低租期</label>
              <input
                type="text"
                value={form.min_duration}
                onChange={(e) => setForm({ ...form, min_duration: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">營收類型</label>
              <select
                value={form.revenue_type}
                onChange={(e) => setForm({ ...form, revenue_type: e.target.value })}
                className="input w-full"
              >
                <option value="own">自己收款</option>
                <option value="referral">轉介（事務所收款）</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年度月數</label>
              <input
                type="number"
                value={form.annual_months}
                onChange={(e) => setForm({ ...form, annual_months: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input w-full resize-none"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false)
                setEditingPlan(null)
                setForm(INITIAL_FORM)
              }}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="btn-primary"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Pencil className="w-4 h-4 mr-2" />
              )}
              儲存
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
