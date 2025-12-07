import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Bot,
  Send,
  User,
  Loader2,
  Sparkles,
  Search,
  FileText,
  DollarSign,
  Users,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react'
import { callTool } from '../services/api'

// 預設問題範例
const QUICK_PROMPTS = [
  { icon: Users, label: '查詢客戶', prompt: '幫我查詢客戶資料' },
  { icon: DollarSign, label: '逾期款項', prompt: '列出所有逾期的繳費記錄' },
  { icon: FileText, label: '即將到期', prompt: '哪些合約即將到期？' },
  { icon: Search, label: '營收統計', prompt: '這個月的營收是多少？' }
]

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '你好！我是 Hour Jungle CRM 助手。我可以幫你查詢客戶資料、繳費狀況、合約到期提醒等。有什麼可以幫你的嗎？'
    }
  ])
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // 自動滾動到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 處理 AI 回應
  const chatMutation = useMutation({
    mutationFn: async (userMessage) => {
      // 分析用戶意圖並調用對應工具
      const lowerMsg = userMessage.toLowerCase()

      // 查詢客戶
      if (lowerMsg.includes('客戶') || lowerMsg.includes('查詢')) {
        const match = userMessage.match(/查詢.*?[「「](.+?)[」」]/) ||
          userMessage.match(/(.+?)的資料/) ||
          userMessage.match(/客戶(.+)/)
        if (match) {
          const result = await callTool('crm_search_customers', { query: match[1].trim() })
          return formatCustomerResult(result)
        }
        const result = await callTool('crm_search_customers', { limit: 10 })
        return formatCustomerResult(result)
      }

      // 逾期查詢
      if (lowerMsg.includes('逾期') || lowerMsg.includes('overdue')) {
        const result = await callTool('report_overdue_list', {})
        return formatOverdueResult(result)
      }

      // 合約到期
      if (lowerMsg.includes('到期') || lowerMsg.includes('續約')) {
        const result = await callTool('crm_get_renewal_reminders', { days: 30 })
        return formatRenewalResult(result)
      }

      // 營收
      if (lowerMsg.includes('營收') || lowerMsg.includes('收入')) {
        const result = await callTool('report_revenue_summary', {})
        return formatRevenueResult(result)
      }

      // 待繳
      if (lowerMsg.includes('待繳') || lowerMsg.includes('應收')) {
        const result = await callTool('crm_get_payments_due', {})
        return formatPaymentsResult(result)
      }

      // 預設回應
      return '我可以幫你做以下事情：\n\n' +
        '1. **查詢客戶** - 例如「查詢王小明的資料」\n' +
        '2. **逾期款項** - 例如「列出逾期的繳費」\n' +
        '3. **到期合約** - 例如「哪些合約快到期」\n' +
        '4. **營收統計** - 例如「這個月營收多少」\n' +
        '5. **待繳款項** - 例如「有哪些待繳款」\n\n' +
        '請問需要查詢什麼？'
    },
    onSuccess: (response) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: response }])
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `查詢失敗：${error.message}` }
      ])
    }
  })

  // 格式化結果
  const formatCustomerResult = (result) => {
    if (!result?.success || !result?.data?.length) {
      return '沒有找到相關客戶資料。'
    }
    const customers = result.data.slice(0, 5)
    let text = `找到 ${result.total || customers.length} 位客戶：\n\n`
    customers.forEach((c, i) => {
      text += `**${i + 1}. ${c.name}**\n`
      if (c.company_name) text += `   公司：${c.company_name}\n`
      if (c.phone) text += `   電話：${c.phone}\n`
      text += `   狀態：${c.status === 'active' ? '有效' : c.status}\n\n`
    })
    return text
  }

  const formatOverdueResult = (result) => {
    if (!result?.success || !result?.data?.items?.length) {
      return '目前沒有逾期的繳費記錄。'
    }
    const { total_count, total_amount, items } = result.data
    let text = `**逾期統計**\n\n`
    text += `- 逾期筆數：${total_count} 筆\n`
    text += `- 逾期總額：$${total_amount?.toLocaleString() || 0}\n\n`
    text += `**逾期明細（前5筆）**\n\n`
    items.slice(0, 5).forEach((item, i) => {
      text += `${i + 1}. ${item.customer_name} - $${item.total_due?.toLocaleString() || 0}（逾期 ${item.days_overdue} 天）\n`
    })
    return text
  }

  const formatRenewalResult = (result) => {
    if (!result?.success || !result?.data?.length) {
      return '30 天內沒有即將到期的合約。'
    }
    let text = `**即將到期的合約（30天內）**\n\n`
    result.data.slice(0, 10).forEach((item, i) => {
      text += `${i + 1}. ${item.customer_name} - ${item.days_remaining} 天後到期\n`
    })
    return text
  }

  const formatRevenueResult = (result) => {
    if (!result?.success || !result?.data?.length) {
      return '目前沒有營收資料。'
    }
    let text = `**營收統計**\n\n`
    result.data.forEach((branch) => {
      text += `**${branch.branch_name}**\n`
      text += `- 已收款：$${branch.total_collected?.toLocaleString() || 0}\n`
      text += `- 待收款：$${branch.total_pending?.toLocaleString() || 0}\n\n`
    })
    return text
  }

  const formatPaymentsResult = (result) => {
    if (!result?.success || !result?.data?.length) {
      return '目前沒有待繳款項。'
    }
    let text = `**待繳款項（前10筆）**\n\n`
    result.data.slice(0, 10).forEach((item, i) => {
      text += `${i + 1}. ${item.customer_name} - $${item.amount?.toLocaleString() || 0}（${item.payment_period}）\n`
    })
    return text
  }

  // 發送訊息
  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return

    const userMessage = input.trim()
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setInput('')
    chatMutation.mutate(userMessage)
  }

  // 複製訊息
  const handleCopy = (content, index) => {
    navigator.clipboard.writeText(content)
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }

  // 快速提問
  const handleQuickPrompt = (prompt) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI 助手</h1>
            <p className="text-sm text-gray-500">CRM 智能查詢助手</p>
          </div>
        </div>
        <button
          onClick={() => setMessages([messages[0]])}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className="w-4 h-4" />
          清除對話
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="py-4 border-b border-gray-100">
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((item, index) => (
            <button
              key={index}
              onClick={() => handleQuickPrompt(item.prompt)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={`relative max-w-[80%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content.split(/\*\*(.*?)\*\*/g).map((part, i) =>
                  i % 2 === 1 ? (
                    <strong key={i}>{part}</strong>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
              {message.role === 'assistant' && index > 0 && (
                <button
                  onClick={() => handleCopy(message.content, index)}
                  className="absolute -right-8 top-2 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  {copied === index ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {chatMutation.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">正在查詢...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="輸入問題，例如：查詢王小明的資料"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={chatMutation.isPending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400 text-center">
          AI 助手會直接查詢 CRM 資料庫，回覆僅供參考
        </p>
      </div>
    </div>
  )
}
