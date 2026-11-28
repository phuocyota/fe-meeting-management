import { useCallback, useEffect, useRef, useState } from 'react'
import {
  RoomAudioRenderer,
  StartAudio,
  useTrackToggle,
  VideoTrack,
  useChat,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
  useSpeakingParticipants,
} from '@livekit/components-react'
import { ConnectionState, Track } from 'livekit-client'
import { useAuth } from '../auth/context'
import { useDisplayName } from '../hooks/useDisplayName'
import { useRoomState } from '../hooks/useRoomState'
import { isAdmin, roleLabels } from '../utils/meeting'
import { Avatar, CopyInvite, Notice, PopupMenu, ThemeToggle } from './Common'
import AdminPanel from './AdminPanel'
import Icon from './Icon'
import DevicePicker from './DevicePicker'
import ParticipantMedia from './ParticipantMedia'

function MeetingDuration({ startedAt }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const started = Date.parse(startedAt)
  const seconds = Number.isFinite(started)
    ? Math.max(0, Math.floor((now - started) / 1000))
    : 0
  const duration = [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
  return (
    <time aria-label="Thời lượng cuộc họp" dateTime={`PT${seconds}S`}>
      {duration}
    </time>
  )
}

function ToolbarLabel({ label, compact = label }) {
  return (
    <span className="toolbar-label">
      <span className="label-full">{label}</span>
      <span className="label-compact" aria-hidden="true" data-label={compact} />
    </span>
  )
}

function MediaControl({ source, allowed, label, report, enabled }) {
  const { buttonProps, pending } = useTrackToggle({
    source,
    onDeviceError: () =>
      report(
        'Không truy cập được thiết bị. Kiểm tra quyền camera, mic hoặc chia sẻ màn hình của trình duyệt.',
        'error',
      ),
  })
  // Apply the external restriction after SDK props: useTrackToggle's disabled
  // flag describes a pending media operation, not the meeting's permissions.
  return (
    <button
      {...buttonProps}
      className={`toolbar-button ${
        source === Track.Source.ScreenShare ? 'share-control' : ''
      }`}
      disabled={!allowed || pending}
      aria-label={label}
    >
      <Icon
        name={
          source === Track.Source.Microphone
            ? 'mic'
            : source === Track.Source.Camera
            ? 'camera'
            : 'screen'
        }
        off={source !== Track.Source.ScreenShare && !enabled}
      />
      <ToolbarLabel
        label={label}
        compact={
          source === Track.Source.ScreenShare
            ? enabled
              ? 'Dừng chia sẻ'
              : 'Chia sẻ'
            : label
        }
      />
    </button>
  )
}

function VideoStage({ view, mode }) {
  const stage = useRef(null)
  const [size, setSize] = useState(null)
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setSize(entry.contentRect))
    observer.observe(stage.current)
    return () => observer.disconnect()
  }, [])
  const speakers = useSpeakingParticipants()
  const displayName = useDisplayName()
  const { identityId } = useAuth()
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )
  const screens = tracks.filter(
    (track) =>
      track.source === Track.Source.ScreenShare &&
      track.publication &&
      !track.publication.isMuted,
  )
  const cameras = tracks.filter((track) => track.source === Track.Source.Camera)
  const featured =
    cameras.find(
      (track) => track.participant.identity === speakers[0]?.identity,
    ) || cameras[0]
  const focused = screens.length > 0 || mode === 'speaker'
  const hands = [...view.participants]
    .filter((person) => person.handRaisedAt)
    .sort((a, b) => Date.parse(a.handRaisedAt) - Date.parse(b.handRaisedAt))
  function tile(track, screen = false) {
    const participant = track.participant
    const person = view.participants.find(
      (item) => item.userId === participant.identity,
    )
    const name = displayName(participant.identity, participant, person)
    const handIndex = hands.findIndex(
      (item) => item.userId === participant.identity,
    )
    const visible = track.publication && !track.publication.isMuted
    return (
      <div
        className={`video-tile ${screen ? 'screen-tile' : ''} ${
          speakers.some((speaker) => speaker.identity === participant.identity)
            ? 'is-speaking'
            : ''
        }`}
        key={`${participant.identity}-${track.source}`}
      >
        {visible ? (
          <VideoTrack trackRef={track} manageSubscription={true} />
        ) : (
          <div className="video-placeholder">
            <p>{name}</p>
          </div>
        )}
        <div className="tile-top">
          {handIndex >= 0 && (
            <span className="hand-badge" title={`Giơ tay thứ ${handIndex + 1}`}>
              <Icon name="hand" /> {handIndex + 1}
            </span>
          )}
        </div>
        <div className="tile-caption">
          <span>
            {!screen && !participant.isMicrophoneEnabled && (
              <span className="muted-mic" title="Mic tắt">
                <Icon name="mic" off />
              </span>
            )}
            <span className="tile-name">
              {screen ? `Màn hình của ${name}` : name}
              {participant.identity === identityId ? ' (Bạn)' : ''}
            </span>
            {person?.isGuest && <span className="role-badge">Khách</span>}
            {person?.role && person.role !== 'participant' && (
              <span className="role-badge">{roleLabels[person.role]}</span>
            )}
          </span>
        </div>
      </div>
    )
  }
  const thumbnails =
    !screens.length && mode === 'speaker'
      ? cameras.filter((track) => track !== featured)
      : cameras
  let columns = Math.max(1, Math.ceil(Math.sqrt(cameras.length)))
  let tileWidth = 0
  if (size && !focused) {
    for (let count = 1; count <= cameras.length; count++) {
      const rows = Math.ceil(cameras.length / count)
      const width = Math.min(
        (size.width - (count - 1) * 6) / count,
        (((size.height - (rows - 1) * 6) / rows) * 16) / 9,
      )
      if (width > tileWidth) {
        tileWidth = width
        columns = count
      }
    }
  }
  return (
    <div
      ref={stage}
      className={`video-stage ${focused ? 'has-screen' : ''}`}
      aria-label={mode === 'gallery' ? 'Chế độ lưới' : 'Chế độ người nói'}
    >
      {screens.length > 0 && (
        <div className="screen-stage">
          {screens.map((track) => tile(track, true))}
        </div>
      )}
      {!screens.length && mode === 'speaker' && featured && (
        <div className="screen-stage speaker-stage">{tile(featured)}</div>
      )}
      {thumbnails.length > 0 && (
        <div
          className="camera-grid"
          style={
            !focused
              ? {
                  '--columns': columns,
                  ...(tileWidth > 0
                    ? { '--tile-width': `${tileWidth}px` }
                    : {}),
                }
              : undefined
          }
        >
          {thumbnails.map((track) => tile(track))}
        </div>
      )}
      {!tracks.length && (
        <div className="stage-empty">Đang kết nối với phòng họp…</div>
      )}
    </div>
  )
}

