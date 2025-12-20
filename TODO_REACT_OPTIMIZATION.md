# React 元件優化待處理項目

> 建立日期: 2025-12-20
> 狀態: 待處理

## 已完成 ✅

- [x] Dashboard.jsx Key Prop 問題 (commit: 8f3a694f)
- [x] Invoices.jsx alert() 改為通知系統 (commit: 8f3a694f)
- [x] DataTable.jsx 使用 useId 生成唯一 ID (commit: 133c6c21)

---

## 中優先級

### 1. Loading 狀態處理不一致
- **檔案**: 多個頁面
- **問題**: 有些用 skeleton、有些用 spinner、有些用文字
- **建議**: 統一使用 skeleton loader 或建立通用 Loading 元件

### 2. Modal 狀態過多 (Payments.jsx)
- **檔案**: `src/pages/Payments.jsx`
- **問題**: 7 個獨立的 Modal 狀態變數
- **建議**: 使用 useReducer 或狀態機模式管理

### 3. 表單欄位耦合
- **檔案**: `ContractCreate.jsx`, `QuoteCreate.jsx`
- **問題**: 多個表單欄位依賴其他欄位計算
- **建議**: 使用 react-hook-form 或 formik 管理表單

---

## 低優先級

### 4. 代碼重複
- **位置**: 多個 Modal 元件實作相似的樣式
- **建議**: 抽取共用 Modal 基礎元件

### 5. 相關狀態未合併
- **範例**: `sendingReminder` + `reminderResult` 可合併為單一物件
- **建議**: 使用 useReducer 或合併相關狀態

---

## 參考資料

- React useId: https://react.dev/reference/react/useId
- React Hook Form: https://react-hook-form.com/
- XState (狀態機): https://xstate.js.org/
