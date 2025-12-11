import { useState, useRef, useEffect, useCallback } from 'react'
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
  Check,
  ChevronDown,
  Cpu,
  Wrench,
  Shield,
  AlertTriangle
} from 'lucide-react'
import { aiChatStream, getAIModels } from '../services/api'
import { useQuery } from '@tanstack/react-query'

// 寫入操作工具列表（需要確認）
const WRITE_TOOLS = [
  'crm_create_customer',
  'crm_update_customer',
  'crm_record_payment',
  'crm_payment_undo',
  'crm_create_contract',
  'commission_pay',
  'renewal_update_status',
  'renewal_batch_update',
  'line_send_message',
  'line_send_payment_reminder',
  'line_send_renewal_reminder',
  'invoice_create',
  'invoice_void',
  'invoice_allowance',
  'contract_generate_pdf'
]

// 工具名稱中文對照
const TOOL_NAMES = {
  crm_search_customers: '搜尋客戶',
  crm_get_customer_detail: '取得客戶詳情',
  crm_list_payments_due: '查詢應收款',
  crm_list_renewals_due: '查詢續約提醒',
  crm_create_customer: '建立客戶',
  crm_update_customer: '更新客戶',
  crm_record_payment: '記錄繳費',
  crm_payment_undo: '撤銷繳費',
  crm_create_contract: '建立合約',
  commission_pay: '佣金付款',
  renewal_update_status: '更新續約狀態',
  renewal_update_invoice_status: '更新發票狀態',
  renewal_get_summary: '取得續約統計',
  renewal_batch_update: '批次更新續約',
  line_send_message: '發送 LINE 訊息',
  line_send_payment_reminder: '發送繳費提醒',
  line_send_renewal_reminder: '發送續約提醒',
  report_revenue_summary: '營收報表',
  report_overdue_list: '逾期款報表',
  report_commission_due: '佣金報表',
  invoice_create: '開立發票',
  invoice_void: '作廢發票',
  invoice_query: '查詢發票',
  invoice_allowance: '開立折讓單',
  contract_generate_pdf: '生成合約 PDF',
  contract_preview: '預覽合約'
}

// localStorage 存儲 key
const CHAT_STORAGE_KEY = 'ai-assistant-chat-history'

// 預設歡迎訊息
const DEFAULT_MESSAGE = {
  role: 'assistant',
  content: '你好！我是 Hour Jungle CRM 助手。我可以幫你查詢客戶資料、繳費狀況、合約到期提醒等。有什麼可以幫你的嗎？'
}

// 從 localStorage 載入聊天記錄
const loadChatHistory = () => {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.error('載入聊天記錄失敗:', e)
  }
  return [DEFAULT_MESSAGE]
}

// 儲存聊天記錄到 localStorage
const saveChatHistory = (messages) => {
  try {
    // 限制最多保存 50 條訊息，避免 localStorage 超過容量
    const toSave = messages.slice(-50)
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave))
  } catch (e) {
    console.error('儲存聊天記錄失敗:', e)
  }
}

// 預設問題範例
const QUICK_PROMPTS = [
  { icon: Users, label: '查詢客戶', prompt: '幫我查詢客戶資料' },
  { icon: DollarSign, label: '逾期款項', prompt: '列出所有逾期的繳費記錄' },
  { icon: FileText, label: '即將到期', prompt: '哪些合約即將到期？' },
  { icon: Search, label: '營收統計', prompt: '這個月的營收是多少？' }
]

