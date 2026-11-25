import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AuthContext, useAuth } from '../auth/context'
import { meetingApi } from '../api/meetings'
import { Header, Notice } from './Common'

function readGuest(id) {
  try {
    const guest = JSON.parse(sessionStorage.getItem(`guest:${id}`))
    return guest?.accessToken && guest?.id ? guest : null
  } catch {
    return null
  }
}

export default function MeetingAccess({ children }) {
  const { id } = useParams()
  const auth = useAuth()
  const [guest, setGuest] = useState(() => readGuest(id))
  const [admission, setAdmission] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [enterName, setEnterName] = useState(false)
  const api = useMemo(
    () => meetingApi(auth.session?.accessToken || guest?.accessToken),
    [auth.session?.accessToken, guest?.accessToken],
  )

  useEffect(() => {
    function expired(event) {
      if (!guest || event.detail !== guest.accessToken) return
      sessionStorage.removeItem(`guest:${id}`)
      setGuest(null)
      setAdmission(null)
      setEnterName(true)
      setError('Phiên khách đã hết hạn. Vui lòng nhập tên để tham gia lại.')
    }
    window.addEventListener('auth:expired', expired)
    return () => window.removeEventListener('auth:expired', expired)
  }, [guest, id])

  async function joinGuest(event) {
    event.preventDefault()
    if (busy) return
    const name = new FormData(event.currentTarget).get('name').trim()
    if (!name) {
      setError('Vui lòng nhập tên của bạn.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await meetingApi().guest(id, name)
      if (result.status === 'locked') {
        setError('Cuộc họp đã bị khóa. Bạn có thể thử lại sau.')
        return
      }
      if (!result.guest?.accessToken || !result.guest?.id)
        throw new Error('Máy chủ chưa trả thông tin phiên khách hợp lệ.')
      sessionStorage.setItem(`guest:${id}`, JSON.stringify(result.guest))
      setAdmission(result)
      setGuest(result.guest)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (auth.session || guest)
    return (
      <AuthContext.Provider
        value={{
          ...auth,
          api,
          identityId: auth.session?.user.id || guest.id,
          guestAdmission: admission,
        }}
      >
        {children}
      </AuthContext.Provider>
    )

  return (
    <>
      <Header dark />
      <main className="meeting-gate">
        <section className="card gate-card">
          <h1>Tham gia cuộc họp</h1>
          <Link
            className="button primary full"
            to="/login"
            state={{ from: `/meeting/${id}` }}
          >
            Đăng nhập
          </Link>
          <p>Hoặc tham gia bằng tên của bạn.</p>
          <button className="full" onClick={() => setEnterName(true)}>
            Tham gia với tư cách khách
          </button>
          <Notice>{error}</Notice>
          {enterName && (
            <form onSubmit={joinGuest}>
              <label>
                Tên của bạn
                <input name="name" autoComplete="name" required />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? 'Đang tham gia…' : 'Tham gia'}
              </button>
            </form>
          )}
        </section>
      </main>
    </>
  )
}
