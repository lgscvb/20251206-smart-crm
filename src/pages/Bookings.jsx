import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { callTool } from '../services/api'
import useStore from '../store/useStore'
import DataTable from '../components/DataTable'
import Modal from '../components/Modal'
import Badge from '../components/Badge'
import {
  Calendar,
  Plus,
  Edit,
  Trash2,
  Clock,
  Users,
  MapPin,
  User,
  Phone,
  Building2,
  Search,
  X,
  CheckCircle,
  XCircle,
  Bell,
  Loader2
} from 'lucide-react'

// 狀態中文對照
const STATUS_LABELS = {
  confirmed: '已確認',
  cancelled: '已取消',
  completed: '已完成',
  no_show: '未出席'
}

// 狀態顏色
const STATUS_VARIANTS = {
  confirmed: 'success',
  cancelled: 'gray',
  completed: 'info',
  no_show: 'danger'
}

export default function Bookings() {
  const [dateFilter, setDateFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [availableSlots, setAvailableSlots] = useState([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  // 表單狀態
  const [form, setForm] = useState({
    room_id: '',
    customer_id: '',
    date: '',
    start_time: '',
    end_time: '',
    purpose: '',
    attendees_count: '',
    notes: ''
  })

  const queryClient = useQueryClient()
  const addNotification = useStore((state) => state.addNotification)
  const selectedBranch = useStore((state) => state.selectedBranch)

  // 取得會議室列表
  const { data: roomsData } = useQuery({
    queryKey: ['meeting-rooms', selectedBranch],
    queryFn: () => callTool('booking_list_rooms', {
      branch_id: selectedBranch || undefined
    })
  })

  // 取得預約列表
  const { data: bookingsData, isLoading, refetch } = useQuery({
    queryKey: ['bookings', dateFilter, statusFilter, selectedBranch],
    queryFn: () => {
      const params = { limit: 100 }
      if (dateFilter) params.date_str = dateFilter
      if (statusFilter) params.status = statusFilter
      if (selectedBranch) params.branch_id = selectedBranch
      return callTool('booking_list', params)
    }
  })

  // 搜尋客戶
  const { data: customersData } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => callTool('crm_search_customers', { query: customerSearch }),
    enabled: customerSearch.length >= 2
  })

  // 建立預約
  const createBooking = useMutation({
    mutationFn: (data) => callTool('booking_create', data),
    onSuccess: (response) => {
      const data = response?.result || response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        addNotification({ type: 'success', message: `預約成功！編號: ${data.booking?.booking_number}` })
        setShowCreateModal(false)
        resetForm()
      } else {
        addNotification({ type: 'error', message: data.error || '建立失敗' })
      }
    },
    onError: (error) => {
      addNotification({ type: 'error', message: `建立失敗: ${error.message}` })
    }
  })

  // 取消預約
  const cancelBooking = useMutation({
    mutationFn: ({ bookingId, reason }) => callTool('booking_cancel', { booking_id: bookingId, reason }),
    onSuccess: (response) => {
      const data = response?.result || response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        addNotification({ type: 'success', message: '預約已取消' })
        setShowDetailModal(false)
      } else {
        addNotification({ type: 'error', message: data.error || '取消失敗' })
      }
    }
  })

  // 發送提醒
  const sendReminder = useMutation({
    mutationFn: (bookingId) => callTool('booking_send_reminder', { booking_id: bookingId }),
    onSuccess: (response) => {
      const data = response?.result || response
      if (data.success) {
        addNotification({ type: 'success', message: '提醒已發送' })
      } else {
        addNotification({ type: 'error', message: data.error || '發送失敗' })
      }
    }
  })

  const resetForm = () => {
    setForm({
      room_id: '',
      customer_id: '',
      date: '',
      start_time: '',
      end_time: '',
      purpose: '',
      attendees_count: '',
      notes: ''
    })
    setSelectedCustomer(null)
    setCustomerSearch('')
    setAvailableSlots([])
  }

  // 查詢可用時段
  const checkAvailability = async (roomId, date) => {
    if (!roomId || !date) return
    setCheckingAvailability(true)
    try {
      const result = await callTool('booking_check_availability', {
        room_id: parseInt(roomId),
        date_str: date
      })
      if (result.success) {
        setAvailableSlots(result.available_slots || [])
      } else {
        setAvailableSlots([])
      }
    } catch (error) {
      console.error('Check availability error:', error)
      setAvailableSlots([])
    } finally {
      setCheckingAvailability(false)
    }
  }

  // 處理表單變更
  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))

    // 當會議室或日期變更時，查詢可用時段
    if (field === 'room_id' || field === 'date') {
      const newRoomId = field === 'room_id' ? value : form.room_id
      const newDate = field === 'date' ? value : form.date
      if (newRoomId && newDate) {
        checkAvailability(newRoomId, newDate)
      }
    }
  }

  // 處理提交
  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.room_id || !form.customer_id || !form.date || !form.start_time || !form.end_time) {
      addNotification({ type: 'error', message: '請填寫必要欄位' })
      return
    }

    createBooking.mutate({
      room_id: parseInt(form.room_id),
      customer_id: parseInt(form.customer_id),
      date_str: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      purpose: form.purpose || undefined,
      attendees_count: form.attendees_count ? parseInt(form.attendees_count) : undefined,
      notes: form.notes || undefined
    })
  }

  // 選擇客戶
  const handleSelectCustomer = (customer) => {
    setSelectedCustomer(customer)
    setForm(prev => ({ ...prev, customer_id: customer.id }))
    setCustomerSearch('')
  }

  // 表格欄位
  const columns = [
    {
      key: 'booking_number',
      header: '預約編號',
      accessor: 'booking_number',
      cell: (row) => (
        <button
          onClick={() => {
            setSelectedBooking(row)
            setShowDetailModal(true)
          }}
          className="text-primary-600 hover:text-primary-800 font-medium"
        >
          {row.booking_number}
        </button>
      )
    },
    {
      key: 'room',
      header: '會議室',
      accessor: 'room_name',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{row.branch_name} {row.room_name}</span>
        </div>
      )
    },
    {
      key: 'customer',
      header: '預約人',
      accessor: 'customer_name',
      cell: (row) => (
        <div>
          <div className="font-medium">{row.customer_name}</div>
          {row.company_name && (
            <div className="text-sm text-gray-500">{row.company_name}</div>
          )}
        </div>
      )
    },
    {
      key: 'datetime',
      header: '預約時間',
      accessor: 'booking_date',
      cell: (row) => {
        const date = new Date(row.booking_date)
        const weekdays = ['日', '一', '二', '三', '四', '五', '六']
        const weekday = weekdays[date.getDay()]
        return (
          <div>
            <div className="font-medium">
              {date.getMonth() + 1}/{date.getDate()}（{weekday}）
            </div>
            <div className="text-sm text-gray-500">
              {row.start_time?.slice(0, 5)} - {row.end_time?.slice(0, 5)}
            </div>
          </div>
        )
      }
    },
    {
      key: 'status',
      header: '狀態',
      accessor: 'status',
      cell: (row) => (
        <Badge variant={STATUS_VARIANTS[row.status] || 'gray'}>
          {STATUS_LABELS[row.status] || row.status}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: '操作',
      sortable: false,
      cell: (row) => (
        <div className="flex gap-2">
          {row.status === 'confirmed' && !row.reminder_sent && (
            <button
              onClick={() => sendReminder.mutate(row.id)}
              className="p-1.5 text-gray-500 hover:text-primary-600 rounded"
              title="發送提醒"
              disabled={sendReminder.isPending}
            >
              {sendReminder.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </button>
          )}
          {row.status === 'confirmed' && (
            <button
              onClick={() => {
                if (confirm('確定要取消此預約嗎？')) {
                  cancelBooking.mutate({ bookingId: row.id, reason: '管理員取消' })
                }
              }}
              className="p-1.5 text-gray-500 hover:text-red-600 rounded"
              title="取消預約"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      )
    }
  ]

  const rooms = roomsData?.result?.rooms || []
  const bookings = bookingsData?.result?.bookings || []

  return (
    <div className="space-y-6">
      {/* 頁首 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">會議室預約</h1>
          <p className="text-gray-500 mt-1">管理會議室預約</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新增預約
        </button>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {bookings.filter(b => b.status === 'confirmed').length}
              </div>
              <div className="text-sm text-gray-500">待進行</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {bookings.filter(b => b.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-500">已完成</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <XCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {bookings.filter(b => b.status === 'cancelled').length}
              </div>
              <div className="text-sm text-gray-500">已取消</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MapPin className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{rooms.length}</div>
              <div className="text-sm text-gray-500">會議室</div>
            </div>
          </div>
        </div>
      </div>

      {/* 篩選 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">日期</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input"
            >
              <option value="">全部</option>
              <option value="confirmed">已確認</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
          {(dateFilter || statusFilter) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setDateFilter('')
                  setStatusFilter('')
                }}
                className="btn btn-secondary"
              >
                清除篩選
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 預約列表 */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={bookings}
          loading={isLoading}
          emptyMessage="沒有預約記錄"
        />
      </div>

      {/* 新增預約 Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          resetForm()
        }}
        title="新增會議室預約"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 會議室選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              會議室 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.room_id}
              onChange={(e) => handleFormChange('room_id', e.target.value)}
              className="input w-full"
              required
            >
              <option value="">請選擇會議室</option>
              {rooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.branch_name} {room.name} ({room.capacity}人)
                </option>
              ))}
            </select>
          </div>

          {/* 客戶搜尋 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              預約人 <span className="text-red-500">*</span>
            </label>
            {selectedCustomer ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <User className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <div className="font-medium">{selectedCustomer.name}</div>
                  {selectedCustomer.company_name && (
                    <div className="text-sm text-gray-500">{selectedCustomer.company_name}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null)
                    setForm(prev => ({ ...prev, customer_id: '' }))
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜尋客戶姓名/電話..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="input w-full pl-10"
                />
                {customerSearch.length >= 2 && customersData?.result?.customers?.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-auto">
                    {customersData.result.customers.map(customer => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3"
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          {customer.company_name && (
                            <div className="text-sm text-gray-500">{customer.company_name}</div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 日期選擇 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              日期 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => handleFormChange('date', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="input w-full"
              required
            />
          </div>

          {/* 時段選擇 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始時間 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.start_time}
                onChange={(e) => handleFormChange('start_time', e.target.value)}
                className="input w-full"
                required
                disabled={!form.room_id || !form.date}
              >
                <option value="">請選擇</option>
                {checkingAvailability ? (
                  <option disabled>載入中...</option>
                ) : availableSlots.length > 0 ? (
                  availableSlots.map(slot => (
                    <option key={slot.start} value={slot.start}>
                      {slot.start}
                    </option>
                  ))
                ) : form.room_id && form.date ? (
                  <option disabled>無可用時段</option>
                ) : null}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                結束時間 <span className="text-red-500">*</span>
              </label>
              <select
                value={form.end_time}
                onChange={(e) => handleFormChange('end_time', e.target.value)}
                className="input w-full"
                required
                disabled={!form.start_time}
              >
                <option value="">請選擇</option>
                {form.start_time && generateEndTimes(form.start_time).map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 其他資訊 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">會議目的</label>
              <input
                type="text"
                value={form.purpose}
                onChange={(e) => handleFormChange('purpose', e.target.value)}
                className="input w-full"
                placeholder="例：團隊會議"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">預計人數</label>
              <input
                type="number"
                value={form.attendees_count}
                onChange={(e) => handleFormChange('attendees_count', e.target.value)}
                className="input w-full"
                min="1"
                placeholder="人數"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
            <textarea
              value={form.notes}
              onChange={(e) => handleFormChange('notes', e.target.value)}
              className="input w-full"
              rows={2}
              placeholder="其他備註事項..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false)
                resetForm()
              }}
              className="btn btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createBooking.isPending}
            >
              {createBooking.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  建立中...
                </>
              ) : (
                '建立預約'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* 預約詳情 Modal */}
      <Modal
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="預約詳情"
      >
        {selectedBooking && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{selectedBooking.booking_number}</h3>
              <Badge variant={STATUS_VARIANTS[selectedBooking.status]}>
                {STATUS_LABELS[selectedBooking.status]}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-gray-400" />
                <span>{selectedBooking.branch_name} {selectedBooking.room_name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <span>
                  {new Date(selectedBooking.booking_date).toLocaleDateString('zh-TW')}
                  {' '}
                  {selectedBooking.start_time?.slice(0, 5)} - {selectedBooking.end_time?.slice(0, 5)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <div>{selectedBooking.customer_name}</div>
                  {selectedBooking.company_name && (
                    <div className="text-sm text-gray-500">{selectedBooking.company_name}</div>
                  )}
                </div>
              </div>
              {selectedBooking.customer_phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <span>{selectedBooking.customer_phone}</span>
                </div>
              )}
              {selectedBooking.attendees_count && (
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span>{selectedBooking.attendees_count} 人</span>
                </div>
              )}
              {selectedBooking.purpose && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">會議目的</div>
                  <div>{selectedBooking.purpose}</div>
                </div>
              )}
              {selectedBooking.notes && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-500 mb-1">備註</div>
                  <div>{selectedBooking.notes}</div>
                </div>
              )}
            </div>

            {selectedBooking.status === 'confirmed' && (
              <div className="flex gap-3 pt-4 border-t">
                {!selectedBooking.reminder_sent && (
                  <button
                    onClick={() => sendReminder.mutate(selectedBooking.id)}
                    className="btn btn-secondary flex items-center gap-2"
                    disabled={sendReminder.isPending}
                  >
                    <Bell className="w-4 h-4" />
                    發送提醒
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm('確定要取消此預約嗎？')) {
                      cancelBooking.mutate({
                        bookingId: selectedBooking.id,
                        reason: '管理員取消'
                      })
                    }
                  }}
                  className="btn btn-danger flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  取消預約
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// 生成結束時間選項（從開始時間到 18:00，每 30 分鐘一個）
function generateEndTimes(startTime) {
  if (!startTime) return []

  const [startHour, startMin] = startTime.split(':').map(Number)
  const times = []

  let hour = startHour
  let min = startMin + 30

  while (hour < 18 || (hour === 18 && min === 0)) {
    if (min >= 60) {
      hour += 1
      min -= 60
    }
    if (hour > 18) break

    const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
    times.push(timeStr)

    min += 30
  }

  return times
}