export default function AIAssistant() {
  const [messages, setMessages] = useState(loadChatHistory)
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(null)
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4')
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentTool, setCurrentTool] = useState(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [executedTools, setExecutedTools] = useState([]) // 本次對話執行的工具
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // 取得可用模型列表
  const { data: modelsData } = useQuery({
    queryKey: ['ai-models'],
    queryFn: getAIModels,
    staleTime: 1000 * 60 * 60 // 1 小時
  })

  // 自動滾動到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent])

  // 儲存聊天記錄到 localStorage
  useEffect(() => {
    saveChatHistory(messages)
  }, [messages])

  // 發送訊息（使用串流）
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsStreaming(true)
    setStreamingContent('')
    setCurrentTool(null)

    // 建立對話歷史
    const chatHistory = messages
      .slice(1)
      .map((m) => ({ role: m.role, content: m.content }))
    chatHistory.push({ role: 'user', content: userMessage })

    let fullContent = ''

    await aiChatStream(
      chatHistory,
      selectedModel,
      // onChunk
      (text) => {
        fullContent += text
        setStreamingContent(fullContent)
        setCurrentTool(null)
      },
      // onTool
      (toolName) => {
        setCurrentTool(toolName)
        // 記錄執行的工具
        setExecutedTools((prev) => {
          const isWrite = WRITE_TOOLS.includes(toolName)
          const newTool = {
            name: toolName,
            displayName: TOOL_NAMES[toolName] || toolName,
            isWrite,
            timestamp: new Date().toLocaleTimeString()
          }
          return [...prev, newTool]
        })
      },
      // onDone
      () => {
        setMessages((prev) => [...prev, { role: 'assistant', content: fullContent }])
        setStreamingContent('')
        setIsStreaming(false)
        setCurrentTool(null)
      },
      // onError
      (error) => {
        setMessages((prev) => [...prev, { role: 'assistant', content: `查詢失敗：${error}` }])
        setStreamingContent('')
        setIsStreaming(false)
        setCurrentTool(null)
      }
    )
  }, [input, isStreaming, messages, selectedModel])

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
          {/* 安全模式徽章 */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
            <Shield className="w-3.5 h-3.5" />
            確認模式
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 模型選擇器 */}
          <div className="relative">
            <select
              id="ai-model-selector"
              name="ai-model"
              aria-label="選擇 AI 模型"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="appearance-none pl-8 pr-8 py-1.5 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {modelsData?.models?.map((model) => (
                <option key={model.key} value={model.key}>
                  {model.name}
                </option>
              )) || (
                <>
                  <option value="claude-sonnet-4.5">Claude Sonnet 4.5</option>
                  <option value="claude-sonnet-4">Claude Sonnet 4</option>
                  <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                </>
              )}
            </select>
            <Cpu className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
          <button
            onClick={() => {
              setMessages([DEFAULT_MESSAGE])
              setExecutedTools([])
              localStorage.removeItem(CHAT_STORAGE_KEY)
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            清除對話
          </button>
        </div>
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

      {/* 執行的工具歷史 */}
      {executedTools.length > 0 && (
        <div className="py-2 px-3 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Wrench className="w-3 h-3" />
            <span>本次執行的工具：</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {executedTools.map((tool, index) => (
              <span
                key={index}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                  tool.isWrite
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
                title={`${tool.name} - ${tool.timestamp}`}
              >
                {tool.isWrite && <AlertTriangle className="w-3 h-3" />}
                {tool.displayName}
              </span>
            ))}
          </div>
        </div>
      )}

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
        {isStreaming && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 rounded-2xl px-4 py-3 max-w-[80%]">
              {currentTool ? (
                <div className={`flex items-center gap-2 ${WRITE_TOOLS.includes(currentTool) ? 'text-orange-600' : 'text-gray-500'}`}>
                  {WRITE_TOOLS.includes(currentTool) ? (
                    <AlertTriangle className="w-4 h-4 animate-pulse" />
                  ) : (
                    <Wrench className="w-4 h-4 animate-pulse" />
                  )}
                  <span className="text-sm">
                    正在執行 {TOOL_NAMES[currentTool] || currentTool}...
                    {WRITE_TOOLS.includes(currentTool) && ' (寫入操作)'}
                  </span>
                </div>
              ) : streamingContent ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900">
                  {streamingContent.split(/\*\*(.*?)\*\*/g).map((part, i) =>
                    i % 2 === 1 ? (
                      <strong key={i}>{part}</strong>
                    ) : (
                      <span key={i}>{part}</span>
                    )
                  )}
                  <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">正在思考...</span>
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex gap-3">
          <textarea
            id="ai-chat-input"
            name="ai-chat-input"
            aria-label="輸入問題"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // 只有在非輸入法選字狀態下，按 Enter（不含 Shift）才送出
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="輸入問題，例如：查詢王小明的資料（Shift+Enter 換行）"
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={1}
            disabled={isStreaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
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
