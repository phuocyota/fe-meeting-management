import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context'
import { isAdmin } from '../utils/meeting'
import { Brand, Notice, ThemeToggle } from './Common'
import DevicePicker from './DevicePicker'
import Icon from './Icon'

export default function MeetingPreview({
  admission,
  onEnter,
  onLeave,
  statusNotice,
}) {
  const { session, identityId } = useAuth()
  const [choices, setChoices] = useState({
    audio: false,
    video: false,
    audioDevice: '',
    videoDevice: '',
  })
  const [message, setMessage] = useState('')
  const video = useRef(null)
  const streams = useRef(new Set())
  const ready = useRef({ audio: false, video: false })
  const person =
    admission.participants?.find((item) => item.userId === identityId) ||
    admission.participant
  const name =
    session?.user.name ||
    admission.guest?.name ||
    (() => {
      try {
        return JSON.parse(
          sessionStorage.getItem(`guest:${admission.meeting.id}`),
        )?.name
      } catch {
        return ''
      }
    })() ||
    person?.name ||
    'Bạn'
  const admin = isAdmin(admission.role || admission.meeting.myRole)
  // Token grants are read only to constrain the preview; the server/SDK remains authoritative.
  let grants = {}
  try {
    grants =
      JSON.parse(
        atob(
          admission.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'),
        ),
      ).video || {}
  } catch {
    /* Opaque tokens are supported. */
  }
  const allowed = (setting, source) =>
    person?.canPublish !== false &&
    grants.canPublish !== false &&
    (admin || admission.meeting.settings?.[setting] !== false) &&
    (!grants.canPublishSources?.length ||
      grants.canPublishSources.includes(source))
  const micAllowed = allowed('allowMicrophone', 'microphone')
  const cameraAllowed = allowed('allowCamera', 'camera')
  const audio = choices.audio && micAllowed
  const camera = choices.video && cameraAllowed
  useEffect(() => {
    let active = true
    const stream = []
    const streamSet = streams.current
    const element = video.current
    ready.current = { audio: false, video: false }
    if (audio || camera) {
      const media = navigator.mediaDevices
      if (!media?.getUserMedia) {
        Promise.resolve().then(() => {
          if (active)
            setMessage(
              'Không có thiết bị khả dụng. Bạn vẫn có thể vào cuộc họp.',
            )
          if (active)
            setChoices((previous) => ({
              ...previous,
              audio: false,
              video: false,
            }))
        })
      } else {
        // Separate requests let a missing mic coexist with a working camera, and vice versa.
        const capture = (options, kind) =>
          media.getUserMedia(options).then((item) => {
            if (!active) {
              item.getTracks().forEach((track) => track.stop())
              return item
            }
            streamSet.add(item)
            stream.push(item)
            ready.current[kind] = true
            if (kind === 'video' && element) element.srcObject = item
            return item
          })
        Promise.allSettled([
          audio
            ? capture(
                {
                  audio: choices.audioDevice
                    ? { deviceId: { exact: choices.audioDevice } }
                    : true,
                },
                'audio',
              )
            : null,
          camera
            ? capture(
                {
                  video: choices.videoDevice
                    ? { deviceId: { exact: choices.videoDevice } }
                    : true,
                },
                'video',
              )
            : null,
        ]).then((results) => {
          if (!active) return
          if (results.some((result) => result.status === 'rejected')) {
            setChoices((previous) => ({
              ...previous,
              audio: results[0].status === 'rejected' ? false : previous.audio,
              video: results[1].status === 'rejected' ? false : previous.video,
            }))
          }
          setMessage(
            results.some((result) => result.status === 'rejected')
              ? 'Chưa truy cập được camera hoặc micro. Kiểm tra quyền thiết bị; bạn vẫn có thể vào cuộc họp.'
              : '',
          )
        })
      }
    }
    return () => {
      active = false
      stream?.forEach((item) => {
        if (streamSet.delete(item))
          item.getTracks().forEach((track) => track.stop())
      })
      if (element) element.srcObject = null
    }
  }, [audio, camera, choices.audioDevice, choices.videoDevice])
  function enter() {
    streams.current.forEach((stream) =>
      stream.getTracks().forEach((track) => track.stop()),
    )
    streams.current.clear()
    onEnter({
      ...choices,
      audio: audio && ready.current.audio,
      video: camera && ready.current.video,
    })
  }
  return (
    <main className="preview-page">
      <Brand />
      <ThemeToggle className="floating-theme-toggle" />
      <section className="preview-content">
        <h1>{admission.meeting.title}</h1>
        <p>Kiểm tra âm thanh và video trước khi vào</p>
        <div className="preview-video-space">
          <div className="preview-video">
            <video ref={video} autoPlay playsInline muted hidden={!camera} />
            {!camera && <strong>{name}</strong>}
            <span className="preview-name">{name}</span>
            <div className="preview-controls">
              <button
                aria-pressed={audio}
                disabled={!micAllowed}
                title={
                  !micAllowed ? 'Chủ trì đã khóa quyền bật micro' : undefined
                }
                onClick={() => setChoices({ ...choices, audio: !audio })}
              >
                <Icon name="mic" off={!audio} />
                {audio ? 'Tắt tiếng' : 'Bật tiếng'}
              </button>
              <button
                aria-pressed={camera}
                disabled={!cameraAllowed}
                title={
                  !cameraAllowed
                    ? 'Chủ trì đã khóa quyền bật camera'
                    : undefined
                }
                onClick={() => setChoices({ ...choices, video: !camera })}
              >
                <Icon name="camera" off={!camera} />
                {camera ? 'Tắt video' : 'Bật video'}
              </button>
            </div>
          </div>
        </div>
        {(!micAllowed || !cameraAllowed) && (
          <p className="small">
            Chủ trì đã khóa{' '}
            {!micAllowed && !cameraAllowed
              ? 'micro và camera'
              : !micAllowed
              ? 'micro'
              : 'camera'}{' '}
            của bạn.
          </p>
        )}
        <div className="preview-devices">
          <DevicePicker
            kind="audioinput"
            value={choices.audioDevice}
            disabled={!micAllowed}
            onChange={(audioDevice) => setChoices({ ...choices, audioDevice })}
          />
          <DevicePicker
            kind="videoinput"
            value={choices.videoDevice}
            disabled={!cameraAllowed}
            onChange={(videoDevice) => setChoices({ ...choices, videoDevice })}
          />
        </div>
        <label className="preview-display-name">
          Tên hiển thị
          <input value={name} readOnly />
        </label>
        <Notice kind="info">{message}</Notice>
        {statusNotice}
        <div className="button-row">
          <button onClick={onLeave}>Hủy</button>
          <button className="primary" onClick={enter}>
            Vào cuộc họp
          </button>
        </div>
      </section>
    </main>
  )
}
