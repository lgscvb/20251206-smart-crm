import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db, crm, line, reports, settings, legalLetter } from '../services/api'
import useStore from '../store/useStore'

// ============================================================================
// 客戶相關 Hooks
// ============================================================================

export function useCustomers(params = {}) {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['customers', params, selectedBranch],
    queryFn: () => {
      const queryParams = { ...params, order: 'created_at.desc', limit: 100 }
      if (selectedBranch) {
        queryParams.branch_id = `eq.${selectedBranch}`
      }
      return db.getCustomers(queryParams)
    }
  })
}

export function useCustomerDetail(customerId) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => crm.getCustomerDetail(customerId),
    enabled: !!customerId
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: (data) => crm.createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      addNotification({ type: 'success', message: '客戶建立成功' })
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `建立失敗: ${error.message}` })
    }
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: ({ customerId, data }) => crm.updateCustomer(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['customer'] })
      addNotification({ type: 'success', message: '客戶更新成功' })
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `更新失敗: ${error.message}` })
    }
  })
}

// ============================================================================
// 合約相關 Hooks
// ============================================================================

export function useContracts(params = {}) {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['contracts', params, selectedBranch],
    queryFn: () => {
      const queryParams = { ...params }
      if (selectedBranch) {
        queryParams.branch_id = `eq.${selectedBranch}`
      }
      return db.getContracts(queryParams)
    }
  })
}

export function useContractDetail(contractId) {
  return useQuery({
    queryKey: ['contract', contractId],
    queryFn: () => crm.getContractDetail(contractId),
    enabled: !!contractId
  })
}

// ============================================================================
// 繳費相關 Hooks
// ============================================================================

export function usePaymentsDue(params = {}) {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['payments-due', params, selectedBranch],
    queryFn: () => {
      const queryParams = { ...params, limit: 100 }
      if (selectedBranch) {
        queryParams.branch_id = `eq.${selectedBranch}`
      }
      return db.getPaymentsDue(queryParams)
    }
  })
}

export function useOverdueDetails(params = {}) {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['overdue', params, selectedBranch],
    queryFn: async () => {
      const queryParams = { ...params, limit: 100 }
      if (selectedBranch) {
        queryParams.branch_id = `eq.${selectedBranch}`
      }
      const data = await db.getOverdueDetails(queryParams)
      return Array.isArray(data) ? data : []
    }
  })
}

export function usePaymentsHistory(params = {}) {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['payments-history', params, selectedBranch],
    queryFn: async () => {
      const queryParams = { ...params }
      if (selectedBranch) {
        queryParams.branch_id = `eq.${selectedBranch}`
      }
      const data = await db.getPaymentsHistory(queryParams)
      return Array.isArray(data) ? data : []
    }
  })
}

export function useRecordPayment() {
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: ({ paymentId, paymentMethod, reference }) =>
      crm.recordPayment(paymentId, paymentMethod, reference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-due'] })
      queryClient.invalidateQueries({ queryKey: ['overdue'] })
      queryClient.invalidateQueries({ queryKey: ['branch-revenue'] })
      addNotification({ type: 'success', message: '繳費記錄成功' })
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `記錄失敗: ${error.message}` })
    }
  })
}

export function useUndoPayment() {
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: ({ paymentId, reason }) =>
      crm.undoPayment(paymentId, reason),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['payments-due'] })
        queryClient.invalidateQueries({ queryKey: ['overdue'] })
        queryClient.invalidateQueries({ queryKey: ['payments-history'] })
        queryClient.invalidateQueries({ queryKey: ['branch-revenue'] })
        addNotification({ type: 'success', message: '繳費已撤銷' })
      } else {
        addNotification({ type: 'error', message: data.message || '撤銷失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `撤銷失敗: ${error.message}` })
    }
  })
}

// ============================================================================
// 續約提醒 Hooks
// ============================================================================

export function useRenewalReminders(params = {}) {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['renewals', params, selectedBranch],
    queryFn: async () => {
      const queryParams = { ...params, limit: 100 }
      if (selectedBranch) {
        queryParams.branch_id = `eq.${selectedBranch}`
      }
      const data = await db.getRenewalReminders(queryParams)
      return Array.isArray(data) ? data : []
    }
  })
}

// ============================================================================
// 佣金 Hooks
// ============================================================================

export function useCommissions(params = {}) {
  return useQuery({
    queryKey: ['commissions', params],
    queryFn: () => db.getCommissions({ ...params, limit: 100 })
  })
}

// ============================================================================
// 儀表板 Hooks
// ============================================================================