function MoreControls({ children }) {
  const [expanded, setExpanded] = useState(false)
  const container = useRef(null)
  useEffect(() => {
    if (!expanded) return
    function close(event) {
      if (event.type === 'keydown') {
        if (event.key !== 'Escape') return
        container.current?.querySelector('button')?.focus()
      } else if (container.current?.contains(event.target)) return
      setExpanded(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [expanded])
  return (
    <div className="extra-controls" ref={container}>
      <button
        className="toolbar-button more-toggle"
        aria-expanded={expanded}
        aria-controls="extra-actions"
        onClick={() => setExpanded(!expanded)}
      >
        <span aria-hidden="true" className="more-icon">
          ···
        </span>
        <span>Thêm</span>
      </button>
      <div
        id="extra-actions"
        className={`extra-actions ${expanded ? 'is-open' : ''}`}
        onClick={(event) => {
          if (event.target.closest('button:not(:disabled)')) setExpanded(false)
        }}
      >
        {children}
      </div>
    </div>
  )
}

function ChatPanel({ allowed, report, active, onUnread }) {
  const { chatMessages, send, isSending } = useChat()
  const displayName = useDisplayName()
  const participants = useParticipants()
  const bottom = useRef(null)
  const [draft, setDraft] = useState('')
  const seen = useRef(0)
  useEffect(() => {
    if (!active && chatMessages.length > seen.current) onUnread(true)
    if (active) onUnread(false)
    seen.current = chatMessages.length
  }, [active, chatMessages.length, onUnread])
  useEffect(() => {
    if (active) bottom.current?.scrollIntoView({ block: 'nearest' })
  }, [chatMessages.length, active])
  async function submit(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !allowed || isSending) return
    try {
      await send(text)
      setDraft('')
    } catch {
      report(
        'Không gửi được tin nhắn. Vui lòng kiểm tra kết nối và quyền chat.',
        'error',
      )
    }
  }
  return (
    <aside className="side-panel chat-panel" hidden={!active}>
      <div className="panel-heading">
        <h2>Trò chuyện</h2>
        <span className="live-badge">Trong phòng</span>
      </div>
      <p className="chat-note">
        Tin nhắn chỉ có trong phiên họp hiện tại và không được lưu.
      </p>
      <div
        className="chat-messages"
        role="log"
        aria-label="Tin nhắn trong phòng"
      >
        {chatMessages.length === 0 && (
          <p className="panel-empty">Bắt đầu cuộc trò chuyện cùng đội ngũ.</p>
        )}
        {chatMessages.map((message, index) => (
          <article
            className="chat-message"
            key={message.id || `${message.timestamp}-${index}`}
          >
            <div>
              <strong>
                {displayName(
                  message.from?.identity,
                  participants.find(
                    (person) => person.identity === message.from?.identity,
                  ),
                )}
              </strong>
              <time>
                {new Date(message.timestamp).toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </time>
            </div>
            <p>{message.message}</p>
          </article>
        ))}
        <div ref={bottom} />
      </div>
      <form className="chat-compose" onSubmit={submit}>
        <p className="chat-recipient">
          Gửi đến: <strong>Mọi người</strong>
        </p>
        <label className="sr-only" htmlFor="chat-draft">
          Tin nhắn
        </label>
        <textarea
          id="chat-draft"
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              event.currentTarget.form.requestSubmit()
            }
          }}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            allowed ? 'Nhập tin nhắn…' : 'Bạn không có quyền gửi tin nhắn'
          }
          disabled={!allowed}
          rows="2"
          maxLength={8000}
        />
        <span title={!allowed ? 'Quyền chat đã bị giới hạn' : undefined}>
          <button
            className="primary chat-send"
            disabled={!allowed || isSending || !draft.trim()}
          >
            {isSending ? 'Đang gửi…' : 'Gửi tin nhắn ↑'}
          </button>
        </span>
      </form>
    </aside>
  )
}

