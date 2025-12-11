import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Receipt,
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
  ShieldCheck,
  HelpCircle,
  FileSignature,
  Scale
} from 'lucide-react'
import useStore from '../store/useStore'
import { useBranches } from '../hooks/useApi'
import Notifications from './Notifications'

const navigation = [
  { name: '儀表板', href: '/dashboard', icon: LayoutDashboard },
  { name: '客戶管理', href: '/customers', icon: Users },
  { name: '合約管理', href: '/contracts', icon: FileText },
  { name: '繳費管理', href: '/payments', icon: CreditCard },
  { name: '發票管理', href: '/invoices', icon: Receipt },
  { name: '續約提醒', href: '/renewals', icon: Bell },
  { name: '佣金管理', href: '/commissions', icon: DollarSign },
  { name: '報價單', href: '/quotes', icon: FileSignature },
  { name: '報表中心', href: '/reports', icon: BarChart3 },
  { name: 'AI 助手', href: '/ai-assistant', icon: Bot },
  { name: '資料驗證', href: '/data-validation', icon: ShieldCheck },
  { name: '潛客管理', href: '/prospects', icon: UserPlus },
]

export default function Layout() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
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
            <label htmlFor="branch-selector" className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              選擇分館
            </label>
            <select
              id="branch-selector"
              name="branch-selector"
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
              {/* Help button */}
              <button
                onClick={() => setHelpOpen(true)}
                className="p-2 text-gray-500 hover:text-jungle-600 hover:bg-jungle-50 rounded-lg transition-colors"
                title="使用說明"
              >
                <HelpCircle className="w-5 h-5" />
              </button>

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

      {/* Help Modal */}
      {helpOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-jungle-100 rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-6 h-6 text-jungle-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">使用說明</h2>
                  <p className="text-sm text-gray-500">Hour Jungle CRM 快速入門</p>
                </div>
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                {/* Quick Start */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">5 分鐘快速入門</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-900">儀表板</h4>
                      <p className="text-sm text-gray-500 mt-1">一眼看懂營收、客戶、合約狀況</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-900">客戶管理</h4>
                      <p className="text-sm text-gray-500 mt-1">搜尋、篩選、查看客戶資料</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-900">繳費管理</h4>
                      <p className="text-sm text-gray-500 mt-1">記錄收款、追蹤繳費狀態</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <h4 className="font-medium text-gray-900">續約提醒</h4>
                      <p className="text-sm text-gray-500 mt-1">追蹤即將到期的合約</p>
                    </div>
                  </div>
                </div>

                {/* Status Guide */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">狀態說明</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      <span className="font-medium text-green-700">生效中 / 已繳費</span>
                      <span className="text-sm text-green-600 ml-auto">正常狀態</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                      <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                      <span className="font-medium text-yellow-700">即將到期 / 待繳費</span>
                      <span className="text-sm text-yellow-600 ml-auto">需要注意</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                      <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                      <span className="font-medium text-red-700">已到期 / 逾期</span>
                      <span className="text-sm text-red-600 ml-auto">需要處理</span>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">小技巧</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-jungle-500 mt-0.5">•</span>
                      <span>點擊「欄位」按鈕可以自訂要顯示的欄位</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-jungle-500 mt-0.5">•</span>
                      <span>在報表中心切換「月/季/年」查看不同時間範圍</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-jungle-500 mt-0.5">•</span>
                      <span>有問題可以問「AI 助手」，它會幫你解答</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button
                onClick={() => setHelpOpen(false)}
                className="px-4 py-2 bg-jungle-600 text-white rounded-lg hover:bg-jungle-700 transition-colors"
              >
                了解了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
