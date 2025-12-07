import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import Contracts from './pages/Contracts'
import Payments from './pages/Payments'
import Renewals from './pages/Renewals'
import Commissions from './pages/Commissions'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Prospects from './pages/Prospects'
import ChurnedCustomers from './pages/ChurnedCustomers'
import AIAssistant from './pages/AIAssistant'
import DataValidation from './pages/DataValidation'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/churned" element={<ChurnedCustomers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="payments" element={<Payments />} />
        <Route path="renewals" element={<Renewals />} />
        <Route path="commissions" element={<Commissions />} />
        <Route path="reports" element={<Reports />} />
        <Route path="prospects" element={<Prospects />} />
        <Route path="ai-assistant" element={<AIAssistant />} />
        <Route path="data-validation" element={<DataValidation />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
