import { useCallback, useEffect, useRef, useState } from 'react'
import { useRoomContext } from '@livekit/components-react'
import { RoomEvent } from 'livekit-client'
import { useAuth } from '../auth/context'
import { isAdmin, metadataRole } from '../utils/meeting'

export function useRoomState(id, admission, report) {
  const { api, identityId } = useAuth()
  const room = useRoomContext()
  const [view, setView] = useState({
    meeting: admission.meeting,
    participants: [],
    lobbyCount: 0,
  })
  const [role, setRole] = useState(admission.role || admission.meeting.myRole)
  const [lobby, setLobby] = useState([])
  const [syncError, setSyncError] = useState('')
  const refreshRef = useRef(null)
  const refresh = useCallback(() => refreshRef.current?.(), [])

  useEffect(() => {
    let alive = true
    let sequence = 0
    let timer
    const controller = new AbortController()
    async function sync() {
      const current = ++sequence
      try {
        const next = await api.room(id, controller.signal)
        if (!alive || current !== sequence) return
        setView(next)
        setRole(next.meeting.myRole)
        setSyncError('')
        if (isAdmin(next.meeting.myRole)) {
          const pending = await api.lobby(id, controller.signal)
          if (alive && current === sequence) setLobby(pending)
        } else setLobby([])
      } catch (error) {
        if (alive && current === sequence && error.name !== 'AbortError')
          setSyncError(error.message)
      }
    }
    refreshRef.current = sync
    function schedule() {
      ++sequence
      clearTimeout(timer)
      timer = setTimeout(sync, 180)
    }
    function dataReceived(payload, _participant, _kind, topic) {
      if (
        !['meeting.lobby', 'meeting.roles', 'meeting.settings'].includes(topic)
      )
        return
      let data
      try {
        data = JSON.parse(new TextDecoder().decode(payload))
      } catch {
        return
      }
      if (data.meetingId !== id) return
      if (topic === 'meeting.lobby' && data.type === 'join_requested') {
        report('Có người đang xin vào phòng họp.', 'info')
        setView((previous) => ({
          ...previous,
          lobbyCount: (previous.lobbyCount || 0) + 1,
        }))
      }
      if (topic === 'meeting.roles' && data.type === 'role_changed') {
        if (data.userId === identityId) setRole(data.role)
        setView((previous) => ({
          ...previous,
          participants: previous.participants.map((item) =>
            item.userId === data.userId ? { ...item, role: data.role } : item,
          ),
        }))
      }
      if (topic === 'meeting.settings' && data.type === 'settings_changed') {
        setView((previous) => ({
          ...previous,
          meeting: { ...previous.meeting, settings: data.settings },
        }))
      }
      schedule()
    }
    function metadataChanged(metadata, participant) {
      if (participant?.identity === identityId) {
        const next = metadataRole(metadata)
        if (next) setRole(next)
      }
      schedule()
    }
    function trackMuted(publication, participant) {
      if (participant?.isLocal && publication.source === 'microphone')
        report('Mic của bạn đã được tắt.', 'info')
      schedule()
    }
    const handlers = [
      [RoomEvent.Connected, schedule],
      [RoomEvent.Reconnected, schedule],
      [RoomEvent.DataReceived, dataReceived],
      [RoomEvent.ParticipantMetadataChanged, metadataChanged],
      [RoomEvent.ParticipantAttributesChanged, schedule],
      [RoomEvent.ParticipantPermissionsChanged, schedule],
      [RoomEvent.ParticipantConnected, schedule],
      [RoomEvent.ParticipantDisconnected, schedule],
      [RoomEvent.TrackMuted, trackMuted],
      [RoomEvent.TrackUnmuted, schedule],
      [RoomEvent.TrackPublished, schedule],
      [RoomEvent.TrackUnpublished, schedule],
      [RoomEvent.LocalTrackPublished, schedule],
      [RoomEvent.LocalTrackUnpublished, schedule],
    ]
    handlers.forEach(([event, handler]) => room.on(event, handler))
    sync()
    const interval = setInterval(sync, 30000)
    return () => {
      alive = false
      controller.abort()
      clearTimeout(timer)
      clearInterval(interval)
      refreshRef.current = null
      handlers.forEach(([event, handler]) => room.off(event, handler))
    }
  }, [api, id, report, room, identityId])
  return { view, role, lobby: isAdmin(role) ? lobby : [], syncError, refresh }
}
