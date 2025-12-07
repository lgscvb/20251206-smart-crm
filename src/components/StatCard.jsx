import { TrendingUp, TrendingDown } from 'lucide-react'
import clsx from 'clsx'

export default function StatCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconBg = 'bg-primary-100',
  iconColor = 'text-primary-600',
  loading = false
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mt-1" />
          ) : (
            <p className="stat-value mt-1">{value}</p>
          )}
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {changeType === 'up' ? (
                <>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="stat-change-up">{change}</span>
                </>
              ) : changeType === 'down' ? (
                <>
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="stat-change-down">{change}</span>
                </>
              ) : (
                <span className="text-sm text-gray-500">{change}</span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div className={clsx('p-3 rounded-xl', iconBg)}>
            <Icon className={clsx('w-6 h-6', iconColor)} />
          </div>
        )}
      </div>
    </div>
  )
}
