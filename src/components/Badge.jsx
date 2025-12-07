import clsx from 'clsx'

const variants = {
  success: 'bg-green-100 text-green-800',
  danger: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-800',
  purple: 'bg-purple-100 text-purple-800'
}

export default function Badge({ children, variant = 'gray', dot = false, className }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {dot && (
        <span
          className={clsx(
            'w-1.5 h-1.5 rounded-full',
            variant === 'success' && 'bg-green-500',
            variant === 'danger' && 'bg-red-500',
            variant === 'warning' && 'bg-yellow-500',
            variant === 'info' && 'bg-blue-500',
            variant === 'gray' && 'bg-gray-500',
            variant === 'purple' && 'bg-purple-500'
          )}
        />
      )}
      {children}
    </span>
  )
}

// 狀態映射
export const statusConfig = {
  // 客戶狀態
  active: { label: '活躍', variant: 'success', dot: true },
  inactive: { label: '非活躍', variant: 'gray', dot: true },
  lead: { label: '潛在客戶', variant: 'info', dot: true },
  churned: { label: '流失', variant: 'danger', dot: true },

  // 合約狀態
  pending: { label: '待生效', variant: 'warning' },
  expired: { label: '已到期', variant: 'gray' },
  cancelled: { label: '已取消', variant: 'danger' },

  // 繳費狀態
  paid: { label: '已繳', variant: 'success' },
  overdue: { label: '逾期', variant: 'danger' },

  // 佣金狀態
  eligible: { label: '可付款', variant: 'success' },

  // 風險等級
  low: { label: '低風險', variant: 'success' },
  normal: { label: '正常', variant: 'gray' },
  medium: { label: '中風險', variant: 'warning' },
  high: { label: '高風險', variant: 'danger' },

  // 緊急度
  critical: { label: '嚴重', variant: 'danger' },
  urgent: { label: '緊急', variant: 'danger' },
  upcoming: { label: '即將到期', variant: 'warning' }
}

export function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, variant: 'gray' }
  return (
    <Badge variant={config.variant} dot={config.dot}>
      {config.label}
    </Badge>
  )
}
