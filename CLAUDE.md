# Hour Jungle CRM - 叢林小管家前端

## 專案概述

這是 Hour Jungle 的 CRM 管理後台前端，專為聯合辦公空間（虛擬辦公室）設計的客戶關係管理系統。

## 技術棧

| 類別 | 技術 |
|------|------|
| 框架 | React 18.2.0 + React Router 6 |
| 建構 | Vite 5.0.0 |
| 樣式 | Tailwind CSS 3.3.5 + Headless UI |
| 狀態 | Zustand 4.4.7 |
| 資料 | TanStack Query 5.8.0 + Axios |
| 圖表 | Recharts 2.10.3 |
| PDF | @react-pdf/renderer 4.3.1 |

---

## 專案結構

```
src/
├── components/           # 通用 UI 元件
│   ├── Layout.jsx       # 主框架（側邊欄+頂部導航）
│   ├── DataTable.jsx    # 高階資料表格
│   ├── Modal.jsx        # 模態框
│   ├── Badge.jsx        # 狀態徽章
│   └── pdf/             # PDF 元件
│       ├── QuotePDF.jsx
│       └── ContractPDF.jsx
│
├── pages/               # 頁面元件 (19個)
│   ├── Dashboard.jsx    # 儀表板
│   ├── Customers.jsx    # 客戶列表
│   ├── CustomerDetail.jsx
│   ├── Contracts.jsx    # 合約管理
│   ├── Payments.jsx     # 收款管理
│   ├── Renewals.jsx     # 續約提醒
│   ├── Commissions.jsx  # 佣金管理
│   ├── Reports.jsx      # 報表中心
│   ├── Quotes.jsx       # 報價單
│   ├── Invoices.jsx     # 發票管理
│   ├── Prospects.jsx    # 潛客管理
│   ├── LegalLetters.jsx # 存證信函
│   ├── Bookings.jsx     # 會議室預約
│   ├── AIAssistant.jsx  # AI 助手
│   └── Settings.jsx     # 系統設定
│
├── hooks/
│   └── useApi.js        # React Query hooks
│
├── services/
│   └── api.js           # API 客戶端 (600+ 行)
│
├── store/
│   └── useStore.js      # Zustand 狀態管理
│
├── App.jsx              # 路由配置
└── main.jsx             # 應用入口
```

---

## API 架構

### 混合 API 模式

本專案採用三種 API 模式：

#### 1. MCP Tools API（業務操作）
```javascript
// 調用 MCP 工具
POST /api/tools/call
{
  "name": "crm_record_payment",
  "arguments": { "payment_id": 123, "payment_method": "transfer" }
}
```

#### 2. PostgREST API（直接查詢）
```javascript
// 查詢資料
GET /api/db/customers?status=eq.active
GET /api/db/v_payments_due?order=due_date

// 更新資料
PATCH /api/db/customers?id=eq.123
{ "phone": "0912345678" }
```

#### 3. AI Chat API
```javascript
POST /api/ai/chat
{ "message": "今天有哪些待收款？" }
```

### 常用視圖

| 視圖 | 用途 |
|------|------|
| `v_customer_summary` | 客戶概覽 |
| `v_payments_due` | 應收款列表 |
| `v_overdue_details` | 逾期詳情 |
| `v_renewal_reminders` | 續約提醒 |
| `v_commission_tracker` | 佣金追蹤 |

---

## 開發指令

```bash
# 安裝依賴
npm install

# 開發伺服器 (port 3000)
npm run dev

# 建構生產版本
npm run build

# 預覽建構結果
npm run preview
```

---

## 環境變數

```env
VITE_API_URL=https://auto.yourspce.org
```

開發時 Vite 會將 API 請求代理到 MCP Server。

---

## 新增頁面流程

1. 在 `src/pages/` 建立新頁面元件
2. 在 `src/App.jsx` 新增路由：
   ```jsx
   <Route path="/new-page" element={<NewPage />} />
   ```
3. 在 `src/components/Layout.jsx` 新增側邊欄連結
4. 使用 `useApi` hooks 調用 API

---

## 調用 MCP 工具

```javascript
import { callTool } from '../services/api';

// 記錄繳費
const result = await callTool('crm_record_payment', {
  payment_id: 123,
  payment_method: 'transfer',
  payment_date: '2024-12-15'
});

// 發送 LINE 訊息
await callTool('line_send_payment_reminder', {
  customer_id: 456,
  reminder_type: 'overdue'
});
```

---

## 樣式規範

- 主色系：Primary Blue (#3b82f6) + Jungle Green (#22c55e)
- 狀態色：綠=成功、黃=警告、紅=危險
- 使用 Tailwind CSS 原子類

---

## 權限角色

| 角色 | 可訪問頁面 |
|------|-----------|
| admin | 全部 |
| manager | 儀表板、報表、客戶、合約、繳費 |
| finance | 繳費、報表、佣金 |
| sales | 客戶、合約、佣金 |
| service | 客戶、繳費 |

---

## 部署

```bash
# 建構
npm run build

# 打包
tar -czvf dist.tar.gz dist/

# 上傳到伺服器後解壓
# Nginx 配置請參考 nginx.conf
```
