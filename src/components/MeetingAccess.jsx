import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AuthContext, useAuth } from '../auth/context'
import { meetingApi } from '../api/meetings'
import { Header, Notice } from './Common'
import { formatSchedule, untilStart } from '../utils/meeting'

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
  // Link từ hệ thống ngoài: /meeting/:id?name=Tên vào thẳng với tư cách khách, không cần bấm nút.
  const [searchParams] = useSearchParams()
  const linkName = (searchParams.get('name') || '').trim().slice(0, 100)
  const [notStarted, setNotStarted] = useState(null)
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

  const requestGuest = useCallback(
    async (name) => {
      setBusy(true)
      setError('')
      try {
        const result = await meetingApi().guest(id, name)
        if (result.status === 'locked') {
          setNotStarted(null)
          setEnterName(true)
          setError('Cuộc họp đã bị khóa. Bạn có thể thử lại sau.')
          return
        }
        if (result.status === 'not_started') {
          setNotStarted({ name, meeting: result.meeting })
          return
        }
        if (!result.guest?.accessToken || !result.guest?.id)
          throw new Error('Máy chủ chưa trả thông tin phiên khách hợp lệ.')
        sessionStorage.setItem(`guest:${id}`, JSON.stringify(result.guest))
        setNotStarted(null)
        setAdmission(result)
        setGuest(result.guest)
      } catch (error) {
        setNotStarted(null)
        setEnterName(true)
        setError(error.message)
      } finally {
        setBusy(false)
      }
    },
    [id],
  )

  useEffect(() => {
    // Hẹn giờ 0 ms và huỷ khi cleanup: StrictMode chạy effect hai lần nhưng chỉ gọi API một lần
    // (mỗi lần gọi tạo một khách mới). Có token khách rồi thì không gọi lại.
    if (!linkName || auth.session || guest || enterName) return
    const timer = setTimeout(() => requestGuest(linkName), 0)
    return () => clearTimeout(timer)
  }, [linkName, auth.session, guest, enterName, requestGuest])

  // Chưa tới giờ hẹn: tự thử lại khi tới giờ.
  useEffect(() => {
    if (!notStarted || busy) return
    const timer = setTimeout(
      () => requestGuest(notStarted.name),
      untilStart(notStarted.meeting?.scheduledAt),
    )
    return () => clearTimeout(timer)
  }, [notStarted, busy, requestGuest])

  async function joinGuest(event) {
    event.preventDefault()
    if (busy) return
    const name = new FormData(event.currentTarget).get('name').trim()
    if (!name) {
      setError('Vui lòng nhập tên của bạn.')
      return
    }
    await requestGuest(name)
  }

  if (auth.session || guest)
    return (
      <AuthContext.Provider
        value={{
          ...auth,
          api,
          identityId: auth.session?.user.id || guest.id,
          guestAdmission: admission,
          // Vào từ link có tên: bỏ qua màn kiểm tra thiết bị, vào phòng với mic/camera tắt.
          autoEnter: !auth.session && Boolean(linkName),
        }}
      >
        {children}
      </AuthContext.Provider>
    )

  if (notStarted || (linkName && !enterName))
    return (
      <>
        <Header dark />
        <main className="meeting-gate">
          <section className="card gate-card">
            <span
              className={`gate-symbol ${notStarted ? '' : 'gate-spinner'}`}
              aria-hidden="true"
            >
              {notStarted ? '◷' : '◈'}
            </span>
            {notStarted?.meeting?.title && (
              <span className="eyebrow">{notStarted.meeting.title}</span>
            )}
            <h1>
              {notStarted ? 'Cuộc họp chưa bắt đầu' : 'Đang vào cuộc họp…'}
            </h1>
            <p>
              {notStarted
                ? `Cuộc họp bắt đầu lúc ${formatSchedule(
                    notStarted.meeting?.scheduledAt,
                  )}. Bạn sẽ được vào tự động khi tới giờ.`
                : `Tham gia với tên ${linkName}.`}
            </p>
            <Notice>{error}</Notice>
          </section>
        </main>
      </>
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
