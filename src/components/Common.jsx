import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/context'
import Icon from './Icon'

export function Notice({ children, kind = 'error' }) {
  return children ? (
    <div
      className={`notice ${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  ) : null
}

// Màu avatar cố định theo tên để mỗi người có một màu dễ nhận ra.
const avatarColors = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#ea580c',
  '#0891b2',
  '#16a34a',
  '#ca8a04',
  '#4f46e5',
]

export function Avatar({ name = '' }) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ '--avatar-bg': avatarColors[hash % avatarColors.length] }}
    >
      {name.trim().slice(0, 1).toUpperCase() || '?'}
    </span>
  )
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

// Nút chuyển giao diện sáng/tối; lựa chọn lưu trong localStorage.
export function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(currentTheme)
  useEffect(() => {
    // Đồng bộ khi một nút khác (header/phòng họp) đổi giao diện.
    const observer = new MutationObserver(() => setTheme(currentTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('ichi-theme', next)
    } catch {
      // Trình duyệt chặn localStorage: vẫn đổi giao diện trong phiên này.
    }
  }
  const label =
    theme === 'dark'
      ? 'Chuyển sang giao diện sáng'
      : 'Chuyển sang giao diện tối'
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      {theme === 'dark' ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  )
}

export function Brand() {
  const { session } = useAuth()
  return (
    <Link className="brand" to={session ? '/' : '/login'}>
      <img className="brand-mark brand-logo" src="/icon-192.png" alt="" />
      <img className="brand-partner" src="/di-ichi-logo.png" alt="Di-ichi" />
      <span>
        Ichi <b>Meeting</b>
        <small>KHÔNG GIAN KẾT NỐI</small>
      </span>
    </Link>
  )
}

// Native disclosure semantics, with shared dismissal for account and room menus.
export function PopupMenu({ label, children, className = '', ariaLabel }) {
  const menu = useRef(null)
  useEffect(() => {
    function dismiss(event) {
      const node = menu.current
      if (!node?.open) return
      if (event.type === 'keydown') {
        if (event.key !== 'Escape') return
        node.open = false
        node.querySelector('summary')?.focus()
      } else if (!node.contains(event.target)) node.open = false
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', dismiss)
    }
  }, [])
  return (
    <details
      className={`popup-menu ${className}`}
      ref={menu}
      onPointerDownCapture={(event) => {
        event.currentTarget.dataset.focusOrigin = 'pointer'
      }}
      onKeyDownCapture={(event) => {
        // Escape preserves the modality used inside the menu when restoring focus.
        if (event.key !== 'Escape')
          delete event.currentTarget.dataset.focusOrigin
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          delete event.currentTarget.dataset.focusOrigin
        }
      }}
    >
      <summary aria-label={ariaLabel}>{label}</summary>
      <div
        className="popup-items"
        onClick={(event) => {
          if (event.target.closest('button:not(:disabled), a'))
            menu.current.open = false
        }}
      >
        {children}
      </div>
    </details>
  )
}

export function Header({ dark = false }) {
  const { session, logout } = useAuth()
  return (
    <header className={`app-header ${dark ? 'dark-header' : ''}`}>
      <Brand />
      <div className="header-actions">
        <ThemeToggle />
        {session && (
          <PopupMenu
            className="account-menu"
            ariaLabel="Menu tài khoản"
            label={
              <>
                <Avatar name={session.user.name} />
                <span>{session.user.name}</span>
                <span aria-hidden="true">⌄</span>
              </>
            }
          >
            <Link to="/account">Tài khoản của tôi</Link>
            <Link to="/users/new">Tạo tài khoản</Link>
            <button onClick={logout}>Đăng xuất</button>
          </PopupMenu>
        )}
      </div>
    </header>
  )
}

export function CopyInvite({
  id,
  compact = false,
  label = 'Sao chép link mời',
}) {
  const [message, setMessage] = useState('')
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/meeting/${encodeURIComponent(id)}`,
      )
      setMessage('Đã sao chép link mời')
    } catch {
      setMessage('Không sao chép được. Hãy sao chép địa chỉ bên dưới.')
    }
  }
  return (
    <div className={`copy-invite ${compact ? 'compact-invite' : ''}`}>
      <button className="ghost" onClick={copy}>
        <Icon name="link" /> {label}
      </button>
      {message && <small role="status">{message}</small>}
      <input
        className={compact ? 'sr-only' : undefined}
        aria-label="Link mời cuộc họp"
        readOnly
        value={`${window.location.origin}/meeting/${encodeURIComponent(id)}`}
        onFocus={(event) => event.target.select()}
      />
    </div>
  )
}

export function ConfirmDialog({
  title,
  description,
  onConfirm,
  onClose,
  busy,
  error,
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) {
            event.preventDefault()
            onClose()
          }
          if (event.key !== 'Tab') return
          const buttons = [
            ...event.currentTarget.querySelectorAll('button:not(:disabled)'),
          ]
          const first = buttons[0],
            last = buttons.at(-1)
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
      >
        <h2 id="confirm-title">{title}</h2>
        <p>{description}</p>
        <Notice>{error}</Notice>
        <div className="button-row">
          <button autoFocus onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button className="danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Đang xử lý…' : 'Xác nhận'}
          </button>
        </div>
      </section>
    </div>
  )
}
