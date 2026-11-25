import { useState } from 'react'
import { useParticipants } from '@livekit/components-react'
import { useAuth } from '../auth/context'
import { useDisplayName } from '../hooks/useDisplayName'
import { Avatar, ConfirmDialog, CopyInvite, Notice, PopupMenu } from './Common'
import { memberPath, participantActions, roleLabels } from '../utils/meeting'

import ParticipantMedia from './ParticipantMedia'

const settingLabels = {
  locked: 'Khóa phòng',
  waitingRoom: 'Bật phòng chờ',
  allowMicrophone: 'Cho phép bật mic',
  allowCamera: 'Cho phép bật camera',
  allowScreenShare: 'Cho phép chia sẻ màn hình',
  allowChat: 'Cho phép gửi tin nhắn',
}

export default function AdminPanel({
  id,
  view,
  role,
  lobby,
  refresh,
  report,
  onEnded,
  mode = 'people',
  onDismiss,
}) {
  const { api, identityId } = useAuth()
  const displayName = useDisplayName()
  const participants = useParticipants()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState(() =>
    mode === 'end'
      ? {
          title: 'Kết thúc cuộc họp?',
          description:
            'Thao tác này sẽ đóng phòng và ngắt kết nối tất cả mọi người.',
        }
      : null,
  )
  const name = (userId) =>
    displayName(
      userId,
      participants.find((person) => person.identity === userId),
      [...view.participants, ...lobby].find(
        (person) => person.userId === userId,
      ),
    )
  async function run(path, method = 'POST', body, after) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await api.action(id, path, method, body)
      if (result?.applied === false)
        report(
          'Thay đổi đã được lưu. LiveKit tạm thời chưa áp dụng được; quyền mới sẽ áp dụng khi người đó vào lại.',
          'warning',
        )
      after?.()
      await refresh()
      setConfirmation(null)
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }
  function action(participant, type) {
    const userId = encodeURIComponent(participant.userId)
    const nameLabel = name(participant.userId)
    const operations = {
      mute: () =>
        run(memberPath(participant.userId, 'mute'), 'POST', {
          audio: true,
          video: false,
        }),
      camera: () =>
        run(memberPath(participant.userId, 'mute'), 'POST', {
          audio: false,
          video: true,
        }),
      publish: () =>
        run(memberPath(participant.userId, 'publish'), 'PUT', {
          allowed: !participant.canPublish,
        }),
      cohost: () =>
        run(
          `/cohosts/${userId}`,
          participant.role === 'cohost' ? 'DELETE' : 'PUT',
        ),
      hand: () => run(memberPath(participant.userId, 'hand'), 'DELETE'),
      kick: () =>
        setConfirmation({
          title: `Mời ${nameLabel} ra khỏi phòng?`,
          description:
            'Người này sẽ bị ngắt kết nối và chỉ vào lại được khi được quản trị viên duyệt lại.',
          execute: () => run(memberPath(participant.userId, 'kick')),
        }),
      host: () =>
        setConfirmation({
          title: `Chuyển chủ trì cho ${nameLabel}?`,
          description: 'Bạn sẽ trở thành đồng chủ trì sau khi chuyển quyền.',
          execute: () => run(`/host/${userId}`, 'PUT'),
        }),
    }
    operations[type]?.()
  }
  return (
    <>
      {mode !== 'end' && (
        <aside className="side-panel admin-panel">
          <div className="panel-heading">
            <h2>
              {mode === 'settings'
                ? 'Bảo mật & cài đặt'
                : `Người tham gia (${view.participants.length})`}
            </h2>
          </div>
          <Notice>{error}</Notice>
          <div className="panel-scroll">
            {mode === 'people' && lobby.length > 0 && (
              <>
                <div className="section-heading">
                  <h3>Phòng chờ ({lobby.length})</h3>
                  <button
                    disabled={busy || !lobby.length}
                    onClick={() => run('/lobby/admit-all')}
                  >
                    Duyệt tất cả
                  </button>
                </div>
                <ul className="people-list">
                  {lobby.map((person) => (
                    <li key={person.userId}>
                      <strong>
                        {name(person.userId)}{' '}
                        {person.isGuest && (
                          <span className="role-badge">Khách</span>
                        )}
                      </strong>
                      <small className="muted">
                        Yêu cầu lúc{' '}
                        {person.requestedAt
                          ? new Date(person.requestedAt).toLocaleTimeString(
                              'vi-VN',
                            )
                          : 'vừa xong'}
                      </small>
                      <div className="button-row">
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() =>
                            run(memberPath(person.userId, 'admit'))
                          }
                        >
                          Cho vào
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => run(memberPath(person.userId, 'deny'))}
                        >
                          Xóa
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {mode === 'people' && (
              <>
                <p className="muted small">
                  {view.participants.length} người đang có mặt
                </p>
                <ul className="people-list participants-list">
                  {view.participants.map((participant) => {
                    const actions = participantActions(
                      role,
                      identityId,
                      participant,
                    )
                    const labels = {
                      mute: 'Tắt mic',
                      camera: 'Tắt camera',
                      publish: participant.canPublish
                        ? 'Khóa quyền phát'
                        : 'Mở quyền phát',
                      cohost:
                        participant.role === 'cohost'
                          ? 'Thu hồi đồng chủ trì'
                          : 'Cấp đồng chủ trì',
                      hand: 'Hạ tay',
                      kick: 'Mời ra khỏi phòng',
                      host: 'Chuyển chủ trì',
                    }
                    return (
                      <li key={participant.userId}>
                        <div className="person-line">
                          <Avatar name={name(participant.userId)} />
                          <div>
                            <strong>
                              {name(participant.userId)}
                              {participant.isGuest && (
                                <span className="role-badge">Khách</span>
                              )}
                              {participant.userId === identityId
                                ? ' (Bạn)'
                                : ''}
                            </strong>
                            <small>
                              {roleLabels[participant.role]}
                              {!participant.canPublish ? ' · Đã khóa phát' : ''}
                            </small>
                          </div>
                          <ParticipantMedia
                            person={participant}
                            live={participants.find(
                              (p) => p.identity === participant.userId,
                            )}
                          />
                          {participant.handRaisedAt && (
                            <span title="Đang giơ tay">✋</span>
                          )}
                        </div>
                        {actions.length > 0 && (
                          <div className="person-actions">
                            {actions.includes('mute') && (
                              <button
                                disabled={busy}
                                onClick={() => action(participant, 'mute')}
                              >
                                Tắt tiếng
                              </button>
                            )}
                            <PopupMenu
                              label="Thêm ▾"
                              ariaLabel={`Thêm thao tác với ${name(
                                participant.userId,
                              )}`}
                            >
                              {actions
                                .filter((type) => type !== 'mute')
                                .map((type) => (
                                  <button
                                    key={type}
                                    disabled={busy}
                                    className={
                                      type === 'kick' ? 'danger-text' : ''
                                    }
                                    onClick={() => action(participant, type)}
                                  >
                                    {labels[type]}
                                  </button>
                                ))}
                            </PopupMenu>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
            {mode === 'settings' && (
              <>
                <p className="muted small">
                  Giới hạn mic, camera, màn hình và chat áp dụng cho người tham
                  gia thường. Tắt phòng chờ sẽ duyệt toàn bộ người đang chờ.
                </p>
                {Object.entries(settingLabels).map(([key, label]) => (
                  <label className="setting-row" key={key}>
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={Boolean(view.meeting.settings[key])}
                      disabled={busy}
                      onChange={(event) =>
                        run('/settings', 'PATCH', {
                          [key]: event.target.checked,
                        })
                      }
                    />
                  </label>
                ))}
              </>
            )}
          </div>
          {mode === 'people' && (
            <div className="panel-footer">
              <div className="button-row compact">
                <CopyInvite id={id} compact label="Mời" />
                <button
                  disabled={busy}
                  onClick={() =>
                    run('/mute-all', 'POST', { audio: true, video: false })
                  }
                >
                  Tắt tiếng tất cả
                </button>
                <button disabled={busy} onClick={() => run('/hands', 'DELETE')}>
                  Hạ tay tất cả
                </button>
              </div>
            </div>
          )}
        </aside>
      )}
      {confirmation && (
        <ConfirmDialog
          {...confirmation}
          error={error}
          onConfirm={
            mode === 'end'
              ? () => run('', 'DELETE', undefined, onEnded)
              : confirmation.execute
          }
          onClose={() => {
            setConfirmation(null)
            onDismiss?.()
          }}
          busy={busy}
        />
      )}
    </>
  )
}
