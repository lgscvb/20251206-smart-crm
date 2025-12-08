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
  Wrench
} from 'lucide-react'
import { aiChatStream, getAIModels } from '../services/api'
import { useQuery } from '@tanstack/react-query'

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
        </div>
        <div className="flex items-center gap-3">
          {/* 模型選擇器 */}
          <div className="relative">
            <select
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
                <div className="flex items-center gap-2 text-gray-500">
                  <Wrench className="w-4 h-4 animate-pulse" />
                  <span className="text-sm">正在執行 {currentTool}...</span>
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
