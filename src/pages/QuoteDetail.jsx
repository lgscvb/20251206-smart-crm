import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { callTool, db } from '../services/api'
import { pdf } from '@react-pdf/renderer'
import QuotePDF from '../components/pdf/QuotePDF'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import useStore from '../store/useStore'
import {
  ArrowLeft,
  FileText,
  User,
  Building,
  Calendar,
  DollarSign,
  Send,
  CheckCircle,
  XCircle,
  ArrowRightCircle,
  Loader2,
  RefreshCw,
  FileDown,
  MessageCircle,
  Trash2
} from 'lucide-react'

// 狀態中文對照
const STATUS_LABELS = {
  draft: '草稿',
  sent: '已發送',
  viewed: '已檢視',
  accepted: '已接受',
  rejected: '已拒絕',
  expired: '已過期',
  converted: '已轉換'
}

// 狀態顏色
const STATUS_VARIANTS = {
  draft: 'gray',
  sent: 'info',
  viewed: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'gray',
  converted: 'success'
}

// 合約類型
const CONTRACT_TYPES = {
  virtual_office: '營業登記',
  office: '辦公室',
  hot_desk: '共享辦公位',
  meeting_room: '會議室',
  custom: '自訂'
}

export default function QuoteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [sendingToLine, setSendingToLine] = useState(false)

  // 取得報價單詳情
  const { data: quoteData, isLoading, refetch } = useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      // 使用 PostgREST 直接查詢報價單，並聯結分館資訊
      const quotes = await db.query('quotes', {
        id: `eq.${id}`,
        select: '*,branches(name)'
      })
      if (quotes && quotes.length > 0) {
        const quote = quotes[0]
        // 將 branches.name 映射到 branch_name
        return {
          ...quote,
          branch_name: quote.branches?.name || null
        }
      }
      return null
    }
  })

  const quote = quoteData

  // 更新報價單狀態
  const updateStatus = useMutation({
    mutationFn: ({ status }) => callTool('quote_update_status', { quote_id: parseInt(id), status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    }
  })

  // 發送到 LINE
  const sendToLine = useMutation({
    mutationFn: () => callTool('quote_send_to_line', { quote_id: parseInt(id), line_user_id: quote?.line_user_id }),
    onSuccess: (response) => {
      const result = response?.result || response
      if (result?.success) {
        addNotification({ type: 'success', message: result.message || '報價單已發送到 LINE' })
        queryClient.invalidateQueries({ queryKey: ['quote', id] })
      } else {
        addNotification({ type: 'error', message: result?.message || '發送失敗' })
      }
      setSendingToLine(false)
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `LINE 發送失敗：${error.message}` })
      setSendingToLine(false)
    }
  })

  // 刪除報價單
  const deleteQuote = useMutation({
    mutationFn: () => callTool('quote_delete', { quote_id: parseInt(id) }),
    onSuccess: () => {
      navigate('/quotes')
    }
  })

  // 生成 PDF
  const handleGeneratePdf = async () => {
    if (!quote) return
    setGeneratingPdf(true)

    try {
      const pdfData = {
        quote_number: quote.quote_number,
        valid_from: quote.valid_from,
        valid_until: quote.valid_until,
        branch_name: quote.branch_name || '台中館',
        plan_name: quote.plan_name,
        items: typeof quote.items === 'string' ? JSON.parse(quote.items) : (quote.items || []),
        deposit_amount: quote.deposit_amount ?? 6000,
        total_amount: quote.total_amount || 0,
        bank_account_name: '你的空間有限公司',
        bank_name: '永豐商業銀行(南台中分行)',
        bank_code: '807',
        bank_account_number: '03801800183399',
        contact_email: 'wtxg@hourjungle.com',
        contact_phone: '04-23760282'
      }

      const blob = await pdf(<QuotePDF data={pdfData} />).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (error) {
      console.error('生成報價單 PDF 失敗:', error)
      alert('生成報價單 PDF 失敗: ' + (error.message || '未知錯誤'))
    } finally {
      setGeneratingPdf(false)
    }
  }

  // 解析 items 並分類
  const items = useMemo(() => {
    if (!quote?.items) return []
    return typeof quote.items === 'string' ? JSON.parse(quote.items) : quote.items
  }, [quote?.items])

  // 分離自己收款項目和代辦服務
  const { ownItems, referralItems, ownSubtotal, referralSubtotal, signTotal } = useMemo(() => {
    const own = items.filter(item => item.revenue_type !== 'referral')
    const referral = items.filter(item => item.revenue_type === 'referral')
    const ownSum = own.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
    const referralSum = referral.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
    const deposit = parseFloat(quote?.deposit_amount) || 0
    return {
      ownItems: own,
      referralItems: referral,
      ownSubtotal: ownSum,
      referralSubtotal: referralSum,
      signTotal: ownSum + deposit  // 簽約應付 = 自己收款項目 + 押金
    }
  }, [items, quote?.deposit_amount])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">找不到報價單資料</p>
        <button onClick={() => navigate('/quotes')} className="btn-primary">
          返回報價單列表
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 頂部導覽 */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/quotes')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{quote.quote_number}</h1>
            <Badge variant={STATUS_VARIANTS[quote.status]}>
              {STATUS_LABELS[quote.status] || quote.status}
            </Badge>
            {quote.line_user_id && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                <MessageCircle className="w-3 h-3" />
                LINE 詢問
              </span>
            )}
          </div>
          <p className="text-gray-500">
            {quote.plan_name || CONTRACT_TYPES[quote.contract_type] || '報價單'}
          </p>
        </div>
        <button onClick={refetch} className="btn-secondary" title="重新整理">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={handleGeneratePdf}
          disabled={generatingPdf}
          className="btn-primary"
        >
          {generatingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <FileDown className="w-4 h-4 mr-2" />
          )}
          {generatingPdf ? '生成中...' : '下載 PDF'}
        </button>
      </div>

      {/* 主要內容 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側：客戶與方案資訊 */}
        <div className="space-y-6">
          {/* 客戶資訊 */}
          <div className="card">
            <h3 className="card-title flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-primary-500" />
              客戶資訊
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">姓名</p>
                <p className="font-medium">{quote.customer_name || '-'}</p>
              </div>
              {quote.company_name && (
                <div>
                  <p className="text-sm text-gray-500">公司名稱</p>
                  <p className="font-medium">{quote.company_name}</p>
                </div>
              )}
              {quote.customer_phone && (
                <div>
                  <p className="text-sm text-gray-500">電話</p>
                  <p className="font-medium">{quote.customer_phone}</p>
                </div>
              )}
              {quote.customer_email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{quote.customer_email}</p>
                </div>
              )}
            </div>
          </div>

          {/* 場館資訊 */}
          <div className="card">
            <h3 className="card-title flex items-center gap-2 mb-4">
              <Building className="w-5 h-5 text-blue-500" />
              場館
            </h3>
            <p className="font-medium">{quote.branch_name || '-'}</p>
          </div>

          {/* 有效期限 */}
          <div className="card">
            <h3 className="card-title flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-orange-500" />
              有效期限
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">開始日期</span>
                <span className="font-medium">{quote.valid_from}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">截止日期</span>
                <span className="font-medium">{quote.valid_until}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">合約月數</span>
                <span className="font-medium">{quote.contract_months} 個月</span>
              </div>
            </div>
          </div>
        </div>

        {/* 右側：費用明細和操作 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 費用明細 */}
          <div className="card">
            <h3 className="card-title flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-green-500" />
              費用明細
            </h3>

            {/* 簽約應付款項 */}
            {(ownItems.length > 0 || quote.deposit_amount > 0) && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  簽約應付款項
                </h4>
                <div className="border border-green-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-green-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-green-700">項目</th>
                        <th className="px-4 py-2 text-right text-green-700">數量</th>
                        <th className="px-4 py-2 text-right text-green-700">單價</th>
                        <th className="px-4 py-2 text-right text-green-700">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ownItems.map((item, i) => (
                        <tr key={i} className="border-t border-green-100">
                          <td className="px-4 py-2">{item.name}</td>
                          <td className="px-4 py-2 text-right">{item.quantity} {item.unit}</td>
                          <td className="px-4 py-2 text-right">${item.unit_price?.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-medium">${item.amount?.toLocaleString()}</td>
                        </tr>
                      ))}
                      {quote.deposit_amount > 0 && (
                        <tr className="border-t border-green-100 bg-orange-50">
                          <td className="px-4 py-2 text-orange-700">押金</td>
                          <td className="px-4 py-2 text-right">1</td>
                          <td className="px-4 py-2 text-right">${quote.deposit_amount?.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-medium text-orange-700">${quote.deposit_amount?.toLocaleString()}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-green-100">
                      <tr>
                        <td colSpan="3" className="px-4 py-2 text-right font-semibold text-green-800">簽約應付合計</td>
                        <td className="px-4 py-2 text-right text-lg font-bold text-green-700">${signTotal.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* 代辦服務（如有） */}
            {referralItems.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  代辦服務
                  <span className="text-xs font-normal text-gray-400">（費用於服務完成後收取）</span>
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-gray-600">項目</th>
                        <th className="px-4 py-2 text-right text-gray-600">數量</th>
                        <th className="px-4 py-2 text-right text-gray-600">單價</th>
                        <th className="px-4 py-2 text-right text-gray-600">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralItems.map((item, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-4 py-2 text-gray-600">{item.name}</td>
                          <td className="px-4 py-2 text-right text-gray-600">{item.quantity} {item.unit}</td>
                          <td className="px-4 py-2 text-right text-gray-600">${item.unit_price?.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-medium text-gray-600">${item.amount?.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td colSpan="3" className="px-4 py-2 text-right font-semibold text-gray-600">代辦服務合計</td>
                        <td className="px-4 py-2 text-right font-bold text-gray-600">${referralSubtotal.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {items.length === 0 && (
              <p className="text-gray-500 mb-4">無費用明細</p>
            )}

            {/* 總計提示 */}
            {quote.discount_amount > 0 && (
              <div className="text-sm text-gray-500 text-right">
                已折扣 ${quote.discount_amount.toLocaleString()}
              </div>
            )}
          </div>

          {/* 備註 */}
          {quote.internal_notes && (
            <div className="card">
              <h3 className="card-title mb-2">內部備註</h3>
              <p className="text-gray-600">{quote.internal_notes}</p>
            </div>
          )}

          {/* 操作按鈕 */}
          <div className="card">
            <h3 className="card-title mb-4">操作</h3>
            <div className="flex flex-wrap gap-3">
              {quote.status === 'draft' && (
                <>
                  {quote.line_user_id && (
                    <button
                      onClick={() => {
                        if (confirm('確定要發送報價單給客戶的 LINE？')) {
                          setSendingToLine(true)
                          sendToLine.mutate()
                        }
                      }}
                      disabled={sendingToLine}
                      className="btn-success"
                    >
                      {sendingToLine ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <MessageCircle className="w-4 h-4 mr-2" />
                      )}
                      發送到 LINE
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus.mutate({ status: 'sent' })}
                    disabled={updateStatus.isPending}
                    className="btn-primary"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    標記為已發送
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('確定要刪除此報價單？')) {
                        deleteQuote.mutate()
                      }
                    }}
                    disabled={deleteQuote.isPending}
                    className="btn-danger"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    刪除
                  </button>
                </>
              )}
              {quote.status === 'sent' && (
                <>
                  <button
                    onClick={() => updateStatus.mutate({ status: 'accepted' })}
                    disabled={updateStatus.isPending}
                    className="btn-success"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    客戶已接受
                  </button>
                  <button
                    onClick={() => updateStatus.mutate({ status: 'rejected' })}
                    disabled={updateStatus.isPending}
                    className="btn-danger"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    客戶已拒絕
                  </button>
                </>
              )}
              {quote.status === 'accepted' && (
                <button
                  onClick={() => navigate(`/contracts/new?from_quote=${id}`)}
                  className="btn-primary bg-purple-600 hover:bg-purple-700"
                >
                  <ArrowRightCircle className="w-4 h-4 mr-2" />
                  轉換為合約
                </button>
              )}
              {quote.status === 'converted' && (
                <p className="text-gray-500">此報價單已轉換為合約</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
