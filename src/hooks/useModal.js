import { useState, useCallback } from 'react'

/**
 * Modal 狀態管理 Hook
 *
 * 解決 "7 Modal 問題"：使用單一狀態管理多個 Modal
 *
 * @example
 * const modal = useModal()
 *
 * // 打開 Modal
 * modal.open('pay', { paymentId: 123, amount: 1000 })
 *
 * // 檢查 Modal 是否打開
 * if (modal.isOpen('pay')) { ... }
 *
 * // 取得 Modal 資料
 * const data = modal.getData()
 *
 * // 關閉 Modal
 * modal.close()
 */
export function useModal() {
  const [state, setState] = useState({
    type: null,    // Modal 類型名稱
    data: null,    // Modal 資料
    isOpen: false
  })

  // 打開 Modal（自動關閉其他 Modal）
  const open = useCallback((type, data = null) => {
    setState({
      type,
      data,
      isOpen: true
    })
  }, [])

  // 關閉 Modal
  const close = useCallback(() => {
    setState({
      type: null,
      data: null,
      isOpen: false
    })
  }, [])

  // 檢查特定類型 Modal 是否打開
  const isOpen = useCallback((type) => {
    return state.isOpen && state.type === type
  }, [state.isOpen, state.type])

  // 取得當前 Modal 資料
  const getData = useCallback(() => {
    return state.data
  }, [state.data])

  // 更新 Modal 資料（不關閉）
  const updateData = useCallback((newData) => {
    setState(prev => ({
      ...prev,
      data: typeof newData === 'function' ? newData(prev.data) : { ...prev.data, ...newData }
    }))
  }, [])

  return {
    open,
    close,
    isOpen,
    getData,
    updateData,
    currentType: state.type,
    currentData: state.data
  }
}

/**
 * 多組 Modal 狀態管理 Hook
 *
 * 適用於需要同時管理多種獨立 Modal 的頁面
 * 例如：一個頁面有「付款」和「欄位設定」兩個可同時存在的 Modal 群組
 *
 * @example
 * const modals = useMultiModal(['main', 'settings'])
 *
 * // 打開主要 Modal
 * modals.main.open('pay', { paymentId: 123 })
 *
 * // 同時打開設定 Modal（不會關閉主要 Modal）
 * modals.settings.open('columns')
 */
export function useMultiModal(groups = ['default']) {
  const modalStates = {}

  groups.forEach(group => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    modalStates[group] = useModal()
  })

  return modalStates
}

/**
 * 付款頁面專用 Modal 管理 Hook
 *
 * 預定義所有付款頁面可能用到的 Modal 類型
 */
export function usePaymentModals() {
  const modal = useModal()

  return {
    // 通用操作
    open: modal.open,
    close: modal.close,
    getData: modal.getData,
    updateData: modal.updateData,

    // 便捷方法
    openPay: (payment) => modal.open('pay', payment),
    openReminder: (payment) => modal.open('reminder', payment),
    openUndo: (payment) => modal.open('undo', payment),
    openDelete: (payment) => modal.open('delete', payment),
    openWaive: (payment) => modal.open('waive', payment),
    openGenerate: () => modal.open('generate'),
    openColumnPicker: (tab) => modal.open('columns', { tab }),

    // 狀態檢查
    isPayOpen: modal.isOpen('pay'),
    isReminderOpen: modal.isOpen('reminder'),
    isUndoOpen: modal.isOpen('undo'),
    isDeleteOpen: modal.isOpen('delete'),
    isWaiveOpen: modal.isOpen('waive'),
    isGenerateOpen: modal.isOpen('generate'),
    isColumnsOpen: modal.isOpen('columns'),

    // 當前狀態
    currentType: modal.currentType,
    currentData: modal.currentData
  }
}

export default useModal
