import { useEffect, useRef } from 'react'
export default function FormDialog({ title, onClose, busy, children }) {
  const dialog = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const node = dialog.current
    node.showModal()
    const first = node.querySelector('input') || node.querySelector('button')
    first?.focus()
    return () => {
      node.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      className="form-dialog card"
      ref={dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="section-heading">
        <h2>{title}</h2>
        <button
          type="button"
          aria-label="Đóng hộp thoại"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  )
}
