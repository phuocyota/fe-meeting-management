import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from './context'
import { request } from '../api/client'
import { meetingApi } from '../api/meetings'

const STORAGE_KEY = 'enterprise-meeting.session.v2'
function readSession() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return value?.accessToken && value?.user?.id ? value : null
  } catch {
    return null
  }
}

export default function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(readSession)
  const [expired, setExpired] = useState(false)
  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setSession(null)
  }, [])
  useEffect(() => {
    const onExpired = (event) => {
      if (event.detail !== session?.accessToken) return
      logout()
      setExpired(true)
      navigate('/login', { state: { from: window.location.pathname }, replace: true })
    }
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY || event.key === null)
        setSession(readSession())
    }
    window.addEventListener('auth:expired', onExpired)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('auth:expired', onExpired)
      window.removeEventListener('storage', onStorage)
    }
  }, [logout, navigate, session?.accessToken])
  const updateUser = useCallback((user) => {
    setSession((previous) => {
      if (!previous) return previous
      const next = { ...previous, user }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])
  const login = useCallback(async ({ username, password }) => {
    const data = await request('/auth/login', {
      method: 'POST', body: { username, password },
    })
    if (!data?.accessToken || !data?.user?.id || !data?.expiresAt)
      throw new Error('Phản hồi đăng nhập không có thông tin phiên hợp lệ.')
    const next = { accessToken: data.accessToken, expiresAt: data.expiresAt, user: data.user }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setSession(next)
    setExpired(false)
  }, [])
  const api = useMemo(
    () => meetingApi(session?.accessToken),
    [session?.accessToken],
  )
  return (
    <AuthContext.Provider value={{ session, login, logout, api, expired, updateUser, identityId: session?.user.id }}>
      {children}
    </AuthContext.Provider>
  )
}
