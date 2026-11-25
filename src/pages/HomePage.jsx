import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import FormDialog from '../components/FormDialog'
import CoHostPicker from '../components/CoHostPicker'
import Icon from '../components/Icon'
import { CopyInvite, Header, Notice } from '../components/Common'
import { meetingIdFromInput, roleLabels } from '../utils/meeting'

export default function HomePage({ onCreated }) {
  const { api, session } = useAuth()
  const [coHosts, setCoHosts] = useState([])
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [joinError, setJoinError] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  const load = useCallback(
    async (signal) => {
      try {
        setMeetings(await api.list(signal))
        setError('')
      } catch (error) {
        if (error.name !== 'AbortError') setError(error.message)
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [api],
  )
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => load(controller.signal), 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [load])
  async function create(event) {
    event.preventDefault()
    setCreating(true)
    setFormError('')
    const form = new FormData(event.currentTarget)
    try {
      const result = await api.create({
        title: form.get('title').trim(),
        waitingRoom: form.get('waitingRoom') === 'on',
        maxParticipants: Number(form.get('maxParticipants')),
        coHostIds: coHosts.map((user) => user.id),
      })
      onCreated(result)
      navigate(`/meeting/${encodeURIComponent(result.meeting.id)}`)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setCreating(false)
    }
  }
  function join(event) {
    event.preventDefault()
    setJoinError('')
    try {
      navigate(
        `/meeting/${encodeURIComponent(
          meetingIdFromInput(
            new FormData(event.currentTarget).get('invitation'),
          ),
        )}`,
      )
    } catch (error) {
      setJoinError(error.message)
    }
  }
  return (
    <>
      <Header />
      <main className="dashboard">
        <div className="home-workspace">
          <div className="home-start">
            <div className="home-greeting">
              <h1>Xin chào, {session?.user?.name}</h1>
              <p>Bắt đầu cuộc họp mới hoặc tham gia bằng link mời.</p>
            </div>
            <section className="home-launcher" aria-label="Bắt đầu cuộc họp">
              <button
                className="launch-action new-meeting"
                onClick={() => setShowCreate(true)}
              >
                <span>
                  <Icon name="camera" />
                </span>
                Cuộc họp mới
              </button>
              <button
                className="launch-action"
                onClick={() => setShowJoin(true)}
              >
                <span>
                  <Icon name="plus" />
                </span>
                Tham gia
              </button>
              <span title="Sắp có">
                <button className="launch-action" disabled>
                  <span>
                    <Icon name="calendar" />
                  </span>
                  Lên lịch
                </button>
              </span>
              <span title="Sắp có">
                <button className="launch-action" disabled>
                  <span>
                    <Icon name="screen" />
                  </span>
                  Chia sẻ màn hình
                </button>
              </span>
            </section>
          </div>
          <section className="home-agenda card">
            <div className="home-clock">
              <time>
                {now.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
              <p>
                {now.toLocaleDateString('vi-VN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <section className="meetings-section">
              <div className="section-heading">
                <div>
                  <h2>
                    Cuộc họp đang diễn ra{' '}
                    <span className="count">{meetings.length}</span>
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setLoading(true)
                    setError('')
                    load()
                  }}
                  disabled={loading}
                >
                  {loading ? 'Đang tải…' : '↻ Làm mới'}
                </button>
              </div>
              <Notice>{error}</Notice>
              {loading ? (
                <div className="empty card" role="status">
                  Đang tải danh sách cuộc họp…
                </div>
              ) : meetings.length ? (
                <div className="meeting-cards">
                  {meetings.map((meeting) => (
                    <article className="meeting-card" key={meeting.id}>
                      <h3>{meeting.title}</h3>
                      <p>
                        Bắt đầu{' '}
                        {new Date(meeting.createdAt).toLocaleString('vi-VN')}
                      </p>
                      <span className="role-badge">
                        {roleLabels[meeting.myRole] || 'Thành viên'}
                      </span>
                      <Link
                        className="button primary"
                        to={`/meeting/${encodeURIComponent(meeting.id)}`}
                      >
                        Vào
                      </Link>
                      <CopyInvite id={meeting.id} compact />
                    </article>
                  ))}
                </div>
              ) : (
                !error && (
                  <div className="empty card">
                    <div className="empty-icon">▧</div>
                    <h3>Không có cuộc họp đang diễn ra</h3>
                    <p>
                      Tạo cuộc họp mới hoặc tham gia bằng link mời để bắt đầu
                      kết nối.
                    </p>
                  </div>
                )
              )}
            </section>
          </section>
        </div>
        {showCreate && (
          <FormDialog
            title="Cuộc họp mới"
            busy={creating}
            onClose={() => setShowCreate(false)}
          >
            <form className="create-form" onSubmit={create}>
              <div className="section-heading">
                <h2>Cuộc họp mới</h2>
                <span className="muted">Bạn sẽ là chủ trì</span>
              </div>
              <Notice>{formError}</Notice>
              <div className="form-grid">
                <label>
                  Tiêu đề cuộc họp
                  <input
                    name="title"
                    autoFocus
                    placeholder="Ví dụ: Họp giao ban tuần"
                    required
                  />
                </label>
                <label>
                  Số người tối đa
                  <input
                    name="maxParticipants"
                    type="number"
                    defaultValue="100"
                    min="1"
                    required
                  />
                </label>
              </div>
              <CoHostPicker selected={coHosts} onChange={setCoHosts} />
              <div className="section-heading">
                <label className="check">
                  <input name="waitingRoom" type="checkbox" defaultChecked />{' '}
                  Bật phòng chờ, duyệt người tham gia trước khi vào
                </label>
                <button className="primary" disabled={creating}>
                  {creating ? 'Đang tạo…' : 'Tạo và vào phòng →'}
                </button>
              </div>
            </form>
          </FormDialog>
        )}
        {showJoin && (
          <FormDialog
            title="Tham gia cuộc họp"
            onClose={() => setShowJoin(false)}
          >
            <form className="join-card" onSubmit={join}>
              <div>
                <h2>
                  <Icon name="plus" /> Tham gia cuộc họp
                </h2>
                <p>Có lời mời? Nhập link hoặc mã cuộc họp.</p>
              </div>
              <div className="input-action">
                <input
                  name="invitation"
                  aria-label="Link hoặc mã cuộc họp"
                  placeholder="Dán link hoặc nhập mã cuộc họp"
                  required
                />
                <button type="submit">Tham gia →</button>
              </div>
              <Notice>{joinError}</Notice>
            </form>
          </FormDialog>
        )}
      </main>
    </>
  )
}
