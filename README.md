# Hour Jungle CRM - 專業管理後台

現代化的 React 前端管理系統，連接 MCP Server API。

## ✨ 功能特色

### 📊 儀表板
- 分館營收統計與圖表
- 今日待辦事項
- 逾期款項提醒
- 營運數據概覽

### 👥 客戶管理
- 客戶搜尋與篩選
- 新增/編輯客戶資料
- LINE ID 綁定
- 客戶詳情頁（合約、繳費記錄）
- 風險等級標示

### 📄 合約管理
- 合約列表與篩選
- 合約狀態追蹤
- 到期合約提醒

### 💰 繳費管理
- 應收款列表
- 逾期款項追蹤（紅色警示）
- 一鍵記錄繳費
- LINE 催繳通知發送
- 批次操作支援

### 🔔 續約提醒
- 分級顯示（緊急/重要/一般）
- 90 天內到期合約
- LINE 續約提醒發送

### 💼 佣金管理
- 待審核/可付款/已付款分類
- 佣金確認付款
- 事務所統計

### 📈 報表中心
- 營收報表（圖表+表格）
- 逾期報表
- 佣金報表
- CSV 匯出功能

### ⚙️ 系統設定
- 角色權限管理
- 通知設定
- API 連線狀態

## 🛠 技術棧

- **框架**: React 18 + Vite
- **樣式**: Tailwind CSS
- **狀態管理**: Zustand
- **API**: TanStack Query (React Query)
- **圖表**: Recharts
- **圖示**: Lucide React
- **UI 元件**: Headless UI

## 🚀 快速開始

### 安裝

```bash
cd /Users/daihaoting_1/Desktop/code/opus高級前端

# 安裝依賴
npm install

# 設定環境變數
cp .env.example .env
```

### 開發

```bash
npm run dev
```

開啟 http://localhost:3000

### 建置

```bash
npm run build
npm run preview
```

## 📁 專案結構

```
opus高級前端/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/          # 共用元件
│   │   ├── Layout.jsx       # 主框架（側邊欄+頂部導覽）
│   │   ├── DataTable.jsx    # 資料表格（搜尋、排序、分頁、匯出）
│   │   ├── Modal.jsx        # 對話框
│   │   ├── StatCard.jsx     # 統計卡片
│   │   ├── Badge.jsx        # 狀態徽章
│   │   └── Notifications.jsx # 通知系統
│   ├── pages/               # 頁面元件
│   │   ├── Dashboard.jsx    # 儀表板
│   │   ├── Customers.jsx    # 客戶列表
│   │   ├── CustomerDetail.jsx # 客戶詳情
│   │   ├── Contracts.jsx    # 合約管理
│   │   ├── Payments.jsx     # 繳費管理
│   │   ├── Renewals.jsx     # 續約提醒
│   │   ├── Commissions.jsx  # 佣金管理
│   │   ├── Reports.jsx      # 報表中心
│   │   └── Settings.jsx     # 系統設定
│   ├── hooks/
│   │   └── useApi.js        # API Hooks（React Query）
│   ├── services/
│   │   └── api.js           # API 客戶端
│   ├── store/
│   │   └── useStore.js      # 全域狀態（Zustand）
│   ├── App.jsx              # 路由設定
│   ├── main.jsx             # 應用程式入口
│   └── index.css            # Tailwind + 自訂樣式
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

## 🔌 API 連接

連接 Hour Jungle CRM MCP Server：

| 端點 | 說明 |
|------|------|
| `GET /health` | 健康檢查 |
| `GET /tools/list` | 列出所有 MCP 工具 |
| `POST /tools/call` | 執行 MCP 工具 |
| `GET /api/db/*` | PostgREST 資料庫查詢 |

## 👥 角色權限

| 角色 | 權限範圍 |
|------|----------|
| 管理員 | 全部功能 |
| 經理 | 儀表板、報表、客戶、合約、繳費 |
| 財務 | 繳費、報表、佣金 |
| 業務 | 客戶、合約、佣金 |
| 客服 | 客戶、繳費 |

## 📱 響應式設計

- 桌面版（1280px+）：完整側邊欄
- 平板（768px-1279px）：可收合側邊欄
- 手機（<768px）：底部導覽或漢堡選單

## 🎨 設計系統

### 顏色

- **Primary**: Blue (#3b82f6)
- **Jungle**: Green (#22c55e)
- **Success**: Green
- **Warning**: Yellow
- **Danger**: Red

### 元件

- 使用 Tailwind CSS 原子化 class
- 自訂元件樣式在 `index.css` 的 `@layer components`
- 統一的卡片、按鈕、表格樣式

## 📄 License

MIT
