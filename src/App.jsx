import { lazy, Suspense, useCallback, useState } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom'
import AuthProvider from './auth/AuthProvider'
import { useAuth } from './auth/context'
import MeetingAccess from './components/MeetingAccess'
import AccountPage from './pages/AccountPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import './App.css'
import './meeting-ui.css'
import './theme.css'

const MeetingPage = lazy(() => import('./pages/MeetingPage'))
function ProtectedRoute() {
  const { session } = useAuth()
  const location = useLocation()
  return session ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ from: location.pathname }} replace />
  )
}
function MeetingRoute({ admission, onAdmissionUsed }) {
  const { id } = useParams()
  return (
    <MeetingAccess key={id}>
      <MeetingPage
        key={id}
        createdAdmission={admission}
        onAdmissionUsed={onAdmissionUsed}
      />
    </MeetingAccess>
  )
}
function AppRoutes() {
  const [admission, setAdmission] = useState(null)
  const clearAdmission = useCallback(() => setAdmission(null), [])
  return (
    <Suspense
      fallback={
        <main className="route-loading" role="status">
          Đang tải không gian họp…
        </main>
      }
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/meeting/:id"
          element={
            <MeetingRoute
              admission={admission}
              onAdmissionUsed={clearAdmission}
            />
          }
        />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomePage onCreated={setAdmission} />} />
          <Route path="/account" element={<AccountPage />} />
          <Route
            path="/users/new"
            element={<AccountPage key="create" create />}
          />
          <Route
            path="*"
            element={
              <main className="meeting-gate">
                <h1>Không tìm thấy trang</h1>
                <Link className="button primary" to="/">
                  Về trang chủ
                </Link>
              </main>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  )
}
function SessionRoutes() {
  const { session } = useAuth()
  return <AppRoutes key={session?.accessToken || 'anonymous'} />
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SessionRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