function ParticipantsPanel({ view, id }) {
  const { identityId } = useAuth()
  const displayName = useDisplayName()
  const participants = useParticipants()
  return (
    <aside className="side-panel">
      <div className="panel-heading">
        <h2>Người tham gia ({view.participants.length})</h2>
      </div>
      <ul className="people-list panel-scroll">
        {view.participants.map((person) => (
          <li key={person.userId}>
            <div className="person-line">
              <Avatar
                name={displayName(
                  person.userId,
                  participants.find((p) => p.identity === person.userId),
                  person,
                )}
              />
              <div>
                <strong>
                  {displayName(
                    person.userId,
                    participants.find((p) => p.identity === person.userId),
                    person,
                  )}
                  {person.userId === identityId && ' (Bạn)'}
                  {person.isGuest && <span className="role-badge">Khách</span>}
                </strong>
                <small>{roleLabels[person.role]}</small>
              </div>
              <ParticipantMedia
                person={person}
                live={participants.find((p) => p.identity === person.userId)}
              />
              {person.handRaisedAt && (
                <span title="Đang giơ tay">
                  <Icon name="hand" />
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="panel-footer">
        <CopyInvite id={id} compact label="Mời" />
      </div>
    </aside>
  )
}

export default function MeetingRoom({
  id,
  admission,
  onLeave,
  onEnded,
  statusNotice,
}) {
  const { api, identityId } = useAuth()
  const room = useRoomContext()
  const connection = useConnectionState()
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant()
  const [notice, setNotice] = useState(null)
  const report = useCallback(
    (message, kind = 'info') => setNotice({ message, kind }),
    [],
  )
  useEffect(() => {
    if (notice?.kind !== 'info') return
    const timer = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [notice])
  const { view, role, lobby, syncError, refresh } = useRoomState(
    id,
    admission,
    report,
  )
  const [panel, setPanel] = useState('people')
  const [mode, setMode] = useState('gallery')
  const [unread, setUnread] = useState(false)
  const [handBusy, setHandBusy] = useState(false)
  const admin = isAdmin(role)
  const mine = view.participants.find((person) => person.userId === identityId)
  const permissions = localParticipant.permissions
  const canPublish =
    mine?.canPublish !== false && permissions?.canPublish !== false
  const settings = view.meeting.settings
  const connected = connection === ConnectionState.Connected
  const mediaAllowed = (key, source) =>
    connected &&
    canPublish &&
    (admin || settings[key] !== false) &&
    (!permissions?.canPublishSources?.length ||
      permissions.canPublishSources.includes(Track.sourceToProto(source)))
  const micAllowed = mediaAllowed('allowMicrophone', Track.Source.Microphone)
  const cameraAllowed = mediaAllowed('allowCamera', Track.Source.Camera)
  const screenAllowed = mediaAllowed(
    'allowScreenShare',
    Track.Source.ScreenShare,
  )
  const chatAllowed =
    connected &&
    (admin || (canPublish && settings.allowChat !== false)) &&
    permissions?.canPublishData !== false
  const previousAccess = useRef(null)
  useEffect(() => {
    const next = {
      role,
      canPublish,
      micAllowed,
      cameraAllowed,
      screenAllowed,
      chatAllowed,
    }
    const previous = previousAccess.current
    previousAccess.current = connected ? next : null
    if (!connected) return
    if (
      previous &&
      Object.keys(next).some((key) => next[key] !== previous[key])
    ) {
      report(
        'Quyền của bạn đã được cập nhật. Kiểm tra các điều khiển đang được cho phép.',
        'info',
      )
    }
  }, [
    role,
    canPublish,
    micAllowed,
    cameraAllowed,
    screenAllowed,
    chatAllowed,
    connected,
    report,
  ])
  const raised = Boolean(
    mine?.handRaisedAt || localParticipant.attributes.handRaisedAt,
  )
  async function toggleHand() {
    setHandBusy(true)
    try {
      await api.action(id, '/hand', raised ? 'DELETE' : 'POST')
      await refresh()
    } catch (error) {
      report(error.message, 'error')
    } finally {
      setHandBusy(false)
    }
  }
  useEffect(() => {
    // Also stop local tracks when permissions/settings change, including applied:false.
    const local = room.localParticipant
    const jobs = []
    if (!micAllowed && local.isMicrophoneEnabled)
      jobs.push(local.setMicrophoneEnabled(false))
    if (!cameraAllowed && local.isCameraEnabled)
      jobs.push(local.setCameraEnabled(false))
    if (!screenAllowed && local.isScreenShareEnabled)
      jobs.push(local.setScreenShareEnabled(false))
    Promise.allSettled(jobs)
  }, [micAllowed, cameraAllowed, screenAllowed, room])
  const reason = !connected
    ? 'Chưa kết nối đến phòng họp'
    : !canPublish
    ? 'Bạn đã bị khóa quyền phát'
    : 'Chủ trì đã tắt tính năng này'
  return (
    <div className="meeting-shell">
      <RoomAudioRenderer />
      <header className="meeting-header">
        <div className="meeting-identity">
          <PopupMenu
            className="meeting-info"
            ariaLabel="Thông tin cuộc họp"
            label={<Icon name="shield" />}
          >
            <h2>{view.meeting.title}</h2>
            <p>
              Mã cuộc họp: <strong>{id}</strong>
            </p>
            <p>Vai trò của tôi: {roleLabels[role]}</p>
            <CopyInvite id={id} />
          </PopupMenu>
          <span className="room-brand">
            Ichi <b>Meeting</b>
          </span>
          <h1>{view.meeting.title}</h1>
        </div>
        <div className="button-row">
          <ThemeToggle />
          <PopupMenu
            className="view-menu"
            ariaLabel="Chuyển chế độ xem"
            label={
              <>
                <Icon name={mode === 'gallery' ? 'gallery' : 'speaker'} /> Chế
                độ xem
              </>
            }
          >
            <button
              aria-pressed={mode === 'speaker'}
              onClick={() => setMode('speaker')}
            >
              Người nói
            </button>
            <button
              aria-pressed={mode === 'gallery'}
              onClick={() => setMode('gallery')}
            >
              Lưới
            </button>
          </PopupMenu>
          <MeetingDuration startedAt={view.meeting.createdAt} />
        </div>
      </header>
      <div className="room-notices">
        {statusNotice}
        <Notice kind={notice?.kind}>
          {notice && (
            <>
              <span>{notice.message}</span>
              {admin &&
                notice.message === 'Có người đang xin vào phòng họp.' && (
                  <button
                    onClick={() => {
                      setPanel('people')
                      setNotice(null)
                    }}
                  >
                    Xem
                  </button>
                )}
              <button
                className="notice-close"
                aria-label="Đóng thông báo"
                onClick={() => setNotice(null)}
              >
                ×
              </button>
            </>
          )}
        </Notice>
        <Notice>
          {syncError && (
            <>
              {syncError} <button onClick={refresh}>Đồng bộ lại</button>
            </>
          )}
        </Notice>
        <StartAudio label="Bấm để nghe âm thanh cuộc họp" />
      </div>
      <div className="room-content">
        <VideoStage view={view} mode={mode} />
        {panel && panel !== 'end' && (
          <button
            className="panel-close"
            aria-label="Đóng bảng bên"
            onClick={() => setPanel(null)}
          >
            <Icon name="close" />
          </button>
        )}
        <ChatPanel
          active={panel === 'chat'}
          onUnread={setUnread}
          allowed={chatAllowed}
          report={report}
        />
        {(panel === 'people' ||
          ((panel === 'settings' || panel === 'end') && admin)) &&
          (admin ? (
            <AdminPanel
              key={panel}
              mode={panel}
              onDismiss={() => setPanel(null)}
              id={id}
              view={view}
              role={role}
              lobby={lobby}
              refresh={refresh}
              report={report}
              onEnded={onEnded}
            />
          ) : (
            <ParticipantsPanel view={view} id={id} />
          ))}
      </div>
      <footer className="control-bar">
        <div className="toolbar-scroll">
          <div className="media-controls">
            {[
              [
                Track.Source.Microphone,
                micAllowed,
                isMicrophoneEnabled ? 'Tắt tiếng' : 'Bật tiếng',
                isMicrophoneEnabled,
              ],
              [
                Track.Source.Camera,
                cameraAllowed,
                isCameraEnabled ? 'Tắt video' : 'Bật video',
                isCameraEnabled,
              ],
            ].map(([source, allowed, label, enabled]) => (
              <span
                className="device-control"
                key={source}
                title={!allowed ? reason : label}
              >
                <MediaControl
                  source={source}
                  allowed={allowed}
                  label={label}
                  enabled={enabled}
                  report={report}
                />
                <PopupMenu
                  className="device-menu"
                  label="⌃"
                  ariaLabel={
                    source === Track.Source.Microphone
                      ? 'Thiết bị âm thanh'
                      : 'Thiết bị camera'
                  }
                >
                  <DevicePicker
                    kind={
                      source === Track.Source.Microphone
                        ? 'audioinput'
                        : 'videoinput'
                    }
                    disabled={!allowed}
                    onChange={(deviceId) =>
                      room
                        .switchActiveDevice(
                          source === Track.Source.Microphone
                            ? 'audioinput'
                            : 'videoinput',
                          deviceId || 'default',
                        )
                        .catch(() =>
                          report('Không chuyển được thiết bị.', 'error'),
                        )
                    }
                  />
                  {source === Track.Source.Microphone && (
                    <DevicePicker
                      kind="audiooutput"
                      onChange={(deviceId) =>
                        room
                          .switchActiveDevice(
                            'audiooutput',
                            deviceId || 'default',
                          )
                          .catch(() =>
                            report(
                              'Trình duyệt chưa hỗ trợ đổi loa hoặc thiết bị không khả dụng.',
                              'info',
                            ),
                          )
                      }
                    />
                  )}
                </PopupMenu>
              </span>
            ))}
          </div>
          <div className="central-controls">
            <button
              className="toolbar-button"
              aria-label="Người tham gia"
              aria-pressed={panel === 'people'}
              onClick={() => setPanel(panel === 'people' ? null : 'people')}
            >
              <span className="toolbar-icon">
                <Icon name="people" />
                <span className="toolbar-count">
                  {view.participants.length}
                </span>
                {admin && view.lobbyCount > 0 && (
                  <span className="unread-dot" />
                )}
              </span>
              <ToolbarLabel label="Người tham gia" compact="Thành viên" />
            </button>
            <span title={!chatAllowed ? reason : 'Trò chuyện trong phòng'}>
              <button
                className="toolbar-button"
                aria-label={`Trò chuyện${!chatAllowed ? ' · Chỉ xem' : ''}`}
                disabled={!chatAllowed}
                aria-pressed={panel === 'chat'}
                onClick={() => setPanel(panel === 'chat' ? null : 'chat')}
              >
                <span className="toolbar-icon">
                  <Icon name="chat" />
                  {unread && <span className="unread-dot" />}
                </span>
                <ToolbarLabel
                  label={`Trò chuyện${!chatAllowed ? ' · Chỉ xem' : ''}`}
                  compact="Trò chuyện"
                />
              </button>
            </span>
            <MoreControls>
              <span title={!screenAllowed ? reason : 'Chia sẻ màn hình'}>
                <MediaControl
                  source={Track.Source.ScreenShare}
                  allowed={screenAllowed}
                  enabled={isScreenShareEnabled}
                  label={
                    isScreenShareEnabled ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'
                  }
                  report={report}
                />
              </span>
              <span title={!connected ? reason : 'Giơ tay phát biểu'}>
                <button
                  className="toolbar-button"
                  aria-pressed={raised}
                  disabled={!connected || handBusy}
                  onClick={toggleHand}
                >
                  <Icon name="hand" />
                  <span>{raised ? 'Hạ tay' : 'Giơ tay'}</span>
                </button>
              </span>
              {admin && (
                <button
                  className="toolbar-button"
                  aria-label="Quản lý / Bảo mật"
                  aria-pressed={panel === 'settings'}
                  onClick={() =>
                    setPanel(panel === 'settings' ? null : 'settings')
                  }
                >
                  <Icon name="shield" />
                  <ToolbarLabel label="Bảo mật" />
                </button>
              )}
            </MoreControls>
          </div>
        </div>
        <div className="leave-group">
          {role === 'host' ? (
            <PopupMenu
              className="leave-options"
              ariaLabel="Rời hoặc kết thúc cuộc họp"
              label="Kết thúc"
            >
              <button className="danger-text" onClick={() => setPanel('end')}>
                Kết thúc cuộc họp cho mọi người
              </button>
              <button onClick={onLeave}>Rời cuộc họp</button>
            </PopupMenu>
          ) : (
            <button
              className="danger leave-control"
              aria-label="Rời hoặc kết thúc cuộc họp"
              onClick={onLeave}
            >
              Rời
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
