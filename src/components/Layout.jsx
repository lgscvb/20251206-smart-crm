import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Bell,
  DollarSign,
  BarChart3,
  Settings,
  Menu,
  X,
  ChevronDown,
  Building2,
  LogOut,
  UserPlus,
  Bot,
  ShieldCheck
} from 'lucide-react'
import useStore from '../store/useStore'
import { useBranches } from '../hooks/useApi'
import Notifications from './Notifications'

const navigation = [
  { name: '儀表板', href: '/dashboard', icon: LayoutDashboard },
  { name: '客戶管理', href: '/customers', icon: Users },
  { name: '潛客管理', href: '/prospects', icon: UserPlus },
  { name: '合約管理', href: '/contracts', icon: FileText },
  { name: '繳費管理', href: '/payments', icon: CreditCard },
  { name: '續約提醒', href: '/renewals', icon: Bell },
  { name: '佣金管理', href: '/commissions', icon: DollarSign },
  { name: '報表中心', href: '/reports', icon: BarChart3 },
  { name: 'AI 助手', href: '/ai-assistant', icon: Bot },
  { name: '資料驗證', href: '/data-validation', icon: ShieldCheck },
]

export default function Layout() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { sidebarOpen, toggleSidebar, selectedBranch, setSelectedBranch } = useStore()
  const { data: branches } = useBranches()

  const currentPage = navigation.find(item => location.pathname.startsWith(item.href))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile menu backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-200 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-jungle-500 to-jungle-600 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-lg font-bold text-gray-900">Hour Jungle</h1>
                <p className="text-xs text-gray-500">CRM 管理系統</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Branch Selector */}
        {sidebarOpen && (
          <div className="p-4 border-b border-gray-200">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              選擇分館
            </label>
            <select
              value={selectedBranch || ''}
              onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
              className="mt-2 w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-jungle-500"
            >
              <option value="">全部分館</option>
              {branches?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname.startsWith(item.href)
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-jungle-50 text-jungle-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-jungle-600' : ''}`} />
                {sidebarOpen && <span>{item.name}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <NavLink
            to="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              location.pathname === '/settings'
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-5 h-5" />
            {sidebarOpen && <span>系統設定</span>}
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`transition-all duration-300 ${
          sidebarOpen ? 'lg:pl-64' : 'lg:pl-20'
        }`}
      >
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-gray-500 hover:text-gray-700"
              >
                <Menu className="w-5 h-5" />
              </button>
              <button
                onClick={toggleSidebar}
                className="hidden lg:block p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {currentPage?.name || '頁面'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Notifications />

              {/* User menu */}
              <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
                <div className="w-8 h-8 bg-jungle-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-jungle-700">A</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">Admin</p>
                  <p className="text-xs text-gray-500">管理員</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
