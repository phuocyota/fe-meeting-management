import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LiveKitRoom } from '@livekit/components-react'
import { DisconnectReason } from 'livekit-client'
import { useAuth } from '../auth/context'
import { Header, Notice } from '../components/Common'
import MeetingRoom from '../components/MeetingRoom'
import MeetingPreview from '../components/MeetingPreview'
import {
  formatSchedule,
  meetingErrorStatus,
  untilStart,
} from '../utils/meeting'

const statusCopy = {
  missing: ['Không tìm thấy cuộc họp', 'Kiểm tra lại link hoặc mã cuộc họp.'],
  pending: [
    'Bạn đang ở phòng chờ',
    'Vui lòng đợi, chủ trì sẽ cho bạn vào.',
  ],
  denied: [
    'Yêu cầu tham gia bị từ chối',
    'Chủ trì đã từ chối yêu cầu tham gia của bạn.',
  ],
  kicked: [
    'Bạn đã bị mời ra',
    'Bạn chỉ có thể vào lại khi quản trị viên duyệt lại yêu cầu.',
  ],
  not_started: [
    'Cuộc họp chưa bắt đầu',
    'Bạn sẽ được vào tự động khi tới giờ hẹn.',
  ],
  locked: [
    'Cuộc họp đã bị khóa',
    'Chủ trì đang khóa phòng. Bạn có thể thử lại sau.',
  ],
  ended: [
    'Cuộc họp đã kết thúc',
    'Cảm ơn bạn đã tham gia. Hẹn gặp lại ở cuộc họp tiếp theo.',
  ],
  left: ['Bạn đã rời cuộc họp', 'Camera và mic đã được ngắt kết nối.'],
  disconnected: [
    'Kết nối đã bị gián đoạn',
    'Không thể kết nối lại với phòng họp. Bạn có thể thử tham gia lại.',
  ],
  error: ['Chưa thể vào cuộc họp', ''],
}