export function useBranchRevenue() {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['branch-revenue', selectedBranch],
    queryFn: async () => {
      const params = {}
      if (selectedBranch) {
        params.branch_id = `eq.${selectedBranch}`
      }
      const data = await db.getBranchRevenue(params)
      return Array.isArray(data) ? data : []
    }
  })
}

export function useTodayTasks() {
  const selectedBranch = useStore((state) => state.selectedBranch)

  // v_today_tasks 視圖不存在，改用 v_payments_due + v_renewal_reminders 組合
  return useQuery({
    queryKey: ['today-tasks', selectedBranch],
    queryFn: async () => {
      try {
        const params = { limit: 10 }
        if (selectedBranch) {
          params.branch_id = `eq.${selectedBranch}`
        }

        // 取得今日到期的繳費
        const payments = await db.getPaymentsDue({
          ...params,
          payment_status: 'eq.pending',
          order: 'due_date.asc'
        })

        // 取得即將到期的合約
        const renewals = await db.getRenewalReminders({
          ...params,
          order: 'days_remaining.asc'
        })

        // 組合成待辦事項
        const tasks = []

        // 確保是陣列（防止 API 回傳格式不同）
        const paymentsArr = Array.isArray(payments) ? payments : []
        const renewalsArr = Array.isArray(renewals) ? renewals : []

        paymentsArr.slice(0, 5).forEach((p) => {
          tasks.push({
            task_type: 'payment_due',
            task_description: `${p.customer_name} - ${p.payment_period} 租金待繳`,
            amount: p.amount,
            customer_name: p.customer_name,
            branch_name: p.branch_name,
            priority: p.urgency === 'upcoming' ? 'high' : 'medium'
          })
        })

        renewalsArr.filter((r) => r.days_remaining <= 30).slice(0, 5).forEach((r) => {
          tasks.push({
            task_type: 'contract_expiring',
            task_description: `${r.customer_name} 合約 ${r.days_remaining} 天後到期`,
            amount: r.monthly_rent,
            customer_name: r.customer_name,
            branch_name: r.branch_name,
            priority: r.days_remaining <= 7 ? 'urgent' : 'high'
          })
        })

        return tasks.sort((a, b) => {
          const order = { urgent: 0, high: 1, medium: 2 }
          return (order[a.priority] || 3) - (order[b.priority] || 3)
        })
      } catch (error) {
        console.error('載入今日待辦失敗:', error)
        return []
      }
    }
  })
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const data = await db.getBranches()
      return Array.isArray(data) ? data : []
    },
    staleTime: Infinity
  })
}

// ============================================================================
// LINE 通知 Hooks
// ============================================================================

export function useSendPaymentReminder() {
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: ({ customerId, amount, dueDate }) =>
      line.sendPaymentReminder(customerId, amount, dueDate),
    onSuccess: () => {
      addNotification({ type: 'success', message: 'LINE 催繳通知已發送' })
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `發送失敗: ${error.message}` })
    }
  })
}

export function useSendRenewalReminder() {
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: ({ contractId, daysRemaining }) =>
      line.sendRenewalReminder(contractId, daysRemaining),
    onSuccess: () => {
      addNotification({ type: 'success', message: 'LINE 續約提醒已發送' })
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `發送失敗: ${error.message}` })
    }
  })
}

// ============================================================================
// 報表 Hooks
// ============================================================================

export function useRevenueSummary(branchId, month) {
  return useQuery({
    queryKey: ['report-revenue', branchId, month],
    queryFn: () => reports.getRevenueSummary(branchId, month)
  })
}

export function useOverdueReport(branchId, minDays, maxDays) {
  return useQuery({
    queryKey: ['report-overdue', branchId, minDays, maxDays],
    queryFn: () => reports.getOverdueList(branchId, minDays, maxDays)
  })
}

export function useCommissionReport(firmId, status) {
  return useQuery({
    queryKey: ['report-commission', firmId, status],
    queryFn: () => reports.getCommissionDue(firmId, status)
  })
}

// ============================================================================
// 系統設定 Hooks
// ============================================================================

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => settings.getAll(),
    staleTime: 1000 * 60 * 5 // 5 minutes
  })
}

export function useSetting(key) {
  return useQuery({
    queryKey: ['settings', key],
    queryFn: () => settings.get(key),
    enabled: !!key,
    staleTime: 1000 * 60 * 5
  })
}

export function useUpdateSetting() {
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: ({ key, value }) => settings.update(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      addNotification({ type: 'success', message: '設定已儲存' })
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `儲存失敗: ${error.message}` })
    }
  })
}

// ============================================================================
// 歷史營收 Hooks (YoY/MoM/QoQ)
// ============================================================================

