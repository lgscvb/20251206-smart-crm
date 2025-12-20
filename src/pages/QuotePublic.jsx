import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import QuotePDF from '../components/pdf/QuotePDF'

// 格式化金額
const formatCurrency = (amount) => {
  if (!amount) return '0'
  return Number(amount).toLocaleString('zh-TW')
}

export default function QuotePublic() {
  const { quoteNumber } = useParams()
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetchQuote()
  }, [quoteNumber])

  const fetchQuote = async () => {
    try {
      setLoading(true)
      // 直接查詢 PostgREST（不需要認證）
      const response = await fetch(`/api/db/v_quotes?quote_number=eq.${quoteNumber}`)
      if (!response.ok) {
        throw new Error('無法載入報價單')
      }
      const data = await response.json()
      if (data.length === 0) {
        throw new Error('找不到此報價單')
      }
      setQuote(data[0])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 下載 PDF
  const handleDownloadPdf = async () => {
    if (!quote) return

    setDownloading(true)
    try {
      const pdfData = {
        quote_number: quote.quote_number,
        valid_from: quote.valid_from,
        valid_until: quote.valid_until,
        branch_name: quote.branch_name || '台中館',
        plan_name: quote.plan_name,
        items: quote.items || [],
        deposit_amount: quote.deposit_amount || 0,
        total_amount: quote.total_amount || 0
      }

      const blob = await pdf(<QuotePDF data={pdfData} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `報價單_${quote.quote_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF 生成失敗:', err)
      alert('PDF 下載失敗，請稍後再試')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">無法載入報價單</h1>
          <p className="text-gray-600">{error}</p>
          <p className="text-gray-500 mt-4 text-sm">如有問題，請聯繫 Hour Jungle</p>
        </div>
      </div>
    )
  }

  // 分離簽約費用與代辦服務
  const items = quote.items || []
  const ownItems = items.filter(item => item.revenue_type !== 'referral')
  const referralItems = items.filter(item => item.revenue_type === 'referral')

  // 計算簽約應付金額
  const ownTotal = ownItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
  const depositAmount = parseFloat(quote.deposit_amount) || 0
  const signTotal = ownTotal + depositAmount

  // 檢查是否過期
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#2d5a27] text-white py-6">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-xs tracking-widest mb-1">HOUR JUNGLE</p>
          <h1 className="text-2xl font-bold">{quote.branch_name || '台中館'}報價單</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* 過期警示 */}
        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-center">
            <p className="text-red-700 font-medium">此報價單已過期</p>
            <p className="text-red-600 text-sm">請聯繫我們取得最新報價</p>
          </div>
        )}

        {/* 報價單資訊 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-sm text-gray-500">報價單號</p>
              <p className="font-mono font-medium">{quote.quote_number}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">有效期限</p>
              <p className={isExpired ? 'text-red-600' : 'text-gray-900'}>{quote.valid_until}</p>
            </div>
          </div>

          {quote.plan_name && (
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500">方案</p>
              <p className="font-medium text-gray-900">{quote.plan_name}</p>
            </div>
          )}
        </div>

        {/* 簽約應付款項 */}
        {(ownItems.length > 0 || depositAmount > 0) && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-4">
            <div className="bg-[#2d5a27] text-white px-6 py-3">
              <h2 className="font-bold">簽約應付款項</h2>
            </div>
            <div className="p-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm text-gray-600">服務項目</th>
                    <th className="text-right py-2 text-sm text-gray-600">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {ownItems.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 text-gray-800">
                        {item.name}
                        {item.quantity > 1 && item.unit && (
                          <span className="text-gray-500 text-sm"> ({item.quantity} {item.unit})</span>
                        )}
                      </td>
                      <td className="py-3 text-right font-mono">${formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                  {depositAmount > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="py-3 text-gray-800">押金</td>
                      <td className="py-3 text-right font-mono">${formatCurrency(depositAmount)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-green-50">
                    <td className="py-4 font-bold text-[#2d5a27]">簽約應付合計</td>
                    <td className="py-4 text-right font-bold text-[#2d5a27] text-xl font-mono">
                      ${formatCurrency(signTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* 代辦服務 */}
        {referralItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-4">
            <div className="bg-gray-600 text-white px-6 py-3">
              <h2 className="font-bold">代辦服務</h2>
              <p className="text-xs text-gray-300">費用於服務完成後收取</p>
            </div>
            <div className="p-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-sm text-gray-600">服務項目</th>
                    <th className="text-right py-2 text-sm text-gray-600">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {referralItems.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 text-gray-800">{item.name}</td>
                      <td className="py-3 text-right font-mono text-gray-600">
                        {item.billing_cycle !== 'one_time' && item.unit_price > 0
                          ? `$${formatCurrency(item.unit_price)}/月`
                          : `$${formatCurrency(item.amount)}`
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 銀行資訊 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
          <h3 className="font-bold text-gray-800 mb-4">匯款資訊</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">帳戶名稱</span>
              <span className="text-gray-800">你的空間有限公司</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">銀行名稱</span>
              <span className="text-gray-800">永豐商業銀行(南台中分行)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">行庫代號</span>
              <span className="text-gray-800 font-mono">807</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">帳號</span>
              <span className="text-gray-800 font-mono">03801800183399</span>
            </div>
          </div>
        </div>

        {/* 下載按鈕 */}
        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="w-full bg-[#2d5a27] text-white py-4 rounded-lg font-bold text-lg hover:bg-[#234a1f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {downloading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              生成 PDF 中...
            </span>
          ) : (
            '下載 PDF 報價單'
          )}
        </button>

        {/* 聯絡資訊 */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>如有任何問題，歡迎聯繫我們</p>
          <p className="mt-1">
            <a href="mailto:wtxg@hourjungle.com" className="text-[#2d5a27] hover:underline">wtxg@hourjungle.com</a>
            {' | '}
            <a href="tel:04-23760282" className="text-[#2d5a27] hover:underline">04-2376-0282</a>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 py-4 mt-8">
        <div className="max-w-2xl mx-auto px-4 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Hour Jungle. All rights reserved.</p>
          <p className="mt-1">本報價不包含銀行匯款手續費</p>
        </div>
      </footer>
    </div>
  )
}
