import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Expenses from './pages/Expenses.jsx'
import Members from './pages/Members.jsx'
import Settle from './pages/Settle.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/expenses" replace />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="members" element={<Members />} />
        <Route path="settle" element={<Settle />} />
        <Route path="*" element={<Navigate to="/expenses" replace />} />
      </Route>
    </Routes>
  )
}
