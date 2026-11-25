import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { Brand, Notice, ThemeToggle } from '../components/Common'

export default function LoginPage() {
  const { login, session, expired } = useAuth()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (session) return <Navigate to={location.state?.from || '/'} replace />
  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await login({
        username: form.get('username').trim(),
        password: form.get('password'),
      })
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <main className="login-layout">
      <ThemeToggle className="floating-theme-toggle" />
      <section className="login-form-wrap">
        <form className="card login-form" onSubmit={submit}>
          <Brand />
          <span className="eyebrow">CHÀO MỪNG BẠN TRỞ LẠI</span>
          <h2>Đăng nhập</h2>
          <p>Sử dụng tài khoản của bạn để bắt đầu cuộc họp.</p>
          <Notice kind="info">
            {expired && 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'}
          </Notice>
          <Notice>{error}</Notice>
          <label>
            Tên đăng nhập
            <input
              name="username"
              autoComplete="username"
              placeholder="Nhập tên đăng nhập"
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Nhập mật khẩu của bạn"
              required
            />
          </label>
          <button className="primary full" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập →'}
          </button>
          <small className="muted">
            Tài khoản dùng cho hệ thống phòng họp.
          </small>
        </form>
      </section>
    </main>
  )
}
