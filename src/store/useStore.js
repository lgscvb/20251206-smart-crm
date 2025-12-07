import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 全域狀態管理
const useStore = create(
  persist(
    (set, get) => ({
      // 使用者資訊
      user: null,
      role: 'admin', // admin, finance, sales, service, manager

      // 當前選擇的分館
      selectedBranch: null,

      // 側邊欄狀態
      sidebarOpen: true,

      // 通知
      notifications: [],

      // Actions
      setUser: (user) => set({ user }),
      setRole: (role) => set({ role }),
      setSelectedBranch: (branch) => set({ selectedBranch: branch }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // 通知
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            { id: Date.now(), ...notification },
            ...state.notifications.slice(0, 9)
          ]
        })),

      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id)
        })),

      clearNotifications: () => set({ notifications: [] }),

      // 權限檢查
      hasPermission: (permission) => {
        const { role } = get()
        const permissions = {
          admin: ['*'],
          finance: ['payments', 'reports', 'commissions'],
          sales: ['customers', 'contracts', 'commissions'],
          service: ['customers', 'payments'],
          manager: ['dashboard', 'reports', 'customers', 'contracts', 'payments']
        }

        const userPerms = permissions[role] || []
        return userPerms.includes('*') || userPerms.includes(permission)
      }
    }),
    {
      name: 'hourjungle-store',
      partialize: (state) => ({
        user: state.user,
        role: state.role,
        selectedBranch: state.selectedBranch,
        sidebarOpen: state.sidebarOpen
      })
    }
  )
)

export default useStore
