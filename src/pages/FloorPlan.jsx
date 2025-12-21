import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pdf } from '@react-pdf/renderer'
import html2canvas from 'html2canvas'
import { callTool } from '../services/api'
import api from '../services/api'
import useStore from '../store/useStore'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import FloorPlanPDF from '../components/pdf/FloorPlanPDF'
import {
  Map,
  Download,
  RefreshCw,
  Building2,
  User,
  Phone,
  FileText,
  Calendar,
  DollarSign,
  Search,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  MapPin,
  Move,
  Save
} from 'lucide-react'

export default function FloorPlan() {
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [contractSearch, setContractSearch] = useState('')
  const [selectedContract, setSelectedContract] = useState(null)
  const [scale, setScale] = useState(1)
  const containerRef = useRef(null)

  // 拖拉編輯模式
  const [editMode, setEditMode] = useState(false)
  const [draggingPos, setDraggingPos] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [localPositions, setLocalPositions] = useState({}) // 暫存拖拉後的座標
  const [hasChanges, setHasChanges] = useState(false)
  const floorPlanRef = useRef(null)

  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)
  const selectedBranch = useStore((state) => state.selectedBranch)

  // 取得平面圖位置資料
  const { data: floorPlanData, isLoading, refetch } = useQuery({
    queryKey: ['floor-plan-positions', selectedBranch || 1],
    queryFn: () => callTool('floor_plan_get_positions', {
      branch_id: selectedBranch || 1
    })
  })

  // 搜尋合約（用於指派位置）
  const { data: contractsData } = useQuery({
    queryKey: ['contracts-search', contractSearch],
    queryFn: () => callTool('crm_search_customers', { query: contractSearch }),
    enabled: contractSearch.length >= 2
  })

  // 更新位置
  const updatePosition = useMutation({
    mutationFn: ({ position_number, contract_id }) =>
      callTool('floor_plan_update_position', {
        position_number,
        contract_id,
        branch_id: selectedBranch || 1
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['floor-plan-positions'])
      addNotification({ type: 'success', message: '位置更新成功' })
      setShowEditModal(false)
      setSelectedContract(null)
      setContractSearch('')
    },
    onError: (error) => {
      addNotification({ type: 'error', message: '更新失敗：' + error.message })
    }
  })

  // 生成 PDF（前端直接生成，速度更快）
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  const handleGeneratePdf = async () => {
    if (!floorPlanData?.result) {
      addNotification({ type: 'error', message: '尚無資料可生成' })
      return
    }

    if (!floorPlanRef.current) {
      addNotification({ type: 'error', message: '平面圖尚未載入' })
      return
    }

    setIsGeneratingPdf(true)
    try {
      // 1. 使用 html2canvas 截圖平面圖
      addNotification({ type: 'info', message: '正在截圖平面圖...' })
      const canvas = await html2canvas(floorPlanRef.current, {
        scale: 1,  // 使用原始大小
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })
      const floorPlanImage = canvas.toDataURL('image/png')

      // 2. 準備 PDF 資料
      const pdfData = {
        floor_plan: floorPlanData.result.floor_plan,
        positions: floorPlanData.result.positions,
        statistics: floorPlanData.result.statistics,
        floorPlanImage  // 傳入截圖
      }

      // 3. 使用 @react-pdf/renderer 前端生成 PDF
      addNotification({ type: 'info', message: '正在生成 PDF...' })
      const blob = await pdf(<FloorPlanPDF data={pdfData} />).toBlob()

      // 4. 建立下載連結
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `平面圖_${floorPlan?.name || '大忠本館'}_${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      addNotification({ type: 'success', message: '平面圖 PDF 已下載' })
    } catch (error) {
      console.error('PDF 生成錯誤:', error)
      addNotification({ type: 'error', message: '生成失敗：' + error.message })
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const result = floorPlanData?.result
  const floorPlan = result?.floor_plan
  const positions = result?.positions || []
  const statistics = result?.statistics

  // 處理位置點擊
  const handlePositionClick = (pos) => {
    setSelectedPosition(pos)
    setShowDetailModal(true)
  }

  // 開啟編輯模式
  const handleEditPosition = () => {
    setShowDetailModal(false)
    setShowEditModal(true)
  }

  // 清空位置
  const handleClearPosition = () => {
    if (selectedPosition && window.confirm('確定要清空此位置嗎？')) {
      updatePosition.mutate({
        position_number: selectedPosition.position_number,
        contract_id: null
      })
    }
  }

  // 指派合約到位置
  const handleAssignContract = (contractId) => {
    if (selectedPosition) {
      updatePosition.mutate({
        position_number: selectedPosition.position_number,
        contract_id: contractId
      })
    }
  }

  // ========== 拖拉編輯功能 ==========
  const handleMouseDown = useCallback((e, pos) => {
    if (!editMode) return
    e.preventDefault()
    e.stopPropagation()

    const rect = floorPlanRef.current?.getBoundingClientRect()
    if (!rect) return

    // 計算滑鼠相對於元素的偏移
    const currentX = localPositions[pos.position_number]?.x ?? pos.x
    const currentY = localPositions[pos.position_number]?.y ?? pos.y

    setDragOffset({
      x: (e.clientX - rect.left) / scale - currentX,
      y: (e.clientY - rect.top) / scale - currentY
    })
    setDraggingPos(pos.position_number)
  }, [editMode, scale, localPositions])

  const handleMouseMove = useCallback((e) => {
    if (!draggingPos || !floorPlanRef.current) return

    const rect = floorPlanRef.current.getBoundingClientRect()
    const newX = Math.max(0, Math.round((e.clientX - rect.left) / scale - dragOffset.x))
    const newY = Math.max(0, Math.round((e.clientY - rect.top) / scale - dragOffset.y))

    setLocalPositions(prev => ({
      ...prev,
      [draggingPos]: { x: newX, y: newY }
    }))
    setHasChanges(true)
  }, [draggingPos, scale, dragOffset])

  const handleMouseUp = useCallback(() => {
    setDraggingPos(null)
  }, [])

  // 儲存所有座標變更
  const saveAllPositions = async () => {
    const updates = Object.entries(localPositions)
    if (updates.length === 0) {
      addNotification({ type: 'info', message: '沒有需要儲存的變更' })
      return
    }

    try {
      // 批次更新座標
      const floorPlanId = floorPlan?.id || 1
      for (const [posNum, coords] of updates) {
        await api.patch(`/api/db/floor_positions?position_number=eq.${posNum}&floor_plan_id=eq.${floorPlanId}`, {
          x: coords.x,
          y: coords.y
        })
      }
      addNotification({ type: 'success', message: `已儲存 ${updates.length} 個位置` })
      setLocalPositions({})
      setHasChanges(false)
      refetch()
    } catch (error) {
      addNotification({ type: 'error', message: '儲存失敗：' + error.message })
    }
  }

  // 取消編輯
  const cancelEdit = () => {
    setEditMode(false)
    setLocalPositions({})
    setHasChanges(false)
    setDraggingPos(null)
  }

  // 取得位置的目前座標（優先使用本地暫存）
  const getPositionCoords = (pos) => {
    if (localPositions[pos.position_number]) {
      return localPositions[pos.position_number]
    }
    return { x: pos.x, y: pos.y }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-jungle-600" />
        <span className="ml-2 text-gray-600">載入中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 標題列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-jungle-100 rounded-xl flex items-center justify-center">
            <Map className="w-6 h-6 text-jungle-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {floorPlan?.name || '平面圖'}
            </h1>
            <p className="text-sm text-gray-500">點擊位置查看詳情或調整租戶</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* 編輯模式按鈕 */}
          {editMode ? (
            <>
              <button
                onClick={saveAllPositions}
                disabled={!hasChanges}
                className="px-4 py-2 bg-jungle-600 text-white rounded-lg hover:bg-jungle-700 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                儲存 ({Object.keys(localPositions).length})
              </button>
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 flex items-center gap-2"
              >
                <Move className="w-4 h-4" />
                調整位置
              </button>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                重新整理
              </button>
              <button
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="px-4 py-2 bg-jungle-600 text-white rounded-lg hover:bg-jungle-700 flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                生成 PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* 統計卡片 */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-500">總位置數</p>
            <p className="text-2xl font-bold text-gray-900">{statistics.total_positions}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-500">已出租</p>
            <p className="text-2xl font-bold text-green-600">{statistics.occupied}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-500">空位</p>
            <p className="text-2xl font-bold text-orange-500">{statistics.vacant}</p>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <p className="text-sm text-gray-500">出租率</p>
            <p className="text-2xl font-bold text-jungle-600">{statistics.occupancy_rate}</p>
          </div>
        </div>
      )}

      {/* 縮放控制 */}
      <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-200 w-fit">
        <button
          onClick={() => setScale(Math.max(0.5, scale - 0.1))}
          className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
        >
          -
        </button>
        <span className="px-3 text-sm text-gray-600">{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale(Math.min(2, scale + 0.1))}
          className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded"
        >
          +
        </button>
        <button
          onClick={() => setScale(1)}
          className="px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 rounded"
        >
          重設
        </button>
      </div>

      {/* 編輯模式提示 */}
      {editMode && (
        <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 flex items-center gap-2 text-orange-700">
          <Move className="w-5 h-5" />
          <span className="font-medium">編輯模式：</span>
          <span>拖拉標籤調整位置，完成後點擊「儲存」</span>
          {draggingPos && (
            <span className="ml-auto text-sm bg-orange-200 px-2 py-1 rounded">
              拖拉中: 位置 {draggingPos} → ({localPositions[draggingPos]?.x}, {localPositions[draggingPos]?.y})
            </span>
          )}
        </div>
      )}

      {/* 平面圖容器 */}
      <div
        ref={containerRef}
        className={`bg-gray-100 rounded-xl border overflow-auto ${editMode ? 'border-orange-300 border-2' : 'border-gray-200'}`}
        style={{ height: 'calc(100vh - 300px)' }}
        onMouseMove={editMode ? handleMouseMove : undefined}
        onMouseUp={editMode ? handleMouseUp : undefined}
        onMouseLeave={editMode ? handleMouseUp : undefined}
      >
        {/* 佔位層：確保滾動區域正確反映縮放後的大小 */}
        <div
          style={{
            width: (floorPlan?.width || 2457) * scale + 32,
            height: (floorPlan?.height || 1609) * scale + 32,
            padding: '16px',
          }}
        >
          {/* 縮放層：包含圖片和所有位置方塊 */}
          <div
            ref={floorPlanRef}
            className="relative bg-white shadow-lg"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: floorPlan?.width || 2457,
              height: floorPlan?.height || 1609,
            }}
          >
            {floorPlan?.image_url ? (
              <img
                src={`${floorPlan.image_url}?v=2`}
                alt="Floor Plan"
                className="block w-full h-full"
                draggable={false}
                crossOrigin="anonymous"
              />
            ) : (
              <div
                className="flex items-center justify-center bg-gray-50 text-gray-400 w-full h-full"
              >
                無平面圖影像
              </div>
            )}

            {/* 位置方塊 */}
            {positions.map((pos) => {
              const isOccupied = !!pos.contract_id
              const companyName = pos.company_name || ''
              const displayName = companyName.length > 8 ? companyName.slice(0, 7) + '…' : companyName
              const coords = getPositionCoords(pos)
              const isDragging = draggingPos === pos.position_number
              const isModified = !!localPositions[pos.position_number]

              return (
                <div
                  key={pos.position_number}
                  onClick={() => !editMode && handlePositionClick(pos)}
                  onMouseDown={(e) => handleMouseDown(e, pos)}
                  className={`absolute border rounded transition-all group
                    ${editMode
                      ? `cursor-move ${isDragging ? 'z-50 shadow-2xl ring-2 ring-orange-500' : 'hover:z-20 hover:shadow-xl'} ${isModified ? 'ring-2 ring-blue-400' : ''}`
                      : 'cursor-pointer hover:z-20 hover:shadow-xl hover:scale-105'
                    }
                    ${isOccupied
                      ? 'bg-white/95 border-jungle-300 hover:border-jungle-500 text-gray-800'
                      : 'bg-orange-50/90 border-orange-300 hover:border-orange-500 text-gray-600'
                    }`}
                  style={{
                    left: coords.x,
                    top: coords.y,
                    minWidth: 'fit-content',
                    maxWidth: pos.box_width || 68,
                    height: 'auto',
                    minHeight: 18,
                    padding: '2px 4px',
                    userSelect: 'none',
                  }}
                  title={editMode
                    ? `${pos.position_number} - 座標: (${coords.x}, ${coords.y})`
                    : `${pos.position_number} - ${pos.company_name || '空位'}`
                  }
                >
                  {/* 標籤內容 */}
                  <div className="flex items-center gap-0.5 whitespace-nowrap">
                    <span className={`text-[9px] font-bold leading-none ${isOccupied ? 'text-jungle-600' : 'text-orange-500'}`}>
                      {pos.position_number}
                    </span>
                    <span className="text-[8px] leading-tight font-medium">
                      {displayName || <span className="text-gray-400">待租</span>}
                    </span>
                  </div>

                  {/* 狀態指示條 */}
                  <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${isOccupied ? 'bg-jungle-500' : 'bg-orange-300'}`} />

                  {/* 編輯模式：顯示修改標記 */}
                  {editMode && isModified && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 圖例 */}
      <div className="flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border border-gray-400 rounded"></div>
          <span>已出租</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
          <span>空位</span>
        </div>
      </div>

      {/* 位置詳情 Modal */}
      <Modal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`位置 ${selectedPosition?.position_number}`}
      >
        {selectedPosition && (
          <div className="space-y-4">
            {selectedPosition.contract_id ? (
              <>
                <div className="p-4 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-700">已出租</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">公司名稱</p>
                      <p className="font-medium">{selectedPosition.company_name || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">聯絡人</p>
                      <p className="font-medium">{selectedPosition.contact_name || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">電話</p>
                      <p className="font-medium">{selectedPosition.contact_phone || '-'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">月租</p>
                      <p className="font-medium">
                        ${selectedPosition.monthly_rent?.toLocaleString() || '-'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">合約期間</p>
                      <p className="font-medium">
                        {selectedPosition.start_date} ~ {selectedPosition.end_date}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">合約ID</p>
                      <p className="font-medium">#{selectedPosition.contract_id}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={handleEditPosition}
                    className="flex-1 px-4 py-2 bg-jungle-600 text-white rounded-lg hover:bg-jungle-700"
                  >
                    更換租戶
                  </button>
                  <button
                    onClick={handleClearPosition}
                    className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                  >
                    清空位置
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 bg-orange-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    <span className="font-medium text-orange-700">空位</span>
                  </div>
                  <p className="text-sm text-orange-600">此位置目前沒有租戶</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleEditPosition}
                    className="flex-1 px-4 py-2 bg-jungle-600 text-white rounded-lg hover:bg-jungle-700"
                  >
                    指派租戶
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* 編輯位置 Modal */}
      <Modal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setContractSearch('')
          setSelectedContract(null)
        }}
        title={`${selectedPosition?.contract_id ? '更換' : '指派'}位置 ${selectedPosition?.position_number} 的租戶`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              搜尋客戶 / 合約
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={contractSearch}
                onChange={(e) => setContractSearch(e.target.value)}
                placeholder="輸入客戶名稱或公司名..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jungle-500"
                autoFocus
              />
            </div>
          </div>

          {/* 搜尋結果 */}
          {contractSearch.length >= 2 && contractsData?.result?.customers && (
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y">
              {contractsData.result.customers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  找不到符合的客戶
                </div>
              ) : (
                contractsData.result.customers.map((customer) => (
                  <div key={customer.id} className="p-3 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {customer.company_name || customer.name}
                        </p>
                        <p className="text-sm text-gray-500">{customer.name}</p>
                      </div>
                      {customer.active_contracts?.length > 0 && (
                        <div className="space-y-1">
                          {customer.active_contracts.map((contract) => (
                            <button
                              key={contract.id}
                              onClick={() => handleAssignContract(contract.id)}
                              className="px-3 py-1 text-sm bg-jungle-100 text-jungle-700 rounded hover:bg-jungle-200"
                            >
                              合約 #{contract.id}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {contractSearch.length > 0 && contractSearch.length < 2 && (
            <p className="text-sm text-gray-500">請輸入至少 2 個字元</p>
          )}

          <div className="flex justify-end pt-4 border-t">
            <button
              onClick={() => {
                setShowEditModal(false)
                setContractSearch('')
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              取消
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
