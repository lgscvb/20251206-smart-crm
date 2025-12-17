import { useState } from 'react'
import {
  useLegalLetterCandidates,
  useLegalLetterPending,
  useGenerateLegalContent,
  useCreateLegalLetter,
  useGenerateLegalPdf,
  useUpdateLegalStatus
} from '../hooks/useApi'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge, { StatusBadge } from '../components/Badge'
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Send,
  FileDown,
  Loader2,
  Eye,
  Edit3,
  Truck,
  XCircle
} from 'lucide-react'

// 狀態標籤
const STATUS_CONFIG = {
  draft: { label: '草稿', color: 'warning' },
  approved: { label: '已審核', color: 'info' },
  sent: { label: '已寄送', color: 'success' },
  cancelled: { label: '已取消', color: 'default' }
}

// 緊急度標籤
const URGENCY_CONFIG = {
  critical: { label: '緊急', color: 'danger' },
  high: { label: '高', color: 'warning' },
  medium: { label: '中', color: 'info' }
}

export default function LegalLetters() {
  const [activeTab, setActiveTab] = useState('candidates')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showContentModal, setShowContentModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [selectedLetter, setSelectedLetter] = useState(null)
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusForm, setStatusForm] = useState({
    status: '',
    approvedBy: '',
    trackingNumber: '',
    notes: ''
  })

  // Queries
  const { data: candidates = [], isLoading: candidatesLoading, refetch: refetchCandidates } = useLegalLetterCandidates()
  const { data: pendingLetters = [], isLoading: pendingLoading, refetch: refetchPending } = useLegalLetterPending()

  // Mutations
  const generateContent = useGenerateLegalContent()
  const createLetter = useCreateLegalLetter()
  const generatePdf = useGenerateLegalPdf()
  const updateStatus = useUpdateLegalStatus()

  // 處理生成存證信函內容
  const handleGenerateContent = async (candidate) => {
    setSelectedCandidate(candidate)
    setIsGenerating(true)
    setShowCreateModal(true)

    try {
      const result = await generateContent.mutateAsync({
        payment_id: candidate.payment_id,
        customer_name: candidate.customer_name,
        company_name: candidate.company_name,
        address: candidate.legal_address,
        overdue_amount: candidate.overdue_amount,
        overdue_days: candidate.days_overdue,
        contract_number: candidate.contract_number,
        reminder_count: candidate.reminder_count,
        branch_name: candidate.branch_name
      })

      if (result.success && result.result?.content) {
        setGeneratedContent(result.result.content)
      }
    } catch (error) {
      console.error('生成失敗:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  // 處理建立存證信函
  const handleCreateLetter = async () => {
    if (!selectedCandidate || !generatedContent) return

    try {
      await createLetter.mutateAsync({
        paymentId: selectedCandidate.payment_id,
        content: generatedContent,
        recipientName: selectedCandidate.company_name || selectedCandidate.customer_name,
        recipientAddress: selectedCandidate.legal_address
      })

      setShowCreateModal(false)
      setGeneratedContent('')
      setSelectedCandidate(null)
      refetchCandidates()
      refetchPending()
    } catch (error) {
      console.error('建立失敗:', error)
    }
  }

  // 處理生成 PDF
  const handleGeneratePdf = async (letter) => {
    try {
      const result = await generatePdf.mutateAsync(letter.id)
      if (result.success && result.result?.pdf_url) {
        window.open(result.result.pdf_url, '_blank')
      }
      refetchPending()
    } catch (error) {
      console.error('PDF 生成失敗:', error)
    }
  }

  // 處理更新狀態
  const handleUpdateStatus = async () => {
    if (!selectedLetter) return

    try {
      await updateStatus.mutateAsync({
        letterId: selectedLetter.id,
        status: statusForm.status,
        approvedBy: statusForm.approvedBy,
        trackingNumber: statusForm.trackingNumber,
        notes: statusForm.notes
      })

      setShowStatusModal(false)
      setStatusForm({ status: '', approvedBy: '', trackingNumber: '', notes: '' })
      setSelectedLetter(null)
      refetchPending()
    } catch (error) {
      console.error('更新失敗:', error)
    }
  }

  // 打開狀態更新 Modal
  const openStatusModal = (letter, newStatus) => {
    setSelectedLetter(letter)
    setStatusForm({ ...statusForm, status: newStatus })
    setShowStatusModal(true)
  }

  // 候選客戶表格欄位
  const candidateColumns = [
    {
      key: 'customer_name',
      label: '客戶',
      render: (row) => (
        <div>
          <div className="font-medium">{row.customer_name}</div>
          {row.company_name && (
            <div className="text-sm text-gray-500">{row.company_name}</div>
          )}
        </div>
      )
    },
    {
      key: 'overdue_amount',
      label: '逾期金額',
      render: (row) => (
        <span className="font-semibold text-red-600">
          ${row.overdue_amount?.toLocaleString()}
        </span>
      )
    },
    {
      key: 'days_overdue',
      label: '逾期天數',
      render: (row) => (
        <span className="font-medium">{row.days_overdue} 天</span>
      )
    },
    {
      key: 'reminder_count',
      label: '催繳次數',
      render: (row) => (
        <Badge color="warning">{row.reminder_count} 次</Badge>
      )
    },
    {
      key: 'urgency_level',
      label: '緊急度',
      render: (row) => {
        const config = URGENCY_CONFIG[row.urgency_level] || {}
        return <StatusBadge status={config.color}>{config.label || row.urgency_level}</StatusBadge>
      }
    },
    {
      key: 'branch_name',
      label: '分館'
    }
  ]

  // 待處理存證信函表格欄位
  const pendingColumns = [
    {
      key: 'letter_number',
      label: '編號',
      render: (row) => (
        <span className="font-mono text-sm">{row.letter_number}</span>
      )
    },
    {
      key: 'recipient_name',
      label: '收件人',
      render: (row) => (
        <div>
          <div className="font-medium">{row.recipient_name}</div>
          <div className="text-sm text-gray-500 truncate max-w-48">
            {row.recipient_address}
          </div>
        </div>
      )
    },
    {
      key: 'overdue_amount',
      label: '逾期金額',
      render: (row) => (
        <span className="font-semibold text-red-600">
          ${row.overdue_amount?.toLocaleString()}
        </span>
      )
    },
    {
      key: 'status',
      label: '狀態',
      render: (row) => {
        const config = STATUS_CONFIG[row.status] || {}
        return <StatusBadge status={config.color}>{config.label || row.status}</StatusBadge>
      }
    },
    {
      key: 'pdf_path',
      label: 'PDF',
      render: (row) => (
        row.pdf_path ? (
          <Badge color="success">已生成</Badge>
        ) : (
          <Badge color="default">未生成</Badge>
        )
      )
    },
    {
      key: 'created_at',
      label: '建立時間',
      render: (row) => new Date(row.created_at).toLocaleDateString('zh-TW')
    }
  ]

  // 候選客戶操作按鈕
  const candidateActions = (row) => (
    <button
      onClick={() => handleGenerateContent(row)}
      className="btn btn-sm btn-primary flex items-center gap-1"
    >
      <FileText className="w-4 h-4" />
      建立存證信函
    </button>
  )

  // 待處理存證信函操作按鈕
  const pendingActions = (row) => (
    <div className="flex gap-2">
      {/* 查看內容 */}
      <button
        onClick={() => {
          setSelectedLetter(row)
          setShowContentModal(true)
        }}
        className="btn btn-sm btn-ghost"
        title="查看內容"
      >
        <Eye className="w-4 h-4" />
      </button>

      {/* 生成 PDF */}
      {row.status !== 'cancelled' && (
        <button
          onClick={() => handleGeneratePdf(row)}
          className="btn btn-sm btn-outline"
          title="生成 PDF"
          disabled={generatePdf.isPending}
        >
          <FileDown className="w-4 h-4" />
        </button>
      )}

      {/* 狀態操作 */}
      {row.status === 'draft' && (
        <button
          onClick={() => openStatusModal(row, 'approved')}
          className="btn btn-sm btn-success"
          title="審核通過"
        >
          <CheckCircle className="w-4 h-4" />
        </button>
      )}

      {row.status === 'approved' && (
        <button
          onClick={() => openStatusModal(row, 'sent')}
          className="btn btn-sm btn-primary"
          title="標記已寄送"
        >
          <Truck className="w-4 h-4" />
        </button>
      )}

      {row.status !== 'sent' && row.status !== 'cancelled' && (
        <button
          onClick={() => openStatusModal(row, 'cancelled')}
          className="btn btn-sm btn-ghost text-red-500"
          title="取消"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">存證信函</h1>
          <p className="text-gray-500 mt-1">
            管理逾期催繳無效的客戶存證信函
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { refetchCandidates(); refetchPending() }}
            className="btn btn-outline"
          >
            重新整理
          </button>
        </div>
      </div>

      {/* Tab 切換 */}
      <div className="tabs tabs-boxed">
        <button
          className={`tab ${activeTab === 'candidates' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('candidates')}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          候選客戶
          {candidates.length > 0 && (
            <Badge color="danger" className="ml-2">{candidates.length}</Badge>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'pending' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <FileText className="w-4 h-4 mr-2" />
          待處理
          {pendingLetters.length > 0 && (
            <Badge color="info" className="ml-2">{pendingLetters.length}</Badge>
          )}
        </button>
      </div>

      {/* 候選客戶列表 */}
      {activeTab === 'candidates' && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">
              <AlertTriangle className="w-5 h-5 text-warning" />
              候選客戶（逾期 &gt; 14 天 且 催繳 &ge; 5 次）
            </h2>

            {candidatesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-success" />
                <p>目前沒有符合條件的客戶</p>
              </div>
            ) : (
              <DataTable
                data={candidates}
                columns={candidateColumns}
                actions={candidateActions}
                searchable
                searchKeys={['customer_name', 'company_name', 'contract_number']}
              />
            )}
          </div>
        </div>
      )}

      {/* 待處理存證信函列表 */}
      {activeTab === 'pending' && (
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">
              <FileText className="w-5 h-5 text-info" />
              待處理存證信函
            </h2>

            {pendingLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : pendingLetters.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>目前沒有待處理的存證信函</p>
              </div>
            ) : (
              <DataTable
                data={pendingLetters}
                columns={pendingColumns}
                actions={pendingActions}
                searchable
                searchKeys={['letter_number', 'recipient_name', 'customer_name']}
              />
            )}
          </div>
        </div>
      )}

      {/* 建立存證信函 Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setGeneratedContent('')
          setSelectedCandidate(null)
        }}
        title="建立存證信函"
        size="lg"
      >
        {selectedCandidate && (
          <div className="space-y-4">
            {/* 客戶資訊 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">收件人資訊</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">姓名：</span>
                  {selectedCandidate.company_name || selectedCandidate.customer_name}
                </div>
                <div>
                  <span className="text-gray-500">逾期金額：</span>
                  <span className="text-red-600 font-semibold">
                    ${selectedCandidate.overdue_amount?.toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">地址：</span>
                  {selectedCandidate.legal_address || '（未設定）'}
                </div>
              </div>
            </div>

            {/* 生成的內容 */}
            <div>
              <label className="label">
                <span className="label-text font-semibold">存證信函內容</span>
                {isGenerating && (
                  <span className="label-text-alt flex items-center gap-1">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 生成中...
                  </span>
                )}
              </label>
              <textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                className="textarea textarea-bordered w-full h-64"
                placeholder={isGenerating ? '正在生成存證信函內容...' : '請先點擊生成按鈕'}
                disabled={isGenerating}
              />
            </div>

            {/* 操作按鈕 */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setGeneratedContent('')
                  setSelectedCandidate(null)
                }}
                className="btn btn-ghost"
              >
                取消
              </button>
              <button
                onClick={handleCreateLetter}
                className="btn btn-primary"
                disabled={!generatedContent || createLetter.isPending}
              >
                {createLetter.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 建立中...</>
                ) : (
                  <><FileText className="w-4 h-4" /> 建立存證信函</>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 查看內容 Modal */}
      <Modal
        open={showContentModal}
        onClose={() => {
          setShowContentModal(false)
          setSelectedLetter(null)
        }}
        title={`存證信函 ${selectedLetter?.letter_number || ''}`}
        size="lg"
      >
        {selectedLetter && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">收件人：</span>
                  {selectedLetter.recipient_name}
                </div>
                <div>
                  <span className="text-gray-500">逾期金額：</span>
                  <span className="text-red-600 font-semibold">
                    ${selectedLetter.overdue_amount?.toLocaleString()}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">地址：</span>
                  {selectedLetter.recipient_address}
                </div>
              </div>
            </div>

            <div className="prose max-w-none whitespace-pre-wrap bg-white p-4 border rounded-lg max-h-96 overflow-y-auto">
              {selectedLetter.content}
            </div>
          </div>
        )}
      </Modal>

      {/* 更新狀態 Modal */}
      <Modal
        open={showStatusModal}
        onClose={() => {
          setShowStatusModal(false)
          setStatusForm({ status: '', approvedBy: '', trackingNumber: '', notes: '' })
          setSelectedLetter(null)
        }}
        title={`更新狀態 - ${selectedLetter?.letter_number || ''}`}
      >
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm">
              將狀態從 <StatusBadge status={STATUS_CONFIG[selectedLetter?.status]?.color}>
                {STATUS_CONFIG[selectedLetter?.status]?.label}
              </StatusBadge> 更新為 <StatusBadge status={STATUS_CONFIG[statusForm.status]?.color}>
                {STATUS_CONFIG[statusForm.status]?.label}
              </StatusBadge>
            </p>
          </div>

          {statusForm.status === 'approved' && (
            <div>
              <label className="label">
                <span className="label-text">審核人</span>
              </label>
              <input
                type="text"
                value={statusForm.approvedBy}
                onChange={(e) => setStatusForm({ ...statusForm, approvedBy: e.target.value })}
                className="input input-bordered w-full"
                placeholder="請輸入審核人姓名"
              />
            </div>
          )}

          {statusForm.status === 'sent' && (
            <div>
              <label className="label">
                <span className="label-text">郵局掛號號碼</span>
              </label>
              <input
                type="text"
                value={statusForm.trackingNumber}
                onChange={(e) => setStatusForm({ ...statusForm, trackingNumber: e.target.value })}
                className="input input-bordered w-full"
                placeholder="請輸入掛號號碼"
              />
            </div>
          )}

          <div>
            <label className="label">
              <span className="label-text">備註</span>
            </label>
            <textarea
              value={statusForm.notes}
              onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
              className="textarea textarea-bordered w-full"
              rows={3}
              placeholder="選填"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowStatusModal(false)
                setStatusForm({ status: '', approvedBy: '', trackingNumber: '', notes: '' })
                setSelectedLetter(null)
              }}
              className="btn btn-ghost"
            >
              取消
            </button>
            <button
              onClick={handleUpdateStatus}
              className="btn btn-primary"
              disabled={updateStatus.isPending}
            >
              {updateStatus.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 更新中...</>
              ) : (
                '確認更新'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
