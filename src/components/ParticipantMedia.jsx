import Icon from './Icon'
export default function ParticipantMedia({ person, live }) {
  const mic = live ? live.isMicrophoneEnabled : person.microphone === 'on'
  const camera = live ? live.isCameraEnabled : person.camera === 'on'
  return (
    <span className="participant-media">
      <span
        className={!mic ? 'muted-mic' : ''}
        title={mic ? 'Mic bật' : 'Mic tắt'}
      >
        <Icon name="mic" off={!mic} />
      </span>
      <span title={camera ? 'Camera bật' : 'Camera tắt'}>
        <Icon name="camera" off={!camera} />
      </span>
    </span>
  )
}
