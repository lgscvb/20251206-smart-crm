import { useState } from 'react'
import useStore from '../store/useStore'
import Badge from '../components/Badge'
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Database,
  Globe,
  Save,
  RefreshCw,
  Check,
  AlertCircle
} from 'lucide-react'

export default function Settings() {
  const { role, setRole } = useStore()
  const [activeTab, setActiveTab] = useState('general')
  const [saved, setSaved] = useState(false)

  const tabs = [
    { id: 'general', name: '一般設定', icon: SettingsIcon },
    { id: 'users', name: '使用者', icon: User },
    { id: 'notifications', name: '通知', icon: Bell },
    { id: 'permissions', name: '權限', icon: Shield },
    { id: 'api', name: 'API 設定', icon: Database }
  ]

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 側邊選單 */}
        <div className="lg:w-56">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* 內容區 */}
        <div className="flex-1">
          {/* 一般設定 */}
          {activeTab === 'general' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">一般設定</h2>

              <div className="space-y-6">
                <div>
                  <label className="label">系統名稱</label>
                  <input
                    type="text"
                    defaultValue="Hour Jungle CRM"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">預設分館</label>
                  <select className="input">
                    <option value="">不指定</option>
                    <option value="1">大忠館</option>
                    <option value="2">環瑞館</option>
                  </select>
                </div>

                <div>
                  <label className="label">時區</label>
                  <select className="input">
                    <option value="Asia/Taipei">台北 (UTC+8)</option>
                  </select>
                </div>

                <div>
                  <label className="label">語言</label>
                  <select className="input">
                    <option value="zh-TW">繁體中文</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div className="pt-4 border-t">
                  <button onClick={handleSave} className="btn-primary">
                    {saved ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        已儲存
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        儲存設定
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 使用者設定 */}
          {activeTab === 'users' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">使用者設定</h2>

              <div className="space-y-6">
                <div>
                  <label className="label">目前角色</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="input"
                  >
                    <option value="admin">管理員</option>
                    <option value="manager">經理</option>
                    <option value="finance">財務</option>
                    <option value="sales">業務</option>
                    <option value="service">客服</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    切換角色以測試不同權限
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">角色權限說明</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="purple">管理員</Badge>
                      <span className="text-gray-600">全部功能</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="blue">經理</Badge>
                      <span className="text-gray-600">
                        儀表板、報表、客戶、合約、繳費
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">財務</Badge>
                      <span className="text-gray-600">繳費、報表、佣金</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">業務</Badge>
                      <span className="text-gray-600">客戶、合約、佣金</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="gray">客服</Badge>
                      <span className="text-gray-600">客戶、繳費</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 通知設定 */}
          {activeTab === 'notifications' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">通知設定</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">逾期提醒</p>
                    <p className="text-sm text-gray-500">
                      當有款項逾期時發送通知
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">續約提醒</p>
                    <p className="text-sm text-gray-500">
                      合約到期前 30 天發送通知
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">佣金提醒</p>
                    <p className="text-sm text-gray-500">
                      當有佣金可付款時發送通知
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">Email 通知</p>
                    <p className="text-sm text-gray-500">
                      發送 Email 通知（需設定 SMTP）
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 權限設定 */}
          {activeTab === 'permissions' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">權限管理</h2>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>功能</th>
                      <th className="text-center">管理員</th>
                      <th className="text-center">經理</th>
                      <th className="text-center">財務</th>
                      <th className="text-center">業務</th>
                      <th className="text-center">客服</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: '儀表板', admin: true, manager: true, finance: false, sales: false, service: false },
                      { name: '客戶管理', admin: true, manager: true, finance: false, sales: true, service: true },
                      { name: '合約管理', admin: true, manager: true, finance: false, sales: true, service: false },
                      { name: '繳費管理', admin: true, manager: true, finance: true, sales: false, service: true },
                      { name: '佣金管理', admin: true, manager: false, finance: true, sales: true, service: false },
                      { name: '報表', admin: true, manager: true, finance: true, sales: false, service: false },
                      { name: '系統設定', admin: true, manager: false, finance: false, sales: false, service: false }
                    ].map((perm) => (
                      <tr key={perm.name}>
                        <td className="font-medium">{perm.name}</td>
                        <td className="text-center">
                          {perm.admin && <Check className="w-5 h-5 text-green-500 mx-auto" />}
                        </td>
                        <td className="text-center">
                          {perm.manager && <Check className="w-5 h-5 text-green-500 mx-auto" />}
                        </td>
                        <td className="text-center">
                          {perm.finance && <Check className="w-5 h-5 text-green-500 mx-auto" />}
                        </td>
                        <td className="text-center">
                          {perm.sales && <Check className="w-5 h-5 text-green-500 mx-auto" />}
                        </td>
                        <td className="text-center">
                          {perm.service && <Check className="w-5 h-5 text-green-500 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* API 設定 */}
          {activeTab === 'api' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-6">API 設定</h2>

              <div className="space-y-6">
                <div>
                  <label className="label">MCP Server URL</label>
                  <input
                    type="url"
                    defaultValue="https://auto.yourspce.org"
                    className="input"
                  />
                </div>

                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-700">API 連線正常</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    最後檢查：剛剛
                  </p>
                </div>

                <div>
                  <label className="label">API 端點</label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <code className="text-sm">/tools/list</code>
                      <Badge variant="success">14 tools</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <code className="text-sm">/api/db/*</code>
                      <Badge variant="success">PostgREST</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <code className="text-sm">/health</code>
                      <Badge variant="success">OK</Badge>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <button className="btn-secondary">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    測試連線
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
