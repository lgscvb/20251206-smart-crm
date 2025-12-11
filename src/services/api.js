import axios from 'axios'

// ⚠️ 重要：雙層 /api/ 抵消設計 ⚠️
// 開發環境使用 /proxy，正式環境使用 /api（由 nginx 反向代理）
//
// 正式環境路徑組合：
//   baseURL: /api
//   + 路徑: /api/db/xxx (下面的 db.getXxx 等方法)
//   = 實際發出: /api/api/db/xxx
//   → Nginx trailing slash 剝掉第一層 /api/
//   → 後端收到: /api/db/xxx (正確)
//
// 請勿隨意修改路徑前綴，會導致 API 404！
// 同步修改需一併調整 nginx.conf
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

// 確保回傳值為陣列的輔助函數
const ensureArray = (data) => Array.isArray(data) ? data : []

export const db = {
  // 通用查詢
  async query(table, params = {}) {
    const data = await api.get(`/api/db/${table}`, { params })
    return ensureArray(data)
  },

  // 客戶
  async getCustomers(params = {}) {
    const data = await api.get('/api/db/v_customer_summary', { params })
    return ensureArray(data)
  },

  async getCustomer(id) {
    const data = await api.get('/api/db/v_customer_summary', {
      params: { id: `eq.${id}` }
    })
    const arr = ensureArray(data)
    return arr[0]
  },

  // 合約
  async getContracts(params = {}) {
    const data = await api.get('/api/db/contracts', {
      params: {
        select: '*,customers(name,company_name),branches(name)',
        order: 'created_at.desc',
        ...params
      }
    })
    return ensureArray(data)
  },

  // 繳費
  async getPaymentsDue(params = {}) {
    const data = await api.get('/api/db/v_payments_due', { params })
    return ensureArray(data)
  },

  async getOverdueDetails(params = {}) {
    const data = await api.get('/api/db/v_overdue_details', { params })
    return ensureArray(data)
  },

  async getPaymentsHistory(params = {}) {
    // 查詢已付款記錄（用於撤銷功能）
    const data = await api.get('/api/db/payments', {
      params: {
        payment_status: 'eq.paid',
        select: 'id,customer_id,branch_id,payment_period,amount,due_date,paid_at,payment_method,reference,notes,customer:customers(name,company_name),branch:branches(name)',
        order: 'paid_at.desc',
        limit: 50,
        ...params
      }
    })
    return ensureArray(data)
  },

  // 續約提醒
  async getRenewalReminders(params = {}) {
    const data = await api.get('/api/db/v_renewal_reminders', { params })
    return ensureArray(data)
  },

  // 佣金
  async getCommissions(params = {}) {
    const data = await api.get('/api/db/v_commission_tracker', { params })
    return ensureArray(data)
  },

  // 分館營收
  async getBranchRevenue(params = {}) {
    const data = await api.get('/api/db/v_branch_revenue_summary', { params })
    return ensureArray(data)
  },

  // 今日待辦
  async getTodayTasks(params = {}) {
    const data = await api.get('/api/db/v_today_tasks', { params })
    return ensureArray(data)
  },

  // 分館列表
  async getBranches() {
    const data = await api.get('/api/db/branches', {
      params: { status: 'eq.active', order: 'id.asc' }
    })
    return ensureArray(data)
  },

  // 歷史營收數據
  async getMonthlyRevenue(params = {}) {
    const data = await api.get('/api/db/v_monthly_revenue', { params })
    return ensureArray(data)
  },

  async getQuarterlyRevenue(params = {}) {
    const data = await api.get('/api/db/v_quarterly_revenue', { params })
    return ensureArray(data)
  },

  async getYearlyRevenue(params = {}) {
    const data = await api.get('/api/db/v_yearly_revenue', { params })
    return ensureArray(data)
  },

  async getCompanyMonthlyRevenue(params = {}) {
    const data = await api.get('/api/db/v_company_monthly_revenue', { params })
    return ensureArray(data)
  },

  async getCompanyQuarterlyRevenue(params = {}) {
    const data = await api.get('/api/db/v_company_quarterly_revenue', { params })
    return ensureArray(data)
  },

  async getCompanyYearlyRevenue(params = {}) {
    const data = await api.get('/api/db/v_company_yearly_revenue', { params })
    return ensureArray(data)
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
    const rawData = await api.get('/api/db/v_customer_summary', { params })
    const data = ensureArray(rawData)
    return { success: true, data, total: data.length }
  },

  async getCustomerDetail(customerId) {
    // 直接使用資料庫查詢
    try {
      const customerData = await api.get('/api/db/v_customer_summary', {
        params: { id: `eq.${customerId}` }
      })
      const customerArr = ensureArray(customerData)
      const customer = customerArr[0]
      if (!customer) {
        return { success: false, error: '找不到客戶' }
      }

      // 取得合約
      const rawContracts = await api.get('/api/db/contracts', {
        params: {
          customer_id: `eq.${customerId}`,
          order: 'created_at.desc',
          limit: 20
        }
      })

      // 取得繳費記錄
      const rawPayments = await api.get('/api/db/v_payments_due', {
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
          contracts: ensureArray(rawContracts),
          payments: ensureArray(rawPayments),
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

  async undoPayment(paymentId, reason) {
    return callTool('crm_payment_undo', {
      payment_id: paymentId,
      reason
    })
  },

  async createContract(data) {
    return callTool('crm_create_contract', data)
  },

  async generateContractPdf(contractId) {
    return callTool('contract_generate_pdf', { contract_id: contractId })
  },

  async generateQuotePdf(quoteId) {
    return callTool('quote_generate_pdf', { quote_id: quoteId })
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
    return { success: true, data: ensureArray(data) }
  },

  async getOverdueList(branchId, minDays, maxDays) {
    // 直接從 v_overdue_details 取得
    const params = { order: 'days_overdue.desc', limit: 100 }
    if (branchId) params.branch_id = `eq.${branchId}`
    if (minDays) params.days_overdue = `gte.${minDays}`
    if (maxDays) params.days_overdue = `lte.${maxDays}`

    const rawItems = await api.get('/api/db/v_overdue_details', { params })
    const items = ensureArray(rawItems)
    const totalAmount = items.reduce((sum, i) => sum + (i.total_due || 0), 0)
    const avgDays = items.length > 0
      ? items.reduce((sum, i) => sum + (i.days_overdue || 0), 0) / items.length
      : 0

    return {
      success: true,
      data: {
        total_count: items.length,
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

    const rawItems = await api.get('/api/db/v_commission_tracker', { params })
    const items = ensureArray(rawItems)
    const pending = items.filter((i) => i.commission_status === 'pending')
    const eligible = items.filter((i) => i.commission_status === 'eligible')

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

// ============================================================================
// Settings API
// ============================================================================

export const settings = {
  async getAll() {
    // 直接從資料庫取得所有設定
    const data = await api.get('/api/db/system_settings', { params: { order: 'key' } })
    const result = {}
    const items = ensureArray(data)
    items.forEach(item => {
      result[item.key] = item.value
    })
    return result
  },

  async get(key) {
    const data = await api.get('/api/db/system_settings', {
      params: { key: `eq.${key}` }
    })
    const items = ensureArray(data)
    return items.length > 0 ? items[0].value : null
  },

  async update(key, value) {
    // 使用 UPSERT (需要 PostgREST 設定)
    const data = await api.patch('/api/db/system_settings', { value }, {
      params: { key: `eq.${key}` },
      headers: { 'Prefer': 'return=representation' }
    })
    return ensureArray(data)[0]
  }
}

// ============================================================================
// Legal Letter API (存證信函)
// ============================================================================

export const legalLetter = {
  // 列出候選客戶（逾期>14天且催繳>=5次）
  async getCandidates(branchId, limit = 50) {
    const params = { limit, order: 'days_overdue.desc' }
    if (branchId) params.branch_id = `eq.${branchId}`
    const data = await api.get('/api/db/v_legal_letter_candidates', { params })
    return ensureArray(data)
  },

  // 列出待處理存證信函
  async getPending(branchId, status, limit = 50) {
    const params = { limit, order: 'created_at.desc' }
    if (branchId) params.branch_id = `eq.${branchId}`
    if (status) params.status = `eq.${status}`
    const data = await api.get('/api/db/v_pending_legal_letters', { params })
    return ensureArray(data)
  },

  // 記錄催繳
  async recordReminder(paymentId, notes) {
    return callTool('legal_record_reminder', { payment_id: paymentId, notes })
  },

  // 生成存證信函內容 (AI)
  async generateContent(params) {
    return callTool('legal_generate_content', params)
  },

  // 建立存證信函
  async create(paymentId, content, recipientName, recipientAddress) {
    return callTool('legal_create_letter', {
      payment_id: paymentId,
      content,
      recipient_name: recipientName,
      recipient_address: recipientAddress
    })
  },

  // 生成 PDF
  async generatePdf(letterId) {
    return callTool('legal_generate_pdf', { letter_id: letterId })
  },

  // 發送通知
  async notifyStaff(letterId, staffLineId, message) {
    return callTool('legal_notify_staff', {
      letter_id: letterId,
      staff_line_id: staffLineId,
      message
    })
  },

  // 更新狀態
  async updateStatus(letterId, status, approvedBy, trackingNumber, notes) {
    return callTool('legal_update_status', {
      letter_id: letterId,
      status,
      approved_by: approvedBy,
      tracking_number: trackingNumber,
      notes
    })
  }
}

export default api
