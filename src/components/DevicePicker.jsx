import { useEffect, useState } from 'react'
import { Room } from 'livekit-client'

// Device enumeration never requests permission on its own.
export default function DevicePicker({
  kind,
  value,
  onChange,
  disabled = false,
}) {
  const [devices, setDevices] = useState([])
  const [selected, setSelected] = useState('')
  useEffect(() => {
    let active = true
    const update = () =>
      Room.getLocalDevices(kind, false)
        .then((items) => {
          if (active) setDevices(items)
        })
        .catch(() => {})
    update()
    navigator.mediaDevices?.addEventListener?.('devicechange', update)
    return () => {
      active = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', update)
    }
  }, [kind])
  const label =
    kind === 'audioinput' ? 'Micro' : kind === 'audiooutput' ? 'Loa' : 'Camera'
  return (
    <label className="device-picker">
      {label}
      <select
        aria-label={`Chọn ${label.toLowerCase()}`}
        value={value ?? selected}
        disabled={disabled || !devices.length}
        onChange={(event) => {
          setSelected(event.target.value)
          onChange(event.target.value)
        }}
      >
        <option value="">Thiết bị mặc định</option>
        {devices.map((device, index) => (
          <option key={device.deviceId || index} value={device.deviceId}>
            {device.label || `${label} ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  )
}
