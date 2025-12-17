import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Font } from '@react-pdf/renderer'
import { Buffer } from 'buffer'
import App from './App'
import './index.css'

// @react-pdf/renderer 需要 Buffer polyfill
window.Buffer = Buffer

// 註冊 PDF 中文字體（在應用入口統一註冊，避免重複）
Font.register({
  family: 'NotoSansTC',
  fonts: [
    { src: '/fonts/NotoSansTC-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/NotoSansTC-Bold.ttf', fontWeight: 'bold' }
  ]
})

// 平面圖用的完整字體（需要顯示所有租戶公司名稱）
Font.register({
  family: 'NotoSansTCFull',
  fonts: [
    { src: '/fonts/NotoSansTC-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/NotoSansTC-Bold.ttf', fontWeight: 'bold' }
  ]
})

// 中文斷行處理
Font.registerHyphenationCallback(word => {
  if (/[\u4e00-\u9fa5]/.test(word)) {
    return word.split('')
  }
  return [word]
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