export function useMonthlyRevenue(params = {}) {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['monthly-revenue', params, selectedBranch],
    queryFn: () => {
      const queryParams = { order: 'period_start.desc', limit: 24, ...params }
      if (selectedBranch) {
        queryParams.branch_id = `eq.${selectedBranch}`
      }
      return db.getMonthlyRevenue(queryParams)
    }
  })
}

export function useQuarterlyRevenue(params = {}) {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['quarterly-revenue', params, selectedBranch],
    queryFn: () => {
      const queryParams = { order: 'period_start.desc', limit: 12, ...params }
      if (selectedBranch) {
        queryParams.branch_id = `eq.${selectedBranch}`
      }
      return db.getQuarterlyRevenue(queryParams)
    }
  })
}

export function useYearlyRevenue(params = {}) {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['yearly-revenue', params, selectedBranch],
    queryFn: () => {
      const queryParams = { order: 'period_start.desc', limit: 5, ...params }
      if (selectedBranch) {
        queryParams.branch_id = `eq.${selectedBranch}`
      }
      return db.getYearlyRevenue(queryParams)
    }
  })
}

export function useCompanyMonthlyRevenue(params = {}) {
  return useQuery({
    queryKey: ['company-monthly-revenue', params],
    queryFn: () => db.getCompanyMonthlyRevenue({ order: 'period_start.desc', limit: 24, ...params })
  })
}

export function useCompanyQuarterlyRevenue(params = {}) {
  return useQuery({
    queryKey: ['company-quarterly-revenue', params],
    queryFn: () => db.getCompanyQuarterlyRevenue({ order: 'period_start.desc', limit: 12, ...params })
  })
}

export function useCompanyYearlyRevenue(params = {}) {
  return useQuery({
    queryKey: ['company-yearly-revenue', params],
    queryFn: () => db.getCompanyYearlyRevenue({ order: 'period_start.desc', limit: 5, ...params })
  })
}

// ============================================================================
// 存證信函 Hooks
// ============================================================================

export function useLegalLetterCandidates() {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['legal-candidates', selectedBranch],
    queryFn: () => legalLetter.getCandidates(selectedBranch)
  })
}

export function useLegalLetterPending(status) {
  const selectedBranch = useStore((state) => state.selectedBranch)

  return useQuery({
    queryKey: ['legal-pending', selectedBranch, status],
    queryFn: () => legalLetter.getPending(selectedBranch, status)
  })
}

export function useRecordReminder() {
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: ({ paymentId, notes }) => legalLetter.recordReminder(paymentId, notes),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['payments-due'] })
        queryClient.invalidateQueries({ queryKey: ['overdue'] })
        queryClient.invalidateQueries({ queryKey: ['legal-candidates'] })
        addNotification({ type: 'success', message: data.result?.message || '催繳記錄成功' })
      } else {
        addNotification({ type: 'error', message: data.error || '記錄失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `記錄失敗: ${error.message}` })
    }
  })
}

export function useGenerateLegalContent() {
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: (params) => legalLetter.generateContent(params),
    onSuccess: (data) => {
      if (data.success) {
        addNotification({ type: 'success', message: '存證信函內容生成成功' })
      } else {
        addNotification({ type: 'error', message: data.error || '生成失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `生成失敗: ${error.message}` })
    }
  })
}

export function useCreateLegalLetter() {
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: ({ paymentId, content, recipientName, recipientAddress }) =>
      legalLetter.create(paymentId, content, recipientName, recipientAddress),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['legal-candidates'] })
        queryClient.invalidateQueries({ queryKey: ['legal-pending'] })
        addNotification({ type: 'success', message: data.result?.message || '存證信函建立成功' })
      } else {
        addNotification({ type: 'error', message: data.error || '建立失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `建立失敗: ${error.message}` })
    }
  })
}

export function useGenerateLegalPdf() {
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: (letterId) => legalLetter.generatePdf(letterId),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['legal-pending'] })
        addNotification({ type: 'success', message: 'PDF 生成成功' })
      } else {
        addNotification({ type: 'error', message: data.error || 'PDF 生成失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `PDF 生成失敗: ${error.message}` })
    }
  })
}

export function useUpdateLegalStatus() {
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)

  return useMutation({
    mutationFn: ({ letterId, status, approvedBy, trackingNumber, notes }) =>
      legalLetter.updateStatus(letterId, status, approvedBy, trackingNumber, notes),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['legal-pending'] })
        addNotification({ type: 'success', message: data.result?.message || '狀態更新成功' })
      } else {
        addNotification({ type: 'error', message: data.error || '更新失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `更新失敗: ${error.message}` })
    }
  })
}
