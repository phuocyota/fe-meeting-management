import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { request } from '../api/client'
import { useAuth } from '../auth/context'
import { Header, Notice } from '../components/Common'

export default function AccountPage({ create = false }) {
  const { session, updateUser } = useAuth()
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(!create)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (create) return
    const controller = new AbortController()
    request('/auth/me', { token: session.accessToken, signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) {
          setUser(value)
          setError('')
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [create, session.accessToken, retry])

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const element = event.currentTarget
    const form = new FormData(element)
    const body = { name: form.get('name').trim() }
    if (create) {
      body.username = form.get('username').trim()
      body.password = form.get('password')
    } else if (form.get('password')) {
      body.password = form.get('password')
      body.currentPassword = form.get('currentPassword')
      if (!body.currentPassword) {
        setError('Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.')
        return
      }
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const value = await request(create ? '/users' : '/auth/me', {
        token: session.accessToken,
        method: create ? 'POST' : 'PATCH',
        body,
      })
      if (!create) {
        updateUser(value)
        setUser(value)
      }
      element.reset()
      setMessage(create ? 'Đã tạo tài khoản.' : 'Đã cập nhật tài khoản.')
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Header />
      <main className="meeting-gate">
        <section className="card gate-card">
          <h1>{create ? 'Tạo tài khoản' : 'Tài khoản của tôi'}</h1>
          <Notice>{error}</Notice>
          <Notice kind="info">{message}</Notice>
          {loading ? (
            <p role="status">Đang tải tài khoản…</p>
          ) : !create && !user ? (
            <button onClick={() => { setLoading(true); setRetry(retry + 1) }}>
              Thử lại
            </button>
          ) : (
            <form onSubmit={submit}>
              <label>
                Tên hiển thị
                <input name="name" defaultValue={user?.name || ''} required />
              </label>
              {create ? (
                <label>
                  Tên đăng nhập
                  <input
                    name="username"
                    autoComplete="username"
                    required
                    minLength={3}
                    maxLength={50}
                    pattern="[a-zA-Z0-9._\-]+"
                  />
                </label>
              ) : <p>Tên đăng nhập: {user.username}</p>}
              {!create && (
                <label>
                  Mật khẩu hiện tại
                  <input name="currentPassword" type="password" autoComplete="current-password" />
                </label>
              )}
              <label>
                {create ? 'Mật khẩu' : 'Mật khẩu mới (bỏ trống nếu giữ nguyên)'}
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required={create}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? 'Đang lưu…' : create ? 'Tạo tài khoản' : 'Lưu thay đổi'}
              </button>
            </form>
          )}
          <Link className="button" to="/">Về trang chủ</Link>
        </section>
      </main>
    </>
  )
}