export default function MeetingPage({ createdAdmission, onAdmissionUsed }) {
  const { id } = useParams()
  const { api, session, guestAdmission, autoEnter } = useAuth()
  const [initial] = useState(
    () =>
      guestAdmission ||
      (createdAdmission?.meeting?.id === id ? createdAdmission : null),
  )
  const [admission, setAdmission] = useState(initial)
  // Khách vào từ link có tên: không qua màn kiểm tra thiết bị, mic/camera tắt (bật lại trong phòng).
  const [mediaChoices, setMediaChoices] = useState(() =>
    autoEnter
      ? {
          audio: false,
          video: false,
          audioDevice: '',
          videoDevice: '',
          generation: 0,
        }
      : null,
  )
  const [status, setStatus] = useState(initial?.status || 'loading')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [generation, setGeneration] = useState(0)
  const generationRef = useRef(0)
  const [renewing, setRenewing] = useState(false)
  const [renewalNotice, setRenewalNotice] = useState(false)
  const intentional = useRef(false)
  const active = useRef(true)
  const operation = useRef(0)
  const controller = useRef(null)

  const join = useCallback(
    async ({ renewal = false } = {}) => {
      const current = ++operation.current
      controller.current?.abort()
      controller.current = new AbortController()
      setBusy(true)
      setError('')
      try {
        const result = await api.join(id, controller.current.signal)
        if (!active.current || current !== operation.current) return
        if (
          result.status === 'admitted' &&
          (!result.serverUrl || !result.token)
        )
          throw new Error('Máy chủ chưa trả đủ thông tin kết nối phòng họp.')
        if (renewal && result.status === 'admitted') {
          // The SDK reconnects with the fresh token by creating a new room instance.
          // Ordinary RoomView and realtime updates never remount the room.
          intentional.current = true
          generationRef.current += 1
          setGeneration(generationRef.current)
          setRenewalNotice(true)
        }
        setAdmission(result)
        setStatus(result.status)
        setRenewing(false)
      } catch (error) {
        if (
          !active.current ||
          current !== operation.current ||
          error.name === 'AbortError'
        )
          return
        setError(error.message)
        if (!renewal || error.status === 403 || error.status === 404) {
          intentional.current = true
          setStatus((previous) =>
            previous === 'pending' &&
            (error.status === 0 || error.status >= 500)
              ? 'pending'
              : meetingErrorStatus(error),
          )
        } else setRenewing(true)
      } finally {
        if (active.current && current === operation.current) setBusy(false)
      }
    },
    [api, id],
  )

  useEffect(() => {
    if (initial) onAdmissionUsed()
  }, [initial, onAdmissionUsed])

  useEffect(() => {
    active.current = true
    const timer = !initial ? setTimeout(() => join(), 0) : null
    return () => {
      active.current = false
      intentional.current = true
      clearTimeout(timer)
      controller.current?.abort()
    }
    // The admission supplied by creation is only used on this page's first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [join])

  useEffect(() => {
    if (status !== 'pending' || busy) return
    const timer = setTimeout(() => join(), 4000)
    return () => clearTimeout(timer)
  }, [status, admission, busy, join])

  useEffect(() => {
    if (status !== 'not_started' || busy) return
    const timer = setTimeout(
      () => join(),
      untilStart(admission?.meeting?.scheduledAt),
    )
    return () => clearTimeout(timer)
  }, [status, admission, busy, join])

  useEffect(() => {
    if (status !== 'admitted' || busy) return
    const expires = Date.parse(admission?.expiresAt)
    if (!Number.isFinite(expires)) return
    const delay = renewing ? 5000 : Math.max(1000, expires - Date.now() - 30000)
    const timer = setTimeout(
      () => join({ renewal: true }),
      Math.min(delay, 2147483647),
    )
    return () => clearTimeout(timer)
  }, [admission, status, join, renewing, busy])

  const disconnected = useCallback(
    async (reason) => {
      if (intentional.current || !active.current) return
      const current = ++operation.current
      setBusy(false)
      try {
        const meeting = await api.detail(id)
        if (!active.current || current !== operation.current) return
        if (
          meeting.status === 'ended' ||
          reason === DisconnectReason.ROOM_DELETED
        ) {
          setStatus('ended')
          return
        }
        if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
          const result = await api.join(id)
          if (!active.current || current !== operation.current) return
          setStatus(
            result.status === 'admitted' ? 'disconnected' : result.status,
          )
          setAdmission(result)
          if (result.status === 'admitted')
            setError('Máy chủ đã ngắt kết nối của bạn. Vui lòng thử vào lại.')
        } else {
          setStatus('disconnected')
          setError(
            reason === DisconnectReason.DUPLICATE_IDENTITY
              ? 'Tài khoản của bạn đã kết nối với phòng này từ một cửa sổ hoặc thiết bị khác.'
              : 'Kết nối đến phòng họp đã bị ngắt.',
          )
        }
      } catch (error) {
        if (!active.current || current !== operation.current) return
        setError(error.message)
        setStatus(
          error.status === 404
            ? reason === DisconnectReason.ROOM_DELETED
              ? 'ended'
              : meetingErrorStatus(error)
            : error.status === 403
            ? 'error'
            : reason === DisconnectReason.PARTICIPANT_REMOVED
            ? 'kicked'
            : 'disconnected',
        )
      }
    },
    [api, id],
  )
  function stop(nextStatus) {
    intentional.current = true
    ++operation.current
    controller.current?.abort()
    setBusy(false)
    setMediaChoices(null)
    setStatus(nextStatus)
  }
  function retry() {
    intentional.current = false
    setMediaChoices(null)
    setStatus('loading')
    join()
  }
  if (status === 'admitted' && admission && !mediaChoices)
    return (
      <MeetingPreview
        admission={admission}
        onEnter={(choices) => setMediaChoices({ ...choices, generation })}
        onLeave={() => stop('left')}
        statusNotice={
          <Notice kind="warning">
            {renewing && (
              <>
                Chưa gia hạn được token. Hệ thống sẽ thử lại. {error}{' '}
                <button disabled={busy} onClick={() => join({ renewal: true })}>
                  Gia hạn lại
                </button>
              </>
            )}
          </Notice>
        }
      />
    )
  if (status === 'admitted' && admission)
    return (
      <LiveKitRoom
        key={`${id}-${generation}`}
        serverUrl={admission.serverUrl}
        token={admission.token}
        audio={
          generation === mediaChoices.generation && mediaChoices.audio
            ? { deviceId: mediaChoices.audioDevice || undefined }
            : false
        }
        video={
          generation === mediaChoices.generation && mediaChoices.video
            ? { deviceId: mediaChoices.videoDevice || undefined }
            : false
        }
        connect={true}
        onConnected={() => {
          if (generation === generationRef.current) {
            intentional.current = false
            setError('')
          }
        }}
        onDisconnected={(reason) => {
          if (generation === generationRef.current) disconnected(reason)
        }}
        onError={() =>
          setError(
            'Không kết nối được LiveKit. Kiểm tra mạng, máy chủ media hoặc quyền truy cập thiết bị.',
          )
        }
      >
        <MeetingRoom
          id={id}
          admission={admission}
          statusNotice={
            <>
              <Notice kind="warning">
                {renewing && (
                  <>
                    Chưa gia hạn được token. Hệ thống sẽ thử lại. {error}{' '}
                    <button
                      disabled={busy}
                      onClick={() => join({ renewal: true })}
                    >
                      Gia hạn lại
                    </button>
                  </>
                )}
              </Notice>
              <Notice kind="info">
                {renewalNotice && (
                  <>
                    Kết nối đã được làm mới. Vui lòng bật lại mic và camera nếu
                    cần.
                    <button
                      className="notice-close"
                      aria-label="Đóng thông báo làm mới kết nối"
                      onClick={() => setRenewalNotice(false)}
                    >
                      ×
                    </button>
                  </>
                )}
              </Notice>
              <Notice>
                {!renewing && error && (
                  <>
                    {error}{' '}
                    <button
                      disabled={busy}
                      onClick={() => join({ renewal: true })}
                    >
                      Kết nối lại
                    </button>
                  </>
                )}
              </Notice>
            </>
          }
          onLeave={() => stop('left')}
          onEnded={() => stop('ended')}
        />
      </LiveKitRoom>
    )
  const [title, description] = statusCopy[status] || [
    'Đang chuẩn bị phòng họp…',
    'Vui lòng đợi trong giây lát.',
  ]
  return (
    <>
      <Header dark />
      <main className="meeting-gate">
        <div className="card gate-card">
          <span
            className={`gate-symbol ${
              status === 'pending' || status === 'loading' ? 'gate-spinner' : ''
            }`}
            aria-hidden="true"
          >
            {status === 'pending'
              ? '◷'
              : status === 'ended' || status === 'left'
              ? '✓'
              : '◈'}
          </span>
          {admission?.meeting?.title && (
            <span className="eyebrow">{admission.meeting.title}</span>
          )}
          <h1>{title}</h1>
          <p className={status === 'pending' ? 'gate-wait-message' : undefined}>
            {status === 'not_started' && admission?.meeting?.scheduledAt
              ? `Cuộc họp bắt đầu lúc ${formatSchedule(
                  admission.meeting.scheduledAt,
                )}. ${description}`
              : description}
          </p>
          <Notice>{error}</Notice>
          {status === 'pending' && (
            <>
              <span className="status-online" role="status">
                Đang chờ duyệt
              </span>
              <button onClick={() => stop('left')}>Hủy chờ</button>
            </>
          )}
          <div className="button-row">
            {[
              'locked',
              'denied',
              'kicked',
              'disconnected',
              'error',
              'left',
            ].includes(status) && (
              <button className="primary" disabled={busy} onClick={retry}>
                Thử tham gia lại
              </button>
            )}
            {session && (
              <Link className="button" to="/">
                Về trang chủ
              </Link>
            )}
          </div>
          <small className="muted">Mã cuộc họp: {id}</small>
        </div>
      </main>
    </>
  )
}
