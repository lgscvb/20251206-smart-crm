import axios from 'axios'

// 開發環境使用 /proxy，正式環境使用 /api（由 nginx 反向代理）
const isDev = import.meta.env.DEV
const API_BASE = isDev ? '/proxy' : '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 請求攔截器
api.interceptors.request.use(
  (config) => {
    // 可以在這裡加入 token
    return config
  },
  (error) => Promise.reject(error)
)

// 回應攔截器
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// ============================================================================
// MCP Tools API
// ============================================================================

export const callTool = async (toolName, parameters = {}) => {
  // MCP Server 使用 "tool" 欄位而非 "name"
  const response = await api.post('/tools/call', { tool: toolName, parameters })
  return response
}

// ============================================================================
// AI Chat API (內部 AI 助手)
// ============================================================================

export const aiChat = async (messages, model = 'claude-sonnet-4') => {
  // 呼叫 MCP Server 的 AI Chat 端點（AI 回應需要較長時間）
  const response = await api.post('/ai/chat', { messages, model }, { timeout: 120000 })
  return response
}

// 串流版本的 AI Chat
export const aiChatStream = async (messages, model, onChunk, onTool, onDone, onError) => {
  const baseUrl = import.meta.env.DEV ? '/proxy' : '/api'

  try {
    const response = await fetch(`${baseUrl}/ai/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'content') {
              onChunk?.(data.text)
            } else if (data.type === 'tool') {
              onTool?.(data.name)
            } else if (data.type === 'done') {
              onDone?.()
            } else if (data.type === 'error') {
              onError?.(data.message)
            }
          } catch (e) {
            // 忽略解析錯誤
          }
        }
      }
    }
  } catch (error) {
    onError?.(error.message)
  }
}

export const getAIModels = async () => {
  // 取得可用的 AI 模型列表
  const response = await api.get('/ai/models')
  return response
}

// ============================================================================
// PostgREST API (直接查詢)
// ============================================================================

export const db = {
  // 通用查詢
  async query(table, params = {}) {
    return api.get(`/api/db/${table}`, { params })
  },

  // 客戶
  async getCustomers(params = {}) {
    return api.get('/api/db/v_customer_summary', { params })
  },

  async getCustomer(id) {
    const data = await api.get('/api/db/v_customer_summary', {
      params: { id: `eq.${id}` }
    })
    return data[0]
  },

  // 合約
  async getContracts(params = {}) {
    return api.get('/api/db/contracts', {
      params: {
        select: '*,customers(name,company_name),branches(name)',
        order: 'created_at.desc',
        ...params
      }
    })
  },

  // 繳費
  async getPaymentsDue(params = {}) {
    return api.get('/api/db/v_payments_due', { params })
  },

  async getOverdueDetails(params = {}) {
    return api.get('/api/db/v_overdue_details', { params })
  },

  // 續約提醒
  async getRenewalReminders(params = {}) {
    return api.get('/api/db/v_renewal_reminders', { params })
  },

  // 佣金
  async getCommissions(params = {}) {
    return api.get('/api/db/v_commission_tracker', { params })
  },

  // 分館營收
  async getBranchRevenue(params = {}) {
    return api.get('/api/db/v_branch_revenue_summary', { params })
  },

  // 今日待辦
  async getTodayTasks(params = {}) {
    return api.get('/api/db/v_today_tasks', { params })
  },

  // 分館列表
  async getBranches() {
    return api.get('/api/db/branches', {
      params: { status: 'eq.active', order: 'id.asc' }
    })
  }
}

// ============================================================================
// CRM Tools
// ============================================================================

export const crm = {
  async searchCustomers(query, branchId, status, limit = 50) {
    // 直接使用資料庫查詢
    const params = { limit, order: 'created_at.desc' }
    if (branchId) params.branch_id = `eq.${branchId}`
    if (status) params.status = `eq.${status}`
    if (query) {
      params.or = `(name.ilike.*${query}*,phone.ilike.*${query}*,company_name.ilike.*${query}*)`
    }
    const data = await api.get('/api/db/v_customer_summary', { params })
    return { success: true, data, total: data?.length || 0 }
  },

  async getCustomerDetail(customerId) {
    // 直接使用資料庫查詢
    try {
      const customerData = await api.get('/api/db/v_customer_summary', {
        params: { id: `eq.${customerId}` }
      })
      const customer = customerData?.[0]
      if (!customer) {
        return { success: false, error: '找不到客戶' }
      }

      // 取得合約
      const contracts = await api.get('/api/db/contracts', {
        params: {
          customer_id: `eq.${customerId}`,
          order: 'created_at.desc',
          limit: 20
        }
      })

      // 取得繳費記錄
      const payments = await api.get('/api/db/v_payments_due', {
        params: {
          customer_id: `eq.${customerId}`,
          order: 'due_date.desc',
          limit: 20
        }
      })

      return {
        success: true,
        data: {
          customer,
          contracts: contracts || [],
          payments: payments || [],
          statistics: {
            total_paid: customer.total_paid || 0,
            pending_amount: customer.pending_amount || 0,
            overdue_count: customer.overdue_count || 0,
            overdue_amount: customer.overdue_amount || 0
          }
        }
      }
    } catch (error) {
      console.error('取得客戶詳情失敗:', error)
      return { success: false, error: error.message }
    }
  },

  async createCustomer(data) {
    return callTool('crm_create_customer', data)
  },

  async updateCustomer(customerId, data) {
    return callTool('crm_update_customer', { customer_id: customerId, ...data })
  },

  async recordPayment(paymentId, paymentMethod, reference) {
    return callTool('crm_record_payment', {
      payment_id: paymentId,
      payment_method: paymentMethod,
      reference
    })
  },

  async createContract(data) {
    return callTool('crm_create_contract', data)
  }
}

// ============================================================================
// LINE Tools
// ============================================================================

export const line = {
  async sendMessage(lineUserId, message) {
    return callTool('line_send_message', { line_user_id: lineUserId, message })
  },

  async sendPaymentReminder(customerId, amount, dueDate) {
    return callTool('line_send_payment_reminder', {
      customer_id: customerId,
      amount,
      due_date: dueDate
    })
  },

  async sendRenewalReminder(contractId, daysRemaining) {
    return callTool('line_send_renewal_reminder', {
      contract_id: contractId,
      days_remaining: daysRemaining
    })
  }
}

// ============================================================================
// Report Tools - 使用直接資料庫查詢
// ============================================================================

export const reports = {
  async getRevenueSummary(branchId, month) {
    // 直接從 v_branch_revenue_summary 取得
    const params = {}
    if (branchId) params.branch_id = `eq.${branchId}`
    const data = await api.get('/api/db/v_branch_revenue_summary', { params })
    return { success: true, data }
  },

  async getOverdueList(branchId, minDays, maxDays) {
    // 直接從 v_overdue_details 取得
    const params = { order: 'days_overdue.desc', limit: 100 }
    if (branchId) params.branch_id = `eq.${branchId}`
    if (minDays) params.days_overdue = `gte.${minDays}`
    if (maxDays) params.days_overdue = `lte.${maxDays}`

    const items = await api.get('/api/db/v_overdue_details', { params })
    const totalAmount = items?.reduce((sum, i) => sum + (i.total_due || 0), 0) || 0
    const avgDays = items?.length > 0
      ? items.reduce((sum, i) => sum + (i.days_overdue || 0), 0) / items.length
      : 0

    return {
      success: true,
      data: {
        total_count: items?.length || 0,
        total_amount: totalAmount,
        avg_days_overdue: avgDays,
        items
      }
    }
  },

  async getCommissionDue(firmId, status) {
    // 直接從 v_commission_tracker 取得
    const params = { order: 'eligible_date.asc', limit: 100 }
    if (firmId) params.accounting_firm_id = `eq.${firmId}`
    if (status) params.commission_status = `eq.${status}`

    const items = await api.get('/api/db/v_commission_tracker', { params })
    const pending = items?.filter((i) => i.commission_status === 'pending') || []
    const eligible = items?.filter((i) => i.commission_status === 'eligible') || []

    return {
      success: true,
      data: {
        total_pending: pending.reduce((sum, i) => sum + (i.commission_amount || 0), 0),
        total_eligible: eligible.reduce((sum, i) => sum + (i.commission_amount || 0), 0),
        items
      }
    }
  }
}

export default api
